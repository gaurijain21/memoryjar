"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { Memory } from "@/types/memory";
import { MemoryCard } from "@/components/Memory/MemoryCard";

type MemoryTimelineProps = {
  memories: Memory[];
  selectedMemoryId?: string;
  onSelectMemory: (memory: Memory) => void;
  rangeIndex: number;
  onRangeChange: (index: number) => void;
};

export function MemoryTimeline({
  memories,
  selectedMemoryId,
  onSelectMemory,
  rangeIndex,
  onRangeChange,
}: MemoryTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sorted = useMemo(() => {
    const seen = new Set<string>();

    return [...memories]
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((memory) => {
        const stableKey = `${memory.groupId ?? "private"}:${memory.id}:${memory.photoUrls[0] ?? "no-photo"}`;
        if (seen.has(stableKey)) return false;
        seen.add(stableKey);
        return true;
      });
  }, [memories]);
  const selected = sorted[rangeIndex];
  const years = useMemo(() => {
    const memoryYears = sorted.map((memory) => Number(memory.date.split("-")[0])).filter(Boolean);
    const fallback = new Date().getFullYear();
    return {
      start: memoryYears[0] ?? fallback,
      current: selected ? Number(selected.date.split("-")[0]) || fallback : fallback,
      end: memoryYears[memoryYears.length - 1] ?? fallback,
    };
  }, [selected, sorted]);

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
        <span>Timeline</span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
      </button>
      <div className="timeline-header">
        <div>
          <h2>Timeline</h2>
        </div>
      </div>
      <div className="year-row">
        <span>{years.start}</span>
        <span>{years.current}</span>
        <span>{years.end}</span>
      </div>
      <input
        aria-label="Memory timeline"
        className="timeline-range"
        disabled={sorted.length < 2}
        max={Math.max(sorted.length - 1, 0)}
        min={0}
        onChange={(event) => onRangeChange(Number(event.target.value))}
        type="range"
        value={Math.min(rangeIndex, Math.max(sorted.length - 1, 0))}
      />
      <div className="memory-strip">
        {sorted.length === 0 ? (
          <div className="timeline-empty">No memories yet - add your first pin.</div>
        ) : null}
        {sorted.map((memory) => (
          <MemoryCard
            isActive={memory.id === selectedMemoryId}
            key={memory.id}
            memory={memory}
            onClick={onSelectMemory}
          />
        ))}
      </div>
    </section>
  );
}
