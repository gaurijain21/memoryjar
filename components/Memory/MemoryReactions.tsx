"use client";

import dynamic from "next/dynamic";
import { SmilePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { normalizeReactionSummary, subscribeToMemoryReactions, toggleMemoryReaction, type ReactionSummary } from "@/lib/reactions";
import type { Memory } from "@/types/memory";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

type EmojiClickData = {
  emoji: string;
};

type MemoryReactionsProps = {
  memory: Memory;
  uid: string | null;
  onReacted?: (emoji: string) => void;
  onRequireLogin?: () => void;
};

export function MemoryReactions({ memory, uid, onReacted, onRequireLogin }: MemoryReactionsProps) {
  const [summary, setSummary] = useState<ReactionSummary>({});
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reactions = useMemo(
    () => normalizeReactionSummary(summary).topEmojis.map(({ emoji, count }) => [emoji, { count, reactedByMe: Boolean(summary[emoji]?.reactedByMe) }] as const),
    [summary],
  );

  useEffect(() => {
    return subscribeToMemoryReactions(
      memory,
      uid,
      setSummary,
      (reactionError) => {
        console.warn("[MemoryJar reactions] listener failed", reactionError);
        setError("Reactions unavailable");
      },
    );
  }, [memory, uid]);

  const handleReaction = async (emoji: string) => {
    if (!uid) {
      onRequireLogin?.();
      return;
    }

    const alreadyReacted = Boolean(summary[emoji]?.reactedByMe);
    setError(null);
    setSummary((current) => {
      const previous = current[emoji] ?? { count: 0, reactedByMe: false };
      return {
        ...current,
        [emoji]: {
          count: Math.max(0, previous.count + (alreadyReacted ? -1 : 1)),
          reactedByMe: !alreadyReacted,
        },
      };
    });
    try {
      await toggleMemoryReaction(memory, uid, emoji);
      if (!alreadyReacted) onReacted?.(emoji);
    } catch (reactionError) {
      console.warn("[MemoryJar reactions] toggle failed", reactionError);
      setError("Could not update reaction");
    }
  };

  return (
    <div className="memory-reactions" aria-label="Memory reactions">
      <div className="reaction-picker-wrap">
        <button
          aria-expanded={isPickerOpen}
          aria-label="Choose reaction emoji"
          className="reaction-picker-button"
          onClick={() => setIsPickerOpen((current) => !current)}
          type="button"
        >
          <SmilePlus size={16} />
          React
        </button>
        {isPickerOpen ? (
          <div className="reaction-picker-popover">
            <EmojiPicker
              height={340}
              lazyLoadEmojis
              onEmojiClick={(emojiData: EmojiClickData) => {
                setIsPickerOpen(false);
                void handleReaction(emojiData.emoji);
              }}
              previewConfig={{ showPreview: false }}
              searchDisabled={false}
              width={300}
            />
          </div>
        ) : null}
      </div>

      {reactions.map(([emoji, item]) => (
        <button
          aria-pressed={item.reactedByMe}
          className={`reaction-pill ${item.reactedByMe ? "active" : ""}`}
          key={emoji}
          onClick={() => void handleReaction(emoji)}
          type="button"
        >
          <span>{emoji}</span>
          <strong>{item.count}</strong>
        </button>
      ))}
      {error ? <span className="reaction-error">{error}</span> : null}
    </div>
  );
}
