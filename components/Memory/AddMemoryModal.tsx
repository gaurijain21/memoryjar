"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ImagePlus, MapPin, MousePointer2, Trash2, X } from "lucide-react";
import { PlaceSearch } from "@/components/Map/PlaceSearch";
import type { Memory, MemoryInput, SelectedLocation } from "@/types/memory";

type AddMemoryModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  editingMemory?: Memory | null;
  selectedLocation?: SelectedLocation | null;
  pinDropMode: boolean;
  onLocationSelected: (location: SelectedLocation) => void;
  onRequestPinDrop: () => void;
  onClose: () => void;
  onSubmit: (
    input: MemoryInput,
    photos: File[],
    photoUrlsToKeep: string[],
  ) => Promise<void>;
};

export function AddMemoryModal({
  isOpen,
  isSaving,
  editingMemory,
  selectedLocation,
  pinDropMode,
  onLocationSelected,
  onRequestPinDrop,
  onClose,
  onSubmit,
}: AddMemoryModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [locationName, setLocationName] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrlsToKeep, setPhotoUrlsToKeep] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(editingMemory?.title ?? "");
    setDescription(editingMemory?.description ?? "");
    setDate(editingMemory?.date ?? new Date().toISOString().slice(0, 10));
    setLocationName(editingMemory?.locationName ?? selectedLocation?.locationName ?? "");
    setPhotos([]);
    setPhotoUrlsToKeep(editingMemory?.photoUrls ?? []);
  }, [editingMemory, isOpen, selectedLocation]);

  useEffect(() => {
    if (selectedLocation?.locationName) {
      setLocationName((current) =>
        current && current !== "Dropped pin" ? current : selectedLocation.locationName,
      );
    }
  }, [selectedLocation]);

  const previewUrls = useMemo(
    () => photos.map((photo) => URL.createObjectURL(photo)),
    [photos],
  );

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !date || (!selectedLocation && !editingMemory)) return;

    const location = selectedLocation ?? editingMemory;
    if (!location) return;

    await onSubmit(
      {
        title,
        description,
        date,
        locationName: locationName || location.locationName,
        lat: location.lat,
        lng: location.lng,
        photoUrls: photoUrlsToKeep,
        storagePaths: editingMemory?.storagePaths ?? [],
      },
      photos,
      photoUrlsToKeep,
    );
  };

  return (
    <div className="drawer-layer">
      <form className={`memory-modal ${pinDropMode ? "pin-mode" : ""}`} onSubmit={handleSubmit}>
        <div className="modal-title-row">
          <div>
            <p className="eyebrow">{editingMemory ? "Edit memory" : "Add a Memory"}</p>
            <h2>{editingMemory ? editingMemory.title : "Save this place"}</h2>
          </div>
          <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <label>
          <span>Title</span>
          <input
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </label>

        <label>
          <span>Description</span>
          <textarea
            maxLength={220}
            onChange={(event) => setDescription(event.target.value)}
            required
            rows={2}
            value={description}
          />
        </label>

        <div className="form-grid">
          <label>
            <span>Date</span>
            <input
              onChange={(event) => setDate(event.target.value)}
              required
              type="date"
              value={date}
            />
          </label>
          <label>
            <span>Location name</span>
            <input
              onChange={(event) => setLocationName(event.target.value)}
              placeholder="Search or drop a pin"
              required
              value={locationName}
            />
          </label>
        </div>

        <div className="drawer-location-tools">
          <PlaceSearch
            className="drawer-place-search"
            onPlaceSelected={(location) => {
              onLocationSelected(location);
              setLocationName(location.locationName);
            }}
            placeholder="Search place for this memory"
          />
          <button
            className={`drop-pin-button ${pinDropMode ? "active" : ""}`}
            onClick={onRequestPinDrop}
            type="button"
          >
            <MousePointer2 size={16} />
            {pinDropMode ? "Click on the map" : "Drop pin on map"}
          </button>
        </div>

        <div className="location-chip">
          <MapPin size={16} />
          {selectedLocation || editingMemory
            ? `${(selectedLocation ?? editingMemory)?.lat.toFixed(4)}, ${(selectedLocation ?? editingMemory)?.lng.toFixed(4)}`
            : "Search above or click the map to choose a location"}
        </div>

        <label className="photo-picker">
          <ImagePlus size={18} />
          <span>Add photos</span>
          <input
            accept="image/*"
            multiple
            onChange={(event) => setPhotos(Array.from(event.target.files ?? []))}
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

        <button
          className="primary-button"
          disabled={isSaving || !title.trim() || !date || (!selectedLocation && !editingMemory)}
          type="submit"
        >
          {isSaving ? "Saving..." : editingMemory ? "Update memory" : "Save memory"}
        </button>
      </form>
    </div>
  );
}
