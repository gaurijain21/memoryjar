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

export function emojiKey(emoji: string) {
  return Array.from(emoji).map((char) => char.codePointAt(0)?.toString(16)).join("-");
}

export function getReactionKey(memory: Memory) {
  if (memory.groupId) return `group_${memory.groupId}_${memory.sourceMemoryId ?? memory.id}`;
  if (memory.audience === "public" && memory.ownerId) return `public_${memory.ownerId}_${memory.sourceMemoryId ?? memory.id}`;
  return `private_${memory.ownerId ?? "owner"}_${memory.sourceMemoryId ?? memory.id}`;
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
  onNext: (events: Array<{ id: string; emoji: string; reactionAt: number }>) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    collection(db, "memoryReactions"),
    (snapshot) => {
      onNext(snapshot.docChanges().map((change) => {
        const data = change.doc.data() as { lastEmoji?: string; lastReactionAt?: { toMillis?: () => number } };
        return {
          id: change.doc.id,
          emoji: data.lastEmoji ?? "",
          reactionAt: data.lastReactionAt?.toMillis?.() ?? 0,
        };
      }).filter((event) => Boolean(event.emoji)));
    },
    onError,
  );
}
