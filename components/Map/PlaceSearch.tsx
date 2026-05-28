"use client";

import { KeyboardEvent, useState } from "react";
import { Search } from "lucide-react";
import type { SelectedLocation } from "@/types/memory";

type PlaceSearchProps = {
  className?: string;
  placeholder: string;
  onPlaceSelected: (location: SelectedLocation) => void;
};

export function PlaceSearch({
  className = "",
  placeholder,
  onPlaceSelected,
}: PlaceSearchProps) {
  const [fallbackValue, setFallbackValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleFallbackSearch = () => {
    const query = fallbackValue.trim();
    if (!query || !window.google?.maps?.Geocoder) return;

    setIsSearching(true);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results, status) => {
      setIsSearching(false);
      const result = results?.[0];
      if (status !== "OK" || !result?.geometry.location) return;

      onPlaceSelected({
        lat: result.geometry.location.lat(),
        lng: result.geometry.location.lng(),
        locationName: result.formatted_address || query,
      });
    });
  };

  const handleFallbackKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleFallbackSearch();
  };

  return (
    <div className={`place-search ${className}`}>
      <Search size={17} />
      <div className="fallback-place-form">
        <input
          aria-label={placeholder}
          onKeyDown={handleFallbackKeyDown}
          onChange={(event) => setFallbackValue(event.target.value)}
          placeholder={placeholder}
          value={fallbackValue}
        />
        <button
          disabled={isSearching || !fallbackValue.trim()}
          onClick={handleFallbackSearch}
          type="button"
        >
          {isSearching ? "..." : "Search"}
        </button>
      </div>
    </div>
  );
}
