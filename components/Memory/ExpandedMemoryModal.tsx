"use client";

import { Calendar, ChevronLeft, ChevronRight, MapPin, Shield, X } from "lucide-react";
import { useState } from "react";
import { formatMemoryDate } from "@/lib/formatDate";
import { getReadableLocationName } from "@/lib/locationText";
import type { Memory } from "@/types/memory";

type ExpandedMemoryModalProps = {
  memory: Memory;
  visibilityLabel: string;
  onClose: () => void;
};

export function ExpandedMemoryModal({ memory, visibilityLabel, onClose }: ExpandedMemoryModalProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = memory.photoUrls;
  const date = formatMemoryDate(memory.date, "long");
  const locationName = getReadableLocationName(memory.locationName);

  return (
    <div className="expanded-memory-layer">
      <section className="expanded-memory-modal" role="dialog" aria-modal="true">
        <button aria-label="Close expanded view" className="icon-button expanded-close" onClick={onClose} type="button">
          <X size={18} />
        </button>

        <aside className="expanded-memory-details">
          <h2>{memory.title}</h2>
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
        </aside>

        <div className="expanded-gallery">
          {photos.length > 1 ? (
            <button
              aria-label="Previous photo"
              className="icon-button expanded-gallery-arrow"
              onClick={() => setPhotoIndex((index) => (index === 0 ? photos.length - 1 : index - 1))}
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
          ) : null}
          <div className="expanded-gallery-image">
            {photos[photoIndex] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" src={photos[photoIndex]} />
            ) : (
              <MapPin size={48} />
            )}
          </div>
          {photos.length > 1 ? (
            <button
              aria-label="Next photo"
              className="icon-button expanded-gallery-arrow"
              onClick={() => setPhotoIndex((index) => (index + 1) % photos.length)}
              type="button"
            >
              <ChevronRight size={18} />
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
