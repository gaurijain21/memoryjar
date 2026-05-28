"use client";

import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, MapPin, Pencil, Trash2, X } from "lucide-react";
import type { Memory } from "@/types/memory";

type MemoryDetailPanelProps = {
  memory: Memory | null;
  onClose: () => void;
  onEdit: (memory: Memory) => void;
  onDelete: (memory: Memory) => void;
};

export function MemoryDetailPanel({
  memory,
  onClose,
  onEdit,
  onDelete,
}: MemoryDetailPanelProps) {
  const [photoIndex, setPhotoIndex] = useState(0);

  if (!memory) return null;

  const date = new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${memory.date}T00:00:00`));
  const photos = memory.photoUrls;

  return (
    <aside className="detail-panel">
      <div className="detail-actions">
        <button aria-label="Edit" className="icon-button" onClick={() => onEdit(memory)} type="button">
          <Pencil size={17} />
        </button>
        <button
          aria-label="Delete"
          className="icon-button danger"
          onClick={() => onDelete(memory)}
          type="button"
        >
          <Trash2 size={17} />
        </button>
        <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
          <X size={17} />
        </button>
      </div>

      <div className="detail-photo">
        {photos[photoIndex] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={photos[photoIndex]} />
        ) : (
          <MapPin size={40} />
        )}
        {photos.length > 1 ? (
          <div className="carousel-controls">
            <button
              aria-label="Previous photo"
              className="icon-button"
              onClick={() => setPhotoIndex((index) => (index === 0 ? photos.length - 1 : index - 1))}
              type="button"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              aria-label="Next photo"
              className="icon-button"
              onClick={() => setPhotoIndex((index) => (index + 1) % photos.length)}
              type="button"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="detail-copy">
        <h2>{memory.title}</h2>
        <p>{memory.description}</p>
        <div className="detail-meta">
          <span>
            <Calendar size={15} />
            {date}
          </span>
          <span>
            <MapPin size={15} />
            {memory.locationName}
          </span>
        </div>
      </div>
    </aside>
  );
}
