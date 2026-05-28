"use client";

import { MapPin } from "lucide-react";
import type { Memory } from "@/types/memory";

type MemoryCardProps = {
  memory: Memory;
  isActive?: boolean;
  onClick: (memory: Memory) => void;
};

export function MemoryCard({ memory, isActive, onClick }: MemoryCardProps) {
  const date = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${memory.date}T00:00:00`));

  return (
    <button
      className={`memory-card ${isActive ? "active" : ""}`}
      onClick={() => onClick(memory)}
      type="button"
    >
      <div className="memory-card-image">
        {memory.photoUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={memory.photoUrls[0]} />
        ) : (
          <MapPin size={24} />
        )}
      </div>
      <div>
        <strong>{memory.title}</strong>
        <span>{date}</span>
        <small>{memory.locationName}</small>
      </div>
    </button>
  );
}
