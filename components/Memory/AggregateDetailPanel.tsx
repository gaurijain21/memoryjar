"use client";

import { useState } from "react";
import { MapPin, Users, X } from "lucide-react";
import type { AggregateMarker } from "@/types/memory";

type AggregateDetailPanelProps = {
  marker: AggregateMarker | null;
  onClose: () => void;
};

export function AggregateDetailPanel({ marker, onClose }: AggregateDetailPanelProps) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!marker) return null;

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapImageUrl = mapsKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${marker.lat},${marker.lng}&zoom=12&size=420x220&maptype=roadmap&markers=color:yellow%7C${marker.lat},${marker.lng}&key=${mapsKey}`
    : "";

  return (
    <aside className="detail-panel aggregate-detail-panel">
      <div className="detail-title-row">
        <h2>{marker.locationName || "Memory location"}</h2>
        <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
          <X size={17} />
        </button>
      </div>

      {mapImageUrl && !imageFailed ? (
        <div className="aggregate-place-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" onError={() => setImageFailed(true)} src={mapImageUrl} />
        </div>
      ) : (
        <div className="aggregate-place-image aggregate-place-placeholder">
          <MapPin size={34} />
        </div>
      )}

      <div className="detail-copy">
        <div className="detail-meta">
          <span>
            <Users size={15} />
            {marker.count} {marker.count === 1 ? "person made" : "people made"} memories here
          </span>
        </div>
      </div>
    </aside>
  );
}
