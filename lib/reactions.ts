import {
  collection,
  doc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Memory } from "@/types/memory";

export type ReactionSummary = Record<string, {
  count: number;
  reactedByMe: boolean;
}>;

export type NormalizedReactionSummary = {
  emojiCounts: Record<string, number>;
  totalCount: number;
  topEmojis: Array<{ emoji: string; count: number }>;
  lastEmoji?: string;
  lastReactionAt?: number;
  lastReactionBy?: string;
};

export type ReactionSummaryMap = Record<string, NormalizedReactionSummary>;

export function emojiKey(emoji: string) {
  return Array.from(emoji).map((char) => char.codePointAt(0)?.toString(16)).join("-");
}

export function getReactionKey(memory: Memory) {
  if (memory.groupId) return `group_${memory.groupId}_${memory.sourceMemoryId ?? memory.id}`;
  if (memory.audience === "public" && memory.ownerId) return `public_${memory.ownerId}_${memory.sourceMemoryId ?? memory.id}`;
  return `private_${memory.ownerId ?? "owner"}_${memory.sourceMemoryId ?? memory.id}`;
}

export function normalizeReactionSummary(
  summary: ReactionSummary | Record<string, number> | undefined,
  options?: { lastEmoji?: string; lastReactionAt?: number; lastReactionBy?: string },
): NormalizedReactionSummary {
  const emojiCounts = Object.entries(summary ?? {}).reduce<Record<string, number>>((result, [emoji, value]) => {
    const count = typeof value === "number" ? value : value.count;
    if (count > 0) result[emoji] = count;
    return result;
  }, {});
  const topEmojis = Object.entries(emojiCounts)
    .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
    .map(([emoji, count]) => ({ emoji, count }));

  return {
    emojiCounts,
    totalCount: Object.values(emojiCounts).reduce((total, count) => total + count, 0),
    topEmojis,
    lastEmoji: options?.lastEmoji,
    lastReactionAt: options?.lastReactionAt,
    lastReactionBy: options?.lastReactionBy,
  };
}

export function getReactionSummary(
  memory: Memory & {
    reactionSummary?: NormalizedReactionSummary;
    reactions?: Record<string, number>;
    reactionCount?: number;
    likeCount?: number;
    likes?: number;
  },
): NormalizedReactionSummary {
  if (memory.reactionSummary) return memory.reactionSummary;

  const normalized = normalizeReactionSummary(memory.reactions);
  if (normalized.totalCount > 0) return normalized;

  const fallbackTotal = memory.reactionCount ?? memory.likeCount ?? memory.likes ?? 0;
  return {
    emojiCounts: {},
    totalCount: fallbackTotal,
    topEmojis: [],
  };
}

function getReactionMeta(memory: Memory) {
  return {
    groupId: memory.groupId ?? null,
    memoryId: memory.sourceMemoryId ?? memory.id,
    ownerId: memory.ownerId ?? null,
    visibility: memory.groupId ? "group" : memory.audience === "public" ? "public" : "private",
    updatedAt: serverTimestamp(),
  };
}

export function subscribeToMemoryReactions(
  memory: Memory,
  uid: string | null,
  onNext: (summary: ReactionSummary) => void,
  onError: (error: Error) => void,
) {
  const reactionRef = doc(db, "memoryReactions", getReactionKey(memory));

  return onSnapshot(
    reactionRef,
    (snapshot) => {
      const data = snapshot.data() as {
        counts?: Record<string, number>;
        emojis?: Record<string, string>;
        users?: Record<string, Record<string, boolean>>;
      } | undefined;
      const counts = data?.counts ?? {};
      const emojis = data?.emojis ?? {};
      const users = data?.users ?? {};
      const summary: ReactionSummary = {};

      Object.entries(counts)
        .filter(([, count]) => count > 0)
        .forEach(([key, count]) => {
          const emoji = emojis[key] ?? "✨";
          summary[emoji] = {
            count,
            reactedByMe: uid ? Boolean(users[key]?.[uid]) : false,
          };
        });

      onNext(summary);
    },
    onError,
  );
}

export async function toggleMemoryReaction(memory: Memory, uid: string, emoji: string) {
  const reactionKey = getReactionKey(memory);
  const key = emojiKey(emoji);
  const reactionRef = doc(db, "memoryReactions", reactionKey);
  const userReactionRef = doc(db, "memoryReactions", reactionKey, "emojiUsers", `${key}_${uid}`);

  await setDoc(reactionRef, getReactionMeta(memory), { merge: true });

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(userReactionRef);

    if (existing.exists()) {
      transaction.delete(userReactionRef);
      transaction.update(reactionRef, {
        [`counts.${key}`]: increment(-1),
        [`users.${key}.${uid}`]: false,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    transaction.set(userReactionRef, {
      emoji,
      emojiKey: key,
      uid,
      createdAt: serverTimestamp(),
    });
    transaction.update(reactionRef, {
      [`counts.${key}`]: increment(1),
      [`emojis.${key}`]: emoji,
      [`users.${key}.${uid}`]: true,
      lastEmoji: emoji,
      lastReactionAt: serverTimestamp(),
      lastReactionBy: uid,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function ensureReactionDocument(memory: Memory) {
  await setDoc(doc(db, "memoryReactions", getReactionKey(memory)), getReactionMeta(memory), { merge: true });
}

export function subscribeToReactionEvents(
  onNext: (events: Array<{ id: string; emoji: string; reactionAt: number; reactionBy: string }>) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    collection(db, "memoryReactions"),
    (snapshot) => {
      onNext(snapshot.docChanges().map((change) => {
        const data = change.doc.data() as { lastEmoji?: string; lastReactionAt?: { toMillis?: () => number }; lastReactionBy?: string };
        return {
          id: change.doc.id,
          emoji: data.lastEmoji ?? "",
          reactionAt: data.lastReactionAt?.toMillis?.() ?? 0,
          reactionBy: data.lastReactionBy ?? "",
        };
      }).filter((event) => Boolean(event.emoji)));
    },
    onError,
  );
}

export function subscribeToReactionSummaries(
  onNext: (summaryMap: ReactionSummaryMap) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    collection(db, "memoryReactions"),
    (snapshot) => {
      const nextSummaryMap = snapshot.docs.reduce<ReactionSummaryMap>((result, snapshotDoc) => {
        const data = snapshotDoc.data() as {
          counts?: Record<string, number>;
          emojis?: Record<string, string>;
          lastEmoji?: string;
          lastReactionAt?: { toMillis?: () => number };
          lastReactionBy?: string;
        };
        const emojiCounts = Object.entries(data.counts ?? {}).reduce<Record<string, number>>((counts, [key, count]) => {
          if (count <= 0) return counts;
          counts[data.emojis?.[key] ?? "✨"] = count;
          return counts;
        }, {});

        result[snapshotDoc.id] = normalizeReactionSummary(emojiCounts, {
          lastEmoji: data.lastEmoji ?? "",
          lastReactionAt: data.lastReactionAt?.toMillis?.() ?? 0,
          lastReactionBy: data.lastReactionBy ?? "",
        });
        return result;
      }, {});

      onNext(nextSummaryMap);
    },
    onError,
  );
}
