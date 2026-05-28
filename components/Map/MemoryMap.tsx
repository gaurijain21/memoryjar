"use client";

import { type CSSProperties, useCallback, useMemo, useRef } from "react";
import { GoogleMap, Marker, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { Compass, LocateFixed, Minus, Plus } from "lucide-react";
import { getReadableLocationName } from "@/lib/locationText";
import type { AggregateMarker, Memory, SelectedLocation, ViewMode } from "@/types/memory";

const libraries: ("places")[] = ["places"];
const defaultCenter = { lat: 20, lng: 0 };
const worldBounds = {
  north: 85,
  south: -85,
  west: -180,
  east: 180,
};
const personalPinColor = "#f6c85f";
const groupPinColors = ["#6cc7f5", "#8f7cff", "#3ddc97", "#ff8f70", "#d783ff", "#4fd1c5"];

function getGroupPinColor(groupId?: string | null) {
  if (!groupId) return personalPinColor;

  let hash = 0;
  for (let index = 0; index < groupId.length; index += 1) {
    hash = (hash + groupId.charCodeAt(index) * (index + 1)) % groupPinColors.length;
  }

  return groupPinColors[hash];
}

type MemoryMapProps = {
  memories: Memory[];
  selectedMemory?: Memory | null;
  selectedAggregate?: AggregateMarker | null;
  aggregateMarkers?: AggregateMarker[];
  draftLocation?: SelectedLocation | null;
  isPinDropMode: boolean;
  viewMode: ViewMode;
  onSelectMemory: (memory: Memory) => void;
  onSelectAggregate: (marker: AggregateMarker) => void;
  onLocationSelected: (location: SelectedLocation) => void;
  onPinDropComplete: () => void;
};

export function MemoryMap({
  memories,
  selectedMemory,
  selectedAggregate,
  aggregateMarkers = [],
  draftLocation,
  isPinDropMode,
  viewMode,
  onSelectMemory,
  onSelectAggregate,
  onLocationSelected,
  onPinDropComplete,
}: MemoryMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries,
  });

  const isEveryoneView = viewMode === "everyone";
  const draftPinIcon = useMemo(() => {
    if (!isLoaded || typeof window === "undefined" || !window.google) return undefined;

    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
        <path fill="#f6c85f" stroke="#fff4cc" stroke-width="2" d="M17 1C8.2 1 1 8.2 1 17c0 11.7 16 25 16 25s16-13.3 16-25C33 8.2 25.8 1 17 1Z"/>
        <circle cx="17" cy="17" r="6.5" fill="#17130a"/>
      </svg>`,
    );

    return {
      anchor: new google.maps.Point(17, 44),
      scaledSize: new google.maps.Size(34, 44),
      url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    };
  }, [isLoaded]);

  const markerGroups = useMemo(() => {
    const grouped = new Map<string, Memory[]>();
    memories.forEach((memory) => {
      const key = `${memory.lat.toFixed(1)}:${memory.lng.toFixed(1)}`;
      grouped.set(key, [...(grouped.get(key) ?? []), memory]);
    });

    return Array.from(grouped.values()).map((group) => ({
      memory: group[0],
      count: group.length,
    }));
  }, [memories]);

  const focusMemory = useCallback(
    (memory: Memory) => {
      onSelectMemory(memory);
    },
    [onSelectMemory],
  );

  const handleMapClick = useCallback(
    async (event: google.maps.MapMouseEvent) => {
      if (!isPinDropMode || !event.latLng) return;

      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      let locationName = "";

      if (window.google?.maps?.Geocoder) {
        try {
          // Google Cloud setup note:
          // The Maps JavaScript API must be enabled for the map itself, and the
          // Geocoding API must also be enabled for reverse-geocoding dropped pins.
          // If Geocoding is disabled, keep the pin usable and leave the name blank.
          const geocoder = new google.maps.Geocoder();
          const response = await geocoder.geocode({ location: { lat, lng } });
          locationName = response.results[0]?.formatted_address ?? "";
        } catch {
          locationName = "";
        }
      }

      const selected = {
        lat,
        lng,
        locationName,
        locationSource: "pin" as const,
      };

      onLocationSelected(selected);
      onPinDropComplete();
    },
    [isPinDropMode, onLocationSelected, onPinDropComplete],
  );

  const showWorld = () => {
    if (!mapRef.current) return;
    mapRef.current.fitBounds(worldBounds, 0);
    mapRef.current.setCenter(defaultCenter);
    mapRef.current.setZoom(2);
  };

  if (loadError) {
    return <div className="map-fallback">Google Maps could not load. Check your API key.</div>;
  }

  if (!isLoaded) {
    return <div className="map-fallback">Loading your map...</div>;
  }

  return (
      <div className={`map-wrap ${isPinDropMode ? "pin-drop-mode" : ""}`}>
      <div className="space-vignette" />
      <div className="map-controls" aria-label="Map controls">
        <button
          aria-label="Compass"
          onClick={() => {
            mapRef.current?.setHeading(0);
            mapRef.current?.setTilt(0);
          }}
          type="button"
        >
          <Compass size={20} />
        </button>
        <div className="zoom-stack">
          <button
            aria-label="Zoom in"
            onClick={() => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 2) + 1)}
            type="button"
          >
            <Plus size={21} />
          </button>
          <button
            aria-label="Zoom out"
            onClick={() => mapRef.current?.setZoom(Math.max((mapRef.current.getZoom() ?? 2) - 1, 2))}
            type="button"
          >
            <Minus size={21} />
          </button>
        </div>
        <button
          aria-label="Fit all memories"
          onClick={() => {
            if (!mapRef.current || memories.length === 0) {
              showWorld();
              return;
            }
            const bounds = new google.maps.LatLngBounds();
            memories.forEach((memory) => bounds.extend({ lat: memory.lat, lng: memory.lng }));
            mapRef.current.fitBounds(bounds, 72);
          }}
          type="button"
        >
          <LocateFixed size={19} />
        </button>
      </div>
      <GoogleMap
        mapContainerClassName="google-map"
        onClick={handleMapClick}
        onLoad={(map) => {
          mapRef.current = map;
          map.fitBounds(worldBounds, 0);
          map.setCenter(defaultCenter);
          map.setZoom(2);
        }}
        options={{
          clickableIcons: true,
          disableDefaultUI: true,
          fullscreenControl: false,
          heading: 0,
          mapTypeControl: false,
          mapTypeId: "hybrid",
          minZoom: 2,
          restriction: {
            latLngBounds: worldBounds,
            strictBounds: false,
          },
          streetViewControl: false,
          tilt: 0,
          zoomControl: false,
          gestureHandling: "greedy",
        }}
      >
        {markerGroups.map(({ memory, count }) => (
          <OverlayView
            getPixelPositionOffset={() => ({ x: 0, y: 0 })}
            key={memory.id}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            position={{ lat: memory.lat, lng: memory.lng }}
          >
            <div
              className="marker-anchor marker-anchor-pin"
              style={{ "--pin-color": getGroupPinColor(memory.groupId) } as CSSProperties}
            >
              <button
                className={`memory-pin ${selectedMemory?.id === memory.id ? "active" : ""}`}
                onClick={() => focusMemory(memory)}
                type="button"
              >
                {memory.photoUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={memory.photoUrls[0]} />
                ) : (
                  <span />
                )}
                {count > 1 ? <b>{count}</b> : null}
              </button>
            </div>
          </OverlayView>
        ))}
        {isEveryoneView
          ? aggregateMarkers.map((marker) => {
              const locationName = getReadableLocationName(marker.locationName);

              return (
                <OverlayView
                  getPixelPositionOffset={() => ({ x: 0, y: 0 })}
                  key={marker.id}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  position={{ lat: marker.lat, lng: marker.lng }}
                >
                  <div className="marker-anchor marker-anchor-circle">
                    <button
                      className={`aggregate-pin ${selectedAggregate?.id === marker.id ? "active" : ""}`}
                      onClick={() => onSelectAggregate(marker)}
                      title={`${marker.count} ${marker.count === 1 ? "memory" : "memories"}${
                        locationName ? ` at ${locationName}` : ""
                      }`}
                      type="button"
                    >
                      <span className="aggregate-count">{marker.count}</span>
                    </button>
                  </div>
                </OverlayView>
              );
            })
          : null}
        {draftLocation ? (
          <Marker
            draggable
            icon={draftPinIcon}
            onDragEnd={(event) => {
              if (!event.latLng) return;
              onLocationSelected({
                ...draftLocation,
                lat: event.latLng.lat(),
                lng: event.latLng.lng(),
              });
            }}
            position={{ lat: draftLocation.lat, lng: draftLocation.lng }}
          />
        ) : null}
      </GoogleMap>
    </div>
  );
}
