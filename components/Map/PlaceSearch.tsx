"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { SelectedLocation } from "@/types/memory";

type PlaceSearchProps = {
  className?: string;
  placeholder: string;
  onPlaceSelected: (location: SelectedLocation) => void;
};

type PlaceSuggestion = {
  id: string;
  mainText: string;
  secondaryText: string;
  description: string;
  placePrediction: {
    toPlace: () => {
      id?: string;
      displayName?: string;
      formattedAddress?: string;
      location?: google.maps.LatLng;
      photos?: Array<{ getURI?: (options?: { maxWidthPx?: number; maxHeightPx?: number }) => string }>;
      fetchFields: (request: { fields: string[] }) => Promise<void>;
    };
  };
};

export function PlaceSearch({
  className = "",
  placeholder,
  onPlaceSelected,
}: PlaceSearchProps) {
  const [value, setValue] = useState("");
  const [predictions, setPredictions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const placesLibRef = useRef<{
    AutocompleteSessionToken?: new () => unknown;
    AutocompleteSuggestion?: {
      fetchAutocompleteSuggestions: (request: {
        input: string;
        sessionToken?: unknown;
      }) => Promise<{ suggestions?: Array<{ placePrediction?: PlaceSuggestion["placePrediction"] & {
        placeId?: string;
        text?: { toString: () => string };
        mainText?: { toString: () => string };
        secondaryText?: { toString: () => string };
      } }> }>;
    };
  } | null>(null);
  const tokenRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPlacesLibrary() {
      if (!window.google?.maps?.importLibrary) return;

      try {
        const placesLibrary = await google.maps.importLibrary("places");
        if (cancelled) return;
        placesLibRef.current = placesLibrary as typeof placesLibRef.current;
        if (placesLibRef.current?.AutocompleteSessionToken) {
          tokenRef.current = new placesLibRef.current.AutocompleteSessionToken();
        }
      } catch (error) {
        console.warn("[MemoryJar places] Places library could not load. Search button fallback remains available.", error);
      }
    }

    loadPlacesLibrary();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = value.trim();
    const autocomplete = placesLibRef.current?.AutocompleteSuggestion;
    if (!query || query.length < 2 || !autocomplete) {
      setPredictions([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      autocomplete
        .fetchAutocompleteSuggestions({
          input: query,
          sessionToken: tokenRef.current ?? undefined,
        })
        .then(({ suggestions = [] }) => {
          const nextPredictions: PlaceSuggestion[] = [];

          suggestions.slice(0, 5).forEach((suggestion) => {
            const prediction = suggestion.placePrediction;
            if (!prediction) return;

            const description = prediction.text?.toString() ?? "";
            nextPredictions.push({
              id: prediction.placeId ?? description,
              mainText: prediction.mainText?.toString() ?? description,
              secondaryText: prediction.secondaryText?.toString() ?? "",
              description,
              placePrediction: prediction,
            });
          });

          setPredictions(nextPredictions);
        })
        .catch((error) => {
          console.warn("[MemoryJar places] Autocomplete suggestions failed.", error);
          setPredictions([]);
        });
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [value]);

  const handleFallbackSearch = () => {
    const query = value.trim();
    if (!query || !window.google?.maps?.Geocoder) return;

    setIsSearching(true);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results, status) => {
      setIsSearching(false);
      const result = results?.[0];
      if (status !== "OK" || !result?.geometry.location) return;

      setPredictions([]);
      onPlaceSelected({
        lat: result.geometry.location.lat(),
        lng: result.geometry.location.lng(),
        locationName: result.formatted_address || query,
        formattedAddress: result.formatted_address || query,
        locationSource: "search",
        placeId: result.place_id ?? null,
        placeName: result.formatted_address || query,
      });
    });
  };

  const handleSuggestionSelect = async (prediction: PlaceSuggestion) => {
    setIsSearching(true);
    try {
      const place = prediction.placePrediction.toPlace();
      await place.fetchFields({
        fields: ["id", "displayName", "formattedAddress", "location", "photos"],
      });
      if (!place.location) return;

      const locationName = place.formattedAddress || place.displayName || prediction.description;
      setValue(locationName);
      setPredictions([]);
      if (placesLibRef.current?.AutocompleteSessionToken) {
        tokenRef.current = new placesLibRef.current.AutocompleteSessionToken();
      }

      onPlaceSelected({
        lat: place.location.lat(),
        lng: place.location.lng(),
        locationName,
        formattedAddress: place.formattedAddress ?? locationName,
        locationSource: "search",
        placeId: place.id ?? prediction.id,
        placeName: place.displayName ?? prediction.mainText,
        placePhotoReference: null,
      });
    } catch (error) {
      console.warn("[MemoryJar places] Place details failed.", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          value={value}
        />
        <button
          disabled={isSearching || !value.trim()}
          onClick={handleFallbackSearch}
          type="button"
        >
          {isSearching ? "..." : "Search"}
        </button>
      </div>
      {predictions.length > 0 ? (
        <div className="place-suggestions" role="listbox">
          {predictions.map((prediction) => (
            <button
              aria-selected="false"
              key={prediction.id}
              onClick={() => handleSuggestionSelect(prediction)}
              role="option"
              type="button"
            >
              <span>{prediction.mainText}</span>
              <small>{prediction.secondaryText}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
