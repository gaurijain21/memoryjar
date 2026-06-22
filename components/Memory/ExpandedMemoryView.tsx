"use client";

import { Calendar, ChevronLeft, ChevronRight, MapPin, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { MemoryReactions } from "@/components/Memory/MemoryReactions";
import { useApp } from "@/contexts/AppContext";
import { formatMemoryDate } from "@/lib/formatDate";
import { getReadableLocationName } from "@/lib/locationText";
import type { Memory } from "@/types/memory";

type ExpandedMemoryViewProps = {
  memory: Memory;
  visibilityLabel: string;
  className?: string;
};

export function ExpandedMemoryView({
  memory,
  visibilityLabel,
  className = "",
}: ExpandedMemoryViewProps) {
  const { user, requestLogin } = useApp();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [floatingEmoji, setFloatingEmoji] = useState<{ id: number; emoji: string } | null>(null);
  const photos = memory.photoUrls;
  const date = formatMemoryDate(memory.date, "long");
  const locationName = getReadableLocationName(memory.locationName);

  useEffect(() => {
    setPhotoIndex(0);
  }, [memory.id]);

  const floatEmoji = (emoji: string) => {
    const id = Date.now();
    setFloatingEmoji({ id, emoji });
    window.setTimeout(() => {
      setFloatingEmoji((current) => current?.id === id ? null : current);
    }, 1400);
  };

  return (
    <section className={`expanded-memory-view ${className}`}>
      <aside className="expanded-memory-details">
        <h1>{memory.title}</h1>
        {memory.description ? <p>{memory.description}</p> : null}
        <div className="detail-meta">
          {date ? (
            <span>
              <Calendar size={15} />
              {date}
            </span>
          ) : null}
          {locationName ? (
            <span>
              <MapPin size={15} />
              {locationName}
            </span>
          ) : null}
          <span>
            <Shield size={15} />
            {visibilityLabel}
          </span>
        </div>
        <MemoryReactions
          memory={memory}
          uid={user?.uid ?? null}
          onReacted={floatEmoji}
          onRequireLogin={() => requestLogin(null)}
        />
      </aside>

      <div className="expanded-gallery">
        {floatingEmoji ? (
          <span className="floating-emoji expanded-floating-emoji" key={floatingEmoji.id}>
            {floatingEmoji.emoji}
          </span>
        ) : null}
        <div className="expanded-gallery-image">
          {photos[photoIndex] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" src={photos[photoIndex]} />
          ) : (
            <MapPin size={56} />
          )}
        </div>
        {photos.length > 1 ? (
          <>
            <button
              aria-label="Previous photo"
              className="icon-button expanded-gallery-arrow expanded-gallery-arrow-left"
              onClick={() => setPhotoIndex((index) => (index === 0 ? photos.length - 1 : index - 1))}
              type="button"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              aria-label="Next photo"
              className="icon-button expanded-gallery-arrow expanded-gallery-arrow-right"
              onClick={() => setPhotoIndex((index) => (index + 1) % photos.length)}
              type="button"
            >
              <ChevronRight size={20} />
            </button>
            <span className="expanded-gallery-counter">
              {photoIndex + 1} / {photos.length}
            </span>
          </>
        ) : null}
      </div>
    </section>
  );
}
