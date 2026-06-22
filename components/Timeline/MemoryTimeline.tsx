"use client";

import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { sortMemoriesNewestFirst } from "@/lib/memorySort";
import type { Memory } from "@/types/memory";

type MemoryTimelineProps = {
  collapseSignal?: number;
  memories: Memory[];
  selectedMemoryId?: string;
  onExpandedChange?: (isExpanded: boolean) => void;
  onSelectMemory: (memory: Memory) => void;
};

type TimelineImage = {
  key: string;
  memory: Memory;
  photoUrl: string | null;
};

function getMonthKey(date: string) {
  const [year, month = "01"] = date.split("-");
  return `${year}-${month.padStart(2, "0")}`;
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function MemoryTimeline({
  collapseSignal = 0,
  memories,
  onExpandedChange,
  selectedMemoryId,
  onSelectMemory,
}: MemoryTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);

  useEffect(() => {
    if (collapseSignal > 0) setIsExpanded(false);
  }, [collapseSignal]);

  const monthGroups = useMemo(() => {
    const grouped = new Map<string, TimelineImage[]>();

    sortMemoriesNewestFirst(memories)
      .forEach((memory) => {
        const monthKey = getMonthKey(memory.date);
        const photos = memory.photoUrls.length > 0 ? memory.photoUrls : [null];

        // Timeline grouping: every image is represented under its memory month,
        // so multi-photo memories are not collapsed to a single thumbnail.
        photos.forEach((photoUrl, photoIndex) => {
          grouped.set(monthKey, [
            ...(grouped.get(monthKey) ?? []),
            {
              key: `${memory.groupId ?? memory.ownerId ?? "memory"}:${memory.id}:${photoIndex}:${photoUrl ?? "pin"}`,
              memory,
              photoUrl,
            },
          ]);
        });
      });

    return Array.from(grouped.entries()).map(([monthKey, images]) => ({
      monthKey,
      label: getMonthLabel(monthKey),
      images,
    }));
  }, [memories]);

  return (
    <section
      className={`timeline-panel ${isExpanded ? "expanded" : "collapsed"}`}
      aria-label="Timeline"
    >
      <button
        aria-label={isExpanded ? "Collapse memories" : "Expand memories"}
        className="timeline-toggle"
        onClick={() => setIsExpanded((current) => !current)}
        type="button"
      >
        <span>Your Timeline</span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
      </button>
      <div className="timeline-header">
        <div>
          <h2>Your Timeline</h2>
        </div>
      </div>
      <div className="timeline-month-strip">
        {monthGroups.length === 0 ? (
          <div className="timeline-empty">No memories yet - add your first pin.</div>
        ) : null}
        {monthGroups.map((group) => (
          <div className="timeline-month" key={group.monthKey}>
            <div className="timeline-month-label">{group.label}</div>
            <div className="timeline-dot-line">
              <span className="timeline-dot" />
            </div>
            <div className="timeline-month-images">
              {group.images.map((item) => (
                <button
                  className={`timeline-image-card ${item.memory.id === selectedMemoryId ? "active" : ""}`}
                  key={item.key}
                  onClick={() => onSelectMemory(item.memory)}
                  type="button"
                >
                  {item.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={item.photoUrl} />
                  ) : (
                    <MapPin size={22} />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
