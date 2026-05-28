"use client";

import { useEffect, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import { formatMemoryDate } from "@/lib/formatDate";
import { getReadableLocationName } from "@/lib/locationText";
import { ExpandedMemoryModal } from "@/components/Memory/ExpandedMemoryModal";
import type { Memory } from "@/types/memory";

type MemoryDetailPanelProps = {
  memory: Memory | null;
  onClose: () => void;
};

export function MemoryDetailPanel({
  memory,
  onClose,
}: MemoryDetailPanelProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setPhotoIndex(0);
    setIsExpanded(false);
  }, [memory?.id]);

  if (!memory) return null;

  const date = formatMemoryDate(memory.date, "long");
  const photos = memory.photoUrls;
  const locationName = getReadableLocationName(memory.locationName);

  const visibilityLabel = memory.groupId
    ? (memory.groupName ?? "Group memory")
    : memory.audience === "public"
      ? "Public memory"
      : "Private memory";

  return (
    <>
      <aside className="detail-panel">
        <div className="detail-title-row">
          <h2>{memory.title}</h2>
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
        </div>
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

        <div className="detail-copy">
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
          </div>
          <button className="expanded-view-button" onClick={() => setIsExpanded(true)} type="button">
            Expanded View
          </button>
        </div>
      </aside>
      {isExpanded ? (
        <ExpandedMemoryModal memory={memory} visibilityLabel={visibilityLabel} onClose={() => setIsExpanded(false)} />
      ) : null}
    </>
  );
}
