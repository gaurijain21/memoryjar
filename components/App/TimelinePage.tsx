"use client";

import Link from "next/link";
import { Edit3, Eye, Heart, MapPin, Sparkles, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { getMemoryExpandedHref } from "@/lib/expandedMemory";
import { formatMemoryDate } from "@/lib/formatDate";
import { getReadableLocationName } from "@/lib/locationText";
import { sortMemoriesNewestFirst } from "@/lib/memorySort";
import type { Memory } from "@/types/memory";

type TimelinePageProps = {
  memories: Memory[];
  onDeleteMemory?: (memory: Memory) => void;
  onEditMemory?: (memory: Memory) => void;
};

type MonthGroup = {
  key: string;
  label: string;
  memories: Memory[];
};

function getMonthKey(memory: Memory) {
  const [year, month = "01"] = memory.date.split("-");
  return `${year}-${month.padStart(2, "0")}`;
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
}

function getMemoryKey(memory: Memory) {
  return `${memory.groupId ?? memory.ownerId ?? "memory"}:${memory.sourceMemoryId ?? memory.id}`;
}

function getLocation(memory: Memory) {
  return getReadableLocationName(memory.placeName || memory.locationName || memory.formattedAddress || "");
}

function getVibe(memory: Memory) {
  return memory.vibes?.[0] || memory.feeling || "Memory";
}

export function TimelinePage({ memories, onDeleteMemory, onEditMemory }: TimelinePageProps) {
  const { user } = useApp();
  const groups = useMemo<MonthGroup[]>(() => {
    const grouped = new Map<string, Memory[]>();
    sortMemoriesNewestFirst(memories).forEach((memory) => {
      const key = getMonthKey(memory);
      grouped.set(key, [...(grouped.get(key) ?? []), memory]);
    });
    return Array.from(grouped.entries()).map(([key, monthMemories]) => ({
      key,
      label: getMonthLabel(key),
      memories: monthMemories,
    }));
  }, [memories]);
  const rail = groups.map((group) => ({ key: group.key, label: group.label.split(" ")[0], year: group.label.split(" ")[1] }));

  return (
    <section className="workspace-page timeline-page">
      <div className="workspace-header">
        <div>
          <p className="workspace-kicker">Timeline</p>
          <h1>Your memories by month</h1>
          <span>{memories.length} saved moments</span>
        </div>
      </div>

      {groups.length ? (
        <div className="timeline-layout">
          <div className="timeline-sections">
            {groups.map((group) => (
              <section className="timeline-month-section" id={`timeline-${group.key}`} key={group.key}>
                <h2>{group.label}</h2>
                <div className="timeline-card-grid">
                  {group.memories.map((memory) => {
                    const canManage = Boolean(user && (memory.ownerId === user.uid || memory.creatorUid === user.uid || (!memory.groupId && !memory.ownerId)));
                    const photo = memory.photoUrls[0] ?? null;

                    return (
                      <article className="timeline-memory-card" key={getMemoryKey(memory)}>
                        <Link className="timeline-card-link" href={getMemoryExpandedHref(memory)} target="_blank" rel="noopener noreferrer">
                          <div className="timeline-card-image">
                            {photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img alt="" src={photo} />
                            ) : (
                              <MapPin size={34} />
                            )}
                            <span className="vibe-badge">
                              <Sparkles size={13} />
                              {getVibe(memory)}
                            </span>
                          </div>
                        </Link>
                        <div className="timeline-card-copy">
                          <h3>{memory.title || "Untitled memory"}</h3>
                          <p><MapPin size={14} /> {getLocation(memory) || "Saved place"}</p>
                          <span>{formatMemoryDate(memory.date, "long")}</span>
                          <div className="timeline-card-meta">
                            <span><Heart size={14} fill="currentColor" /> 0</span>
                            <span>✨ 0</span>
                            <Link href={getMemoryExpandedHref(memory)} target="_blank" rel="noopener noreferrer">
                              <Eye size={14} />
                              Open
                            </Link>
                          </div>
                          {canManage ? (
                            <div className="timeline-card-actions">
                              {onEditMemory ? (
                                <button aria-label="Edit memory" onClick={() => onEditMemory(memory)} type="button"><Edit3 size={15} /></button>
                              ) : null}
                              {onDeleteMemory ? (
                                <button aria-label="Delete memory" onClick={() => onDeleteMemory(memory)} type="button"><Trash2 size={15} /></button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <nav className="timeline-jump-rail" aria-label="Timeline jump">
            {rail.map((item) => (
              <a href={`#timeline-${item.key}`} key={item.key}>
                <strong>{item.label}</strong>
                <span>{item.year}</span>
              </a>
            ))}
          </nav>
        </div>
      ) : (
        <div className="empty-state polished-empty">
          <h3>No memories on your timeline yet</h3>
          <p>Add a memory to start building a timeline by month and place.</p>
        </div>
      )}
    </section>
  );
}
