"use client";

import { useEffect, useState } from "react";
import { MapPin, Users, X } from "lucide-react";
import type { AggregateMarker } from "@/types/memory";

type AggregateDetailPanelProps = {
  marker: AggregateMarker | null;
  onClose: () => void;
};

export function AggregateDetailPanel({ marker, onClose }: AggregateDetailPanelProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [placePhotoUrl, setPlacePhotoUrl] = useState("");

  useEffect(() => {
    setImageFailed(false);
    setPlacePhotoUrl("");
    if (!marker?.placeId || !window.google?.maps?.importLibrary) return;

    let cancelled = false;

    async function loadPlacePhoto() {
      try {
        const placesLibrary = await google.maps.importLibrary("places") as {
          Place?: new (options: { id: string }) => {
            photos?: Array<{ getURI?: (options?: { maxWidthPx?: number; maxHeightPx?: number }) => string }>;
            fetchFields: (request: { fields: string[] }) => Promise<void>;
          };
        };
        if (!placesLibrary.Place || !marker?.placeId) return;

        const place = new placesLibrary.Place({ id: marker.placeId });
        await place.fetchFields({ fields: ["photos"] });
        const photoUrl = place.photos?.[0]?.getURI?.({ maxWidthPx: 420, maxHeightPx: 220 });
        if (!cancelled && photoUrl) setPlacePhotoUrl(photoUrl);
      } catch (error) {
        console.warn("[MemoryJar places] Place photo lookup failed.", error);
      }
    }

    loadPlacePhoto();

    return () => {
      cancelled = true;
    };
  }, [marker?.id, marker?.placeId]);

  if (!marker) return null;

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const fallbackMapImageUrl = mapsKey && marker.placeId
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${marker.lat},${marker.lng}&zoom=12&size=420x220&maptype=roadmap&markers=color:yellow%7C${marker.lat},${marker.lng}&key=${mapsKey}`
    : "";
  const imageUrl = placePhotoUrl || fallbackMapImageUrl;
  const displayName = marker.placeName || marker.formattedAddress || marker.locationName || "Memory location";

  return (
    <aside className="detail-panel aggregate-detail-panel">
      <div className="detail-title-row">
        <h2>{displayName}</h2>
        <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
          <X size={17} />
        </button>
      </div>

      {imageUrl && !imageFailed ? (
        <div className="aggregate-place-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" onError={() => setImageFailed(true)} src={imageUrl} />
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
