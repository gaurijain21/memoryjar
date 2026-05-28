"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ImagePlus, Info, MapPin, MousePointer2, Trash2, X } from "lucide-react";
import { PlaceSearch } from "@/components/Map/PlaceSearch";
import type { Group, Memory, MemoryAudience, MemoryDestination, MemoryInput, SelectedLocation } from "@/types/memory";

type AddMemoryModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  editingMemory?: Memory | null;
  selectedLocation?: SelectedLocation | null;
  pinDropMode: boolean;
  groups: Group[];
  defaultDestination: MemoryDestination;
  onLocationSelected: (location: SelectedLocation) => void;
  onRequestPinDrop: () => void;
  onClose: () => void;
  onSubmit: (
    input: MemoryInput,
    photos: File[],
    photoUrlsToKeep: string[],
    options: { destination: MemoryDestination; audience: MemoryAudience },
  ) => Promise<void>;
};

export function AddMemoryModal({
  isOpen,
  isSaving,
  editingMemory,
  selectedLocation,
  pinDropMode,
  groups,
  defaultDestination,
  onLocationSelected,
  onRequestPinDrop,
  onClose,
  onSubmit,
}: AddMemoryModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [locationName, setLocationName] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrlsToKeep, setPhotoUrlsToKeep] = useState<string[]>([]);
  const [destination, setDestination] = useState<MemoryDestination>("my-memories");
  const [audience, setAudience] = useState<MemoryAudience>("private");
  const [showAudienceInfo, setShowAudienceInfo] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const editingDestination = editingMemory?.groupId
      ? (`group-${editingMemory.groupId}` as MemoryDestination)
      : "my-memories";

    setTitle(editingMemory?.title ?? "");
    setDescription(editingMemory?.description ?? "");
    const [savedYear = "", savedMonth = ""] = (editingMemory?.date ?? "").split("-");
    setYear(savedYear || new Date().getFullYear().toString());
    setMonth(savedMonth);
    setLocationName(editingMemory?.locationName ?? "");
    setPhotos([]);
    setPhotoUrlsToKeep(editingMemory?.photoUrls ?? []);
    setDestination(editingMemory ? editingDestination : defaultDestination);
    setAudience(editingMemory?.audience ?? "private");
    setShowAudienceInfo(false);
    setValidationError("");
  }, [defaultDestination, editingMemory, isOpen]);

  useEffect(() => {
    if (selectedLocation?.locationName) {
      setLocationName(selectedLocation.locationName);
    }
  }, [selectedLocation]);

  const previewUrls = useMemo(
    () => photos.map((photo) => URL.createObjectURL(photo)),
    [photos],
  );

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasLocation = Boolean(selectedLocation || editingMemory);
    const hasImage = photos.length > 0 || photoUrlsToKeep.length > 0;
    const hasDate = Boolean(month.trim() && year.trim());
    const hasDestination = Boolean(destination);
    const hasVisibility = destination !== "my-memories" || Boolean(audience);

    if (!hasLocation) {
      setValidationError("Choose a location before saving.");
      return;
    }

    if (!hasDestination) {
      setValidationError("Choose where to add this memory.");
      return;
    }

    if (!title.trim()) {
      setValidationError("Add a title before saving.");
      return;
    }

    if (!hasDate) {
      setValidationError("Add a month and year before saving.");
      return;
    }

    if (!hasVisibility) {
      setValidationError("Choose Private or Public before saving.");
      return;
    }

    if (!hasImage) {
      setValidationError("Add at least one image before saving.");
      return;
    }

    const location = selectedLocation ?? editingMemory;
    if (!location) return;

    const normalizedDate = month ? `${year}-${month}` : year;
    setValidationError("");

    await onSubmit(
      {
        title: title.trim(),
        description: description.trim(),
        date: normalizedDate,
        locationName: locationName || location.locationName,
        lat: location.lat,
        lng: location.lng,
        formattedAddress: location.formattedAddress ?? editingMemory?.formattedAddress ?? null,
        locationSource: location.locationSource ?? editingMemory?.locationSource ?? "pin",
        placeId: location.placeId ?? editingMemory?.placeId ?? null,
        placeName: location.placeName ?? editingMemory?.placeName ?? null,
        placePhotoReference: location.placePhotoReference ?? editingMemory?.placePhotoReference ?? null,
        photoUrls: photoUrlsToKeep,
        storagePaths: editingMemory?.storagePaths ?? [],
        audience: destination === "my-memories" ? audience : "private",
        groupId: destination.startsWith("group-") ? destination.replace("group-", "") : null,
      },
      photos,
      photoUrlsToKeep,
      {
        destination,
        audience: destination === "my-memories" ? audience : "private",
      },
    );
  };

  return (
    <div className="drawer-layer">
      <form className={`memory-modal ${pinDropMode ? "pin-mode" : ""}`} noValidate onSubmit={handleSubmit}>
        <div className="modal-title-row">
          <div>
            <p className="eyebrow">{editingMemory ? "Edit memory" : "Capture life, drop a pin!"}</p>
            <h2>{editingMemory ? editingMemory.title : "ADD MEMORY"}</h2>
          </div>
          <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-location-tools">
          <span className="section-label">Location</span>
          <PlaceSearch
            className="drawer-place-search"
            onPlaceSelected={(location) => {
              onLocationSelected(location);
              setLocationName(location.locationName);
            }}
            placeholder="Search location"
          />
          <button
            className={`drop-pin-button ${pinDropMode ? "active" : ""}`}
            onClick={onRequestPinDrop}
            type="button"
          >
            <MousePointer2 size={16} />
            {pinDropMode ? "Click on the map" : "Drop pin on map"}
          </button>
          <p className="drop-pin-mobile-note">Drop pin is available on desktop. Use search on mobile.</p>
        </div>

        {(selectedLocation || editingMemory) && locationName ? (
          <div className="location-chip">
            <MapPin size={16} />
            <span>{locationName}</span>
          </div>
        ) : null}

        <label>
          <span>Add to</span>
          <select
            className="memory-select"
            disabled={Boolean(editingMemory)}
            onChange={(event) => setDestination(event.target.value as MemoryDestination)}
            required
            value={destination}
          >
            <option value="my-memories">My Memories</option>
            {groups.map((group) => (
              <option key={group.id} value={`group-${group.id}`}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        {destination === "my-memories" ? (
          <div className="audience-field">
            <span className="section-label">Visibility</span>
            <div className="audience-toggle-row">
              <span>Private</span>
              <button
                aria-label="Toggle memory visibility"
                aria-pressed={audience === "public"}
                className={`audience-switch ${audience === "public" ? "public" : "private"}`}
                onClick={() => setAudience((current) => current === "private" ? "public" : "private")}
                type="button"
              >
                <span />
              </button>
              <span>Public</span>
              <button
                className="audience-info"
                aria-label="Show visibility info"
                onClick={() => setShowAudienceInfo((current) => !current)}
                type="button"
              >
                <Info size={14} />
              </button>
            </div>
            {showAudienceInfo ? (
              <div className="audience-inline-info">
                <p>Private: only you can see this memory.</p>
                <p>Public: visible in Everyone&apos;s Memories.</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="audience-note">
            This memory will be visible only to members of the selected group.
          </p>
        )}

        <label>
          <span>Title</span>
          <input
            maxLength={50}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Late night beach drive"
            required
            value={title}
          />
        </label>

        <label>
          <span>Description</span>
          <textarea
            maxLength={150}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="We stayed here until midnight talking about life and eating fries."
            rows={2}
            value={description}
          />
        </label>

        <div className="form-grid">
          <label>
            <span>Month</span>
          <input
              max="12"
              min="01"
              onBlur={() => setMonth((current) => current ? current.padStart(2, "0") : "")}
              onChange={(event) => setMonth(event.target.value.slice(0, 2))}
              placeholder="06"
              required
              type="number"
              value={month}
            />
          </label>
          <label>
            <span>Year</span>
            <input
              max="9999"
              min="1"
              onChange={(event) => setYear(event.target.value)}
              placeholder="2026"
              required
              type="number"
              value={year}
            />
          </label>
        </div>

        <label className="photo-picker">
          <ImagePlus size={18} />
          <span>Add photos</span>
          <input
            accept="image/*"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              const remainingSlots = Math.max(10 - photoUrlsToKeep.length, 0);
              setPhotos(files.slice(0, remainingSlots));
            }}
            type="file"
          />
        </label>

        <div className="photo-preview-grid">
          {photoUrlsToKeep.map((url) => (
            <div className="photo-preview" key={url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={url} />
              <button
                aria-label="Remove photo"
                onClick={() =>
                  setPhotoUrlsToKeep((current) => current.filter((item) => item !== url))
                }
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {previewUrls.map((url) => (
            <div className="photo-preview" key={url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={url} />
            </div>
          ))}
        </div>

        {validationError ? <p className="memory-validation-error">{validationError}</p> : null}

        <button
          className="primary-button"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving..." : editingMemory ? "Update memory" : "Save memory"}
        </button>
      </form>
    </div>
  );
}
