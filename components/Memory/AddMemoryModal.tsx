"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Baby,
  BookOpen,
  Camera,
  Check,
  Coffee,
  Heart,
  ImagePlus,
  Laptop,
  Leaf,
  MapPin,
  Music,
  Palette,
  PartyPopper,
  Plane,
  Plus,
  Smile,
  Sparkles,
  Sprout,
  Star,
  Trophy,
  Trash2,
  Users,
  Utensils,
  X,
  Zap,
} from "lucide-react";
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

type VisibilityChoice = "just-me" | "group" | "everyone";

const defaultVibes = [
  { label: "Travel", icon: Plane },
  { label: "Adventure", icon: Sprout },
  { label: "Learning", icon: BookOpen },
  { label: "Achievement", icon: Trophy },
  { label: "Friends", icon: Users },
  { label: "Family", icon: Baby },
  { label: "Self Care", icon: Heart },
  { label: "Food", icon: Utensils },
  { label: "Nature", icon: Leaf },
  { label: "Creativity", icon: Palette },
  { label: "Music", icon: Music },
  { label: "Work", icon: Laptop },
  { label: "Love", icon: Heart },
  { label: "Fun", icon: PartyPopper },
  { label: "Chill", icon: Coffee },
  { label: "Reflection", icon: Star },
];

const defaultFeelings = ["Happy", "Grateful", "Peaceful", "Excited", "Nostalgic", "Proud"];

function toDateInputValue(date: string | undefined) {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  if (!year || !month) return "";
  return `${year}-${month.padStart(2, "0")}-${(day || "01").padStart(2, "0")}`;
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/");
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|m4v|webm|ogg)(\?|$)/i.test(url);
}

export function AddMemoryModal({
  isOpen,
  isSaving,
  editingMemory,
  selectedLocation,
  groups,
  defaultDestination,
  onLocationSelected,
  onClose,
  onSubmit,
}: AddMemoryModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [locationName, setLocationName] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrlsToKeep, setPhotoUrlsToKeep] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<VisibilityChoice>("just-me");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [customVibe, setCustomVibe] = useState("");
  const [feeling, setFeeling] = useState("");
  const [customFeeling, setCustomFeeling] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const editingGroupId = editingMemory?.groupId ?? "";
    const nextVisibility: VisibilityChoice = editingGroupId
      ? "group"
      : editingMemory?.audience === "public"
        ? "everyone"
        : defaultDestination.startsWith("group-")
          ? "group"
          : "just-me";
    const defaultGroupId = defaultDestination.startsWith("group-")
      ? defaultDestination.replace("group-", "")
      : "";

    setTitle(editingMemory?.title ?? "");
    setDescription(editingMemory?.description ?? "");
    setDate(toDateInputValue(editingMemory?.date));
    setLocationName(editingMemory?.locationName ?? "");
    setPhotos([]);
    setPhotoUrlsToKeep(editingMemory?.photoUrls ?? []);
    setVisibility(nextVisibility);
    setSelectedGroupId(editingGroupId || defaultGroupId || groups[0]?.id || "");
    setSelectedVibes(editingMemory?.vibes ?? []);
    setCustomVibe("");
    setFeeling(editingMemory?.feeling ?? "");
    setCustomFeeling("");
    setTermsAccepted(false);
    setValidationError("");
  }, [defaultDestination, editingMemory, groups, isOpen]);

  useEffect(() => {
    if (selectedLocation?.locationName) {
      setLocationName(selectedLocation.locationName);
    }
  }, [selectedLocation]);

  const previewUrls = useMemo(
    () => photos.map((photo) => ({ file: photo, url: URL.createObjectURL(photo) })),
    [photos],
  );

  useEffect(() => {
    return () => {
      previewUrls.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previewUrls]);

  if (!isOpen) return null;

  const selectedFileCount = photos.length + photoUrlsToKeep.length;
  const remainingFileSlots = Math.max(10 - selectedFileCount, 0);
  const isGroupVisibility = visibility === "group";
  const destination: MemoryDestination = isGroupVisibility && selectedGroupId
    ? (`group-${selectedGroupId}` as MemoryDestination)
    : "my-memories";
  const audience: MemoryAudience = visibility === "everyone" ? "public" : "private";
  const canSubmit = termsAccepted && !isSaving;

  const toggleVibe = (vibe: string) => {
    setSelectedVibes((current) =>
      current.includes(vibe)
        ? current.filter((item) => item !== vibe)
        : [...current, vibe],
    );
  };

  const addCustomVibe = () => {
    const next = customVibe.trim();
    if (!next) return;
    setSelectedVibes((current) => current.includes(next) ? current : [...current, next]);
    setCustomVibe("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const location = selectedLocation ?? editingMemory;

    if (!location) {
      setValidationError("Search and select a location first.");
      return;
    }

    if (!title.trim()) {
      setValidationError("Give this memory a title.");
      return;
    }

    if (!date) {
      setValidationError("Pick the date this happened.");
      return;
    }

    if (visibility === "group" && !selectedGroupId) {
      setValidationError("Choose a group or switch visibility.");
      return;
    }

    if (!termsAccepted) {
      setValidationError("Accept the Terms & Conditions to save.");
      return;
    }

    setValidationError("");

    await onSubmit(
      {
        title: title.trim(),
        description: description.trim(),
        date,
        locationName: locationName || location.locationName,
        lat: location.lat,
        lng: location.lng,
        formattedAddress: location.formattedAddress ?? editingMemory?.formattedAddress ?? null,
        locationSource: location.locationSource ?? editingMemory?.locationSource ?? "search",
        placeId: location.placeId ?? editingMemory?.placeId ?? null,
        placeName: location.placeName ?? editingMemory?.placeName ?? null,
        placePhotoReference: location.placePhotoReference ?? editingMemory?.placePhotoReference ?? null,
        photoUrls: photoUrlsToKeep,
        storagePaths: editingMemory?.storagePaths ?? [],
        audience: destination === "my-memories" ? audience : "private",
        groupId: destination.startsWith("group-") ? destination.replace("group-", "") : null,
        vibes: selectedVibes,
        feeling: (customFeeling.trim() || feeling || null),
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
    <div className="drawer-layer" onMouseDown={onClose}>
      <form
        className="memory-modal social-memory-modal"
        noValidate
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-title-row">
          <div>
            <p className="eyebrow">{editingMemory ? "Edit memory" : "Post a memory"}</p>
            <h2>{editingMemory ? editingMemory.title : "Add a Memory"}</h2>
          </div>
          <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <section className="memory-form-section">
          <SectionHeader icon={<MapPin size={16} />} title="Where did this happen?" />
          <PlaceSearch
            className="drawer-place-search"
            onPlaceSelected={(location) => {
              onLocationSelected(location);
              setLocationName(location.locationName);
            }}
            placeholder="Search a place, city, cafe..."
          />
          {(selectedLocation || editingMemory) && locationName ? (
            <div className="selected-place-card">
              <MapPin size={17} />
              <div>
                <strong>{locationName}</strong>
                <span>{selectedLocation?.formattedAddress ?? editingMemory?.formattedAddress ?? "Selected location"}</span>
              </div>
              <Check size={17} />
            </div>
          ) : null}
        </section>

        <section className="memory-form-section">
          <SectionHeader icon={<Sparkles size={16} />} title="What's this memory called?" />
          <label>
            <span>Give it a name</span>
            <input
              maxLength={70}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Summer road trip, rooftop sunset, first day..."
              required
              value={title}
            />
          </label>
          <label>
            <span>Tell the story</span>
            <textarea
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What happened? Who was there? What made it stick?"
              rows={4}
              value={description}
            />
          </label>
        </section>

        <section className="memory-form-section">
          <SectionHeader icon={<Camera size={16} />} title="When did this happen?" />
          <label>
            <span>Date</span>
            <input
              onChange={(event) => setDate(event.target.value)}
              required
              type="date"
              value={date}
            />
          </label>
        </section>

        <section className="memory-form-section">
          <SectionHeader icon={<Zap size={16} />} title="What's the vibe?" />
          <div className="vibe-grid">
            {defaultVibes.map(({ label, icon: Icon }) => (
              <button
                className={`vibe-card ${selectedVibes.includes(label) ? "active" : ""}`}
                key={label}
                onClick={() => toggleVibe(label)}
                type="button"
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="custom-chip-row">
            <input
              onChange={(event) => setCustomVibe(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomVibe();
                }
              }}
              placeholder="Add your own vibe"
              value={customVibe}
            />
            <button aria-label="Add custom vibe" className="icon-button" onClick={addCustomVibe} type="button">
              <Plus size={16} />
            </button>
          </div>
        </section>

        <section className="memory-form-section">
          <SectionHeader icon={<ImagePlus size={16} />} title="Drop your favorite moments" />
          <p className="section-helper">{selectedFileCount}/10 files selected</p>
          <label className="photo-picker">
            <ImagePlus size={18} />
            <span>{remainingFileSlots ? "Add photos or videos" : "Limit reached"}</span>
            <input
              accept="image/*,video/*"
              disabled={remainingFileSlots === 0}
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                setPhotos((current) => [...current, ...files.slice(0, remainingFileSlots)]);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
          <div className="photo-preview-grid">
            {photoUrlsToKeep.map((url) => (
              <div className="photo-preview" key={url}>
                {isVideoUrl(url) ? (
                  <video src={url} muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={url} />
                )}
                <button
                  aria-label="Remove media"
                  onClick={() => setPhotoUrlsToKeep((current) => current.filter((item) => item !== url))}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {previewUrls.map(({ file, url }) => (
              <div className="photo-preview" key={url}>
                {isVideoFile(file) ? (
                  <video src={url} muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={url} />
                )}
                <button
                  aria-label="Remove media"
                  onClick={() => setPhotos((current) => current.filter((item) => item !== file))}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="memory-form-section">
          <SectionHeader icon={<Smile size={16} />} title="How did it feel?" />
          <div className="feeling-grid">
            {defaultFeelings.map((item) => (
              <button
                className={`feeling-pill ${feeling === item ? "active" : ""}`}
                key={item}
                onClick={() => {
                  setFeeling((current) => current === item ? "" : item);
                  setCustomFeeling("");
                }}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <input
            className="custom-feeling-input"
            onChange={(event) => {
              setCustomFeeling(event.target.value);
              if (event.target.value.trim()) setFeeling("");
            }}
            placeholder="Add your own feeling"
            value={customFeeling}
          />
        </section>

        <section className="memory-form-section">
          <SectionHeader icon={<Users size={16} />} title="Who can see this?" />
          <div className="visibility-grid">
            <VisibilityCard
              active={visibility === "just-me"}
              eyebrow="Private"
              icon={<Heart size={18} />}
              label="Just me"
              onClick={() => setVisibility("just-me")}
            />
            <VisibilityCard
              active={visibility === "group"}
              eyebrow="Only selected group"
              icon={<Users size={18} />}
              label="Group"
              onClick={() => setVisibility("group")}
            />
            <VisibilityCard
              active={visibility === "everyone"}
              eyebrow="Public on my map"
              icon={<Sparkles size={18} />}
              label="Everyone"
              onClick={() => setVisibility("everyone")}
            />
          </div>
          {visibility === "group" ? (
            groups.length > 0 ? (
              <label>
                <span>Choose a group</span>
                <select
                  className="memory-select"
                  disabled={Boolean(editingMemory?.groupId)}
                  onChange={(event) => setSelectedGroupId(event.target.value)}
                  value={selectedGroupId}
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="memory-empty-state">No groups yet.</p>
            )
          ) : null}
        </section>

        <label className="terms-row">
          <input
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            type="checkbox"
          />
          <span>
            I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms & Conditions</a>
          </span>
        </label>

        {validationError ? <p className="memory-validation-error">{validationError}</p> : null}

        <button className="primary-button save-memory-button" disabled={!canSubmit} type="submit">
          {isSaving ? "Saving..." : "Save Memory ✨"}
        </button>
      </form>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="memory-section-header">
      <span>{icon}</span>
      <h3>{title}</h3>
    </div>
  );
}

function VisibilityCard({
  active,
  eyebrow,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  eyebrow: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`visibility-card ${active ? "active" : ""}`} onClick={onClick} type="button">
      {icon}
      <strong>{label}</strong>
      <span>{eyebrow}</span>
    </button>
  );
}
