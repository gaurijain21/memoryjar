"use client";

import { Calendar, ChevronLeft, ChevronRight, Lock, MapPin, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MemoryReactions } from "@/components/Memory/MemoryReactions";
import { ShareMemoryButton } from "@/components/Memory/ShareMemoryButton";
import { useApp } from "@/contexts/AppContext";
import { formatMemoryDate } from "@/lib/formatDate";
import { getMemoryExpandedHref } from "@/lib/expandedMemory";
import { getReadableLocationName } from "@/lib/locationText";
import type { AggregateMarker } from "@/types/memory";
import Link from "next/link";

type AggregateDetailPanelProps = {
  marker: AggregateMarker | null;
  onClose: () => void;
  onPublicPreviewAttempt: (markerId: string, previewId: string) => boolean;
};

export function AggregateDetailPanel({ marker, onClose, onPublicPreviewAttempt }: AggregateDetailPanelProps) {
  const { user, requestLogin } = useApp();
  const [previewIndex, setPreviewIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [floatingEmoji, setFloatingEmoji] = useState<{ id: number; emoji: string } | null>(null);

  useEffect(() => {
    setPreviewIndex(0);
    setPhotoIndex(0);
  }, [marker?.id]);

  useEffect(() => {
    setPhotoIndex(0);
  }, [previewIndex]);

  const floatEmoji = (emoji: string) => {
    const id = Date.now();
    setFloatingEmoji({ id, emoji });
    window.setTimeout(() => {
      setFloatingEmoji((current) => current?.id === id ? null : current);
    }, 1400);
  };

  if (!marker) return null;
  const previewItems = marker.previewItems?.length
    ? marker.previewItems
    : marker.previewMemory
      ? [{
        id: marker.previewMemory.id,
        type: marker.previewMemory.groupId ? "group" as const : marker.previewMemory.audience === "public" ? "public" as const : "private" as const,
        memory: marker.previewMemory,
      }]
      : [];
  const activePreviewIndex = Math.min(previewIndex, Math.max(previewItems.length - 1, 0));
  const activeItem = previewItems[activePreviewIndex] ?? null;
  const previewMemory = activeItem?.memory ?? null;
  const publicCount = marker.publicCount ?? 0;
  const privateCount = marker.privateCount ?? 0;
  const groupCount = marker.groupCount ?? 0;
  const previewKind = activeItem?.type ?? (previewMemory?.groupId
    ? "group"
    : previewMemory?.audience === "public"
      ? "public"
      : "private");
  const canShowPreview = Boolean(previewMemory);
  const visibilityLabel = canShowPreview
    ? previewKind === "group"
      ? (previewMemory?.groupName ?? "Group memory")
      : previewKind === "public"
        ? "Public memory"
        : "Private memory"
    : groupCount > 0 && publicCount === 0
      ? "Group memory"
      : privateCount > 0 && publicCount === 0
        ? "Private memory"
        : publicCount > 0
          ? "Public memory"
          : "Private memory";
  const showMemoryCarousel = previewItems.length > 1;
  const previewCounter = showMemoryCarousel ? `${activePreviewIndex + 1} of ${previewItems.length}` : "";
  const goToPreview = (direction: -1 | 1) => {
    if (!previewItems.length) return;
    const nextIndex = (activePreviewIndex + direction + previewItems.length) % previewItems.length;
    const nextItem = previewItems[nextIndex];

    if (nextItem.type === "public" && !onPublicPreviewAttempt(marker.id, nextItem.id)) {
      return;
    }

    setPreviewIndex(nextIndex);
  };
  const carouselControls = showMemoryCarousel ? (
    <div className="aggregate-memory-controls" aria-label="Memory previews at this location">
      <button
        aria-label="Previous memory"
        className="icon-button"
        onClick={() => goToPreview(-1)}
        type="button"
      >
        <ChevronLeft size={17} />
      </button>
      <span>{previewCounter}</span>
      <button
        aria-label="Next memory"
        className="icon-button"
        onClick={() => goToPreview(1)}
        type="button"
      >
        <ChevronRight size={17} />
      </button>
    </div>
  ) : null;

  if (previewMemory && canShowPreview) {
    console.info("[DEBUG everyone] aggregate panel showing preview", {
      markerId: marker.id,
      previewId: previewMemory.id,
      audience: previewKind,
      previewIndex: activePreviewIndex,
      previewItemCount: previewItems.length,
      label: visibilityLabel,
      hasImage: Boolean(previewMemory.photoUrls[photoIndex]),
    });
    const date = formatMemoryDate(previewMemory.date, "long");
    const memoryLocation = getReadableLocationName(previewMemory.locationName);

    return (
      <>
      <aside className="detail-panel aggregate-detail-panel">
        <div className="detail-title-row">
          <h2>{previewMemory.title}</h2>
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
          {previewMemory.photoUrls.length > 1 ? (
            <button
              aria-label="Previous photo"
              className="icon-button detail-carousel-arrow detail-carousel-arrow-left"
              onClick={() => setPhotoIndex((index) => (index === 0 ? previewMemory.photoUrls.length - 1 : index - 1))}
              type="button"
            >
              <ChevronLeft size={17} />
            </button>
          ) : <span className="detail-carousel-spacer" />}

          <div className="detail-photo">
            {previewMemory.photoUrls[photoIndex] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" src={previewMemory.photoUrls[photoIndex]} />
            ) : (
              <MapPin size={40} />
            )}
            <ShareMemoryButton memory={previewMemory} />
          </div>

          {previewMemory.photoUrls.length > 1 ? (
            <button
              aria-label="Next photo"
              className="icon-button detail-carousel-arrow detail-carousel-arrow-right"
              onClick={() => setPhotoIndex((index) => (index + 1) % previewMemory.photoUrls.length)}
              type="button"
            >
              <ChevronRight size={17} />
            </button>
          ) : <span className="detail-carousel-spacer" />}
        </div>
        {carouselControls}

        <div className="detail-copy">
          <h3>{previewMemory.title}</h3>
          {previewMemory.description ? <p>{previewMemory.description}</p> : null}
          <div className="detail-meta">
            {date ? (
              <span>
                <Calendar size={15} />
                {date}
              </span>
            ) : null}
            {memoryLocation ? (
              <span>
                <MapPin size={15} />
                {memoryLocation}
              </span>
            ) : null}
            <span>{visibilityLabel}</span>
            {previewMemory.vibes?.length ? (
              <span>
                <Sparkles size={15} />
                {previewMemory.vibes.slice(0, 3).join(", ")}
              </span>
            ) : null}
          </div>
          <MemoryReactions
            memory={previewMemory}
            uid={user?.uid ?? null}
            onReacted={floatEmoji}
            onRequireLogin={() => requestLogin(null)}
          />
          <Link
            className="expanded-view-button"
            href={getMemoryExpandedHref(previewMemory)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open expanded view for ${previewMemory.title} in a new tab`}
          >
            Expanded View
          </Link>
        </div>
      </aside>
      </>
    );
  }

  console.info("[DEBUG everyone] aggregate panel privacy message", {
    markerId: marker.id,
    previewId: activeItem?.id ?? null,
    previewType: activeItem?.type ?? null,
    previewIndex: activePreviewIndex,
    previewItemCount: previewItems.length,
    count: marker.count,
    publicCount,
    privateCount,
    groupCount,
    label: visibilityLabel,
    reason: publicCount > 0
      ? "public aggregate has no readable public preview yet"
      : groupCount > 0
        ? "group memory is not readable by this user"
        : "private memory is not readable by this user",
  });

  return (
    <aside className="detail-panel aggregate-detail-panel">
      <div className="detail-title-row">
        <h2>This moment is private.</h2>
        <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
          <X size={17} />
        </button>
      </div>
      <div className="private-memory-notice">
        <Lock size={28} />
        <span className="private-memory-label">{visibilityLabel}</span>
        <p>This memory circle is visible, but the photo and details belong only to its owner.</p>
      </div>
      {carouselControls}
    </aside>
  );
}
