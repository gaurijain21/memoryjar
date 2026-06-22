"use client";

import { Heart, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getReadableLocationName } from "@/lib/locationText";
import { sortMemoriesNewestFirst } from "@/lib/memorySort";
import type { Memory } from "@/types/memory";

type PublicActivityNotificationsProps = {
  hidden?: boolean;
  memories: Memory[];
  timelineExpanded?: boolean;
};

function getCreatedMillis(memory: Memory) {
  return memory.createdAt?.toMillis?.() ?? 0;
}

export function PublicActivityNotifications({
  hidden = false,
  memories,
  timelineExpanded = false,
}: PublicActivityNotificationsProps) {
  const sortedPublic = useMemo(() => sortMemoriesNewestFirst(memories), [memories]);
  const seenIdsRef = useRef<Set<string> | null>(null);
  const [activeMemories, setActiveMemories] = useState<Memory[]>([]);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(sortedPublic.map((memory) => memory.id));
    if (!seenIdsRef.current) {
      seenIdsRef.current = currentIds;
      return;
    }

    const incoming = sortedPublic
      .filter((memory) => {
        return !seenIdsRef.current?.has(memory.id)
          && !dismissedKeys.has(memory.id)
          && !activeMemories.some((active) => active.id === memory.id);
      })
      .sort((a, b) => getCreatedMillis(b) - getCreatedMillis(a));

    seenIdsRef.current = currentIds;
    if (!incoming.length) return;

    setActiveMemories((current) => [...incoming, ...current].slice(0, 4));

    incoming.forEach((memory) => {
      window.setTimeout(() => {
        setDismissedKeys((current) => new Set(current).add(memory.id));
        setActiveMemories((current) => current.filter((active) => active.id !== memory.id));
      }, 10000);
    });
  }, [activeMemories, dismissedKeys, sortedPublic]);

  if (hidden || activeMemories.length === 0) return null;

  const closeMemory = (memoryId: string) => {
    setDismissedKeys((current) => new Set(current).add(memoryId));
    setActiveMemories((current) => current.filter((memory) => memory.id !== memoryId));
  };

  return (
    <div className={`activity-toast-stack ${timelineExpanded ? "above-timeline" : ""}`}>
      {activeMemories.map((memory) => {
        const location = getReadableLocationName(memory.placeName || memory.locationName);

        return (
          <aside className="activity-toast" key={memory.id}>
            <div className="activity-toast-icon">
              <Heart size={15} fill="currentColor" />
            </div>
            <div className="activity-toast-copy">
              <strong>
                New post alert <Sparkles size={13} />
              </strong>
              <span>
                {location
                  ? `someone added a post at ${location}`
                  : "someone added a post nearby"}
              </span>
            </div>
            <button
              aria-label="Close activity notification"
              onClick={() => closeMemory(memory.id)}
              type="button"
            >
              <X size={14} />
            </button>
          </aside>
        );
      })}
    </div>
  );
}
