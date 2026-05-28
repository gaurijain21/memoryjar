"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { SelectedLocation } from "@/types/memory";

type PlaceSearchProps = {
  className?: string;
  placeholder: string;
  onPlaceSelected: (location: SelectedLocation) => void;
};

type PlacePrediction = {
  toPlace: () => {
    displayName?: string;
    formattedAddress?: string;
    location?: google.maps.LatLng;
    fetchFields: (request: { fields: string[] }) => Promise<void>;
  };
};

type PlaceSelectEvent = Event & {
  placePrediction?: PlacePrediction;
};

export function PlaceSearch({
  className = "",
  placeholder,
  onPlaceSelected,
}: PlaceSearchProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [fallbackValue, setFallbackValue] = useState("");
  const [supportsNewPlaces, setSupportsNewPlaces] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    let autocompleteElement: HTMLElement | null = null;
    let isMounted = true;

    async function mountAutocomplete() {
      if (!hostRef.current || !window.google?.maps?.importLibrary) return;

      const placesLibrary = (await google.maps.importLibrary("places")) as {
        PlaceAutocompleteElement?: new () => HTMLElement;
      };

      if (!isMounted || !hostRef.current || !placesLibrary.PlaceAutocompleteElement) {
        setSupportsNewPlaces(false);
        return;
      }

      autocompleteElement = new placesLibrary.PlaceAutocompleteElement();
      autocompleteElement.setAttribute("placeholder", placeholder);
      autocompleteElement.classList.add("place-autocomplete-element");

      const handleSelect = async (event: PlaceSelectEvent) => {
        const place = event.placePrediction?.toPlace();
        if (!place) return;

        await place.fetchFields({
          fields: ["displayName", "formattedAddress", "location"],
        });

        if (!place.location) return;

        onPlaceSelected({
          lat: place.location.lat(),
          lng: place.location.lng(),
          locationName:
            place.displayName || place.formattedAddress || fallbackValue || "Selected place",
        });
      };

      autocompleteElement.addEventListener("gmp-select", handleSelect);
      hostRef.current.replaceChildren(autocompleteElement);
    }

    mountAutocomplete().catch(() => setSupportsNewPlaces(false));

    return () => {
      isMounted = false;
      autocompleteElement?.remove();
    };
  }, [fallbackValue, onPlaceSelected, placeholder]);

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
      <div className="place-search-host" ref={hostRef}>
        {!supportsNewPlaces ? (
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
        ) : null}
      </div>
    </div>
  );
}
