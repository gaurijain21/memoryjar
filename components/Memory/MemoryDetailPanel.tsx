"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, MapPin, Sparkles, X } from "lucide-react";
import { MemoryReactions } from "@/components/Memory/MemoryReactions";
import { ShareMemoryButton } from "@/components/Memory/ShareMemoryButton";
import { useApp } from "@/contexts/AppContext";
import { formatMemoryDate } from "@/lib/formatDate";
import { getReadableLocationName } from "@/lib/locationText";
import { getMemoryExpandedHref } from "@/lib/expandedMemory";
import type { Memory } from "@/types/memory";

type MemoryDetailPanelProps = {
  memory: Memory | null;
  onClose: () => void;
};

export function MemoryDetailPanel({
  memory,
  onClose,
}: MemoryDetailPanelProps) {
  const { user, requestLogin } = useApp();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [floatingEmoji, setFloatingEmoji] = useState<{ id: number; emoji: string } | null>(null);

  useEffect(() => {
    setPhotoIndex(0);
  }, [memory?.id]);

  if (!memory) return null;

  const date = formatMemoryDate(memory.date, "long");
  const photos = memory.photoUrls;
  const locationName = getReadableLocationName(memory.locationName);

  const expandedHref = getMemoryExpandedHref(memory);
  const floatEmoji = (emoji: string) => {
    const id = Date.now();
    setFloatingEmoji({ id, emoji });
    window.setTimeout(() => {
      setFloatingEmoji((current) => current?.id === id ? null : current);
    }, 1400);
  };

  return (
    <aside className="detail-panel">
        <div className="detail-title-row">
          <h2>{memory.title}</h2>
          <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
            <X size={17} />
          </button>
        </div>

        <div className="detail-photo-row">
          {floatingEmoji ? (
            <span className="floating-emoji detail-floating-emoji" key={floatingEmoji.id}>
              {floatingEmoji.emoji}
            </span>
          ) : null}
          {photos.length > 1 ? (
            <button
              aria-label="Previous photo"
              className="icon-button detail-carousel-arrow detail-carousel-arrow-left"
              onClick={() => setPhotoIndex((index) => (index === 0 ? photos.length - 1 : index - 1))}
              type="button"
            >
              <ChevronLeft size={17} />
            </button>
          ) : <span className="detail-carousel-spacer" />}

          <div className="detail-photo">
            {photos[photoIndex] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" src={photos[photoIndex]} />
            ) : (
              <MapPin size={40} />
            )}
            <ShareMemoryButton memory={memory} />
          </div>

          {photos.length > 1 ? (
            <button
              aria-label="Next photo"
              className="icon-button detail-carousel-arrow detail-carousel-arrow-right"
              onClick={() => setPhotoIndex((index) => (index + 1) % photos.length)}
              type="button"
            >
              <ChevronRight size={17} />
            </button>
          ) : <span className="detail-carousel-spacer" />}
        </div>

        <div className="detail-copy">
          <h3>{memory.title}</h3>
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
            {memory.vibes?.length ? (
              <span>
                <Sparkles size={15} />
                {memory.vibes.slice(0, 3).join(", ")}
              </span>
            ) : null}
          </div>
          <MemoryReactions
            memory={memory}
            uid={user?.uid ?? null}
            onReacted={floatEmoji}
            onRequireLogin={() => requestLogin(null)}
          />
          <Link
            className="expanded-view-button"
            href={expandedHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open expanded view for ${memory.title} in a new tab`}
          >
            Expanded View
          </Link>
        </div>
      </aside>
  );
}
