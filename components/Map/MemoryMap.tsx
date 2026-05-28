"use client";

import { useCallback, useMemo, useRef } from "react";
import { GoogleMap, Marker, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { Compass, LocateFixed, Minus, Plus } from "lucide-react";
import { PlaceSearch } from "@/components/Map/PlaceSearch";
import type { Memory, SelectedLocation, ViewMode } from "@/types/memory";

const libraries: ("places")[] = ["places"];
const defaultCenter = { lat: 20, lng: 0 };
const worldBounds = {
  north: 85,
  south: -85,
  west: -180,
  east: 180,
};

type MemoryMapProps = {
  memories: Memory[];
  selectedMemory?: Memory | null;
  draftLocation?: SelectedLocation | null;
  isSelectingLocation: boolean;
  isPinDropMode: boolean;
  viewMode: ViewMode;
  onSelectMemory: (memory: Memory) => void;
  onLocationSelected: (location: SelectedLocation) => void;
  onPinDropComplete: () => void;
};

export function MemoryMap({
  memories,
  selectedMemory,
  draftLocation,
  isSelectingLocation,
  isPinDropMode,
  viewMode,
  onSelectMemory,
  onLocationSelected,
  onPinDropComplete,
}: MemoryMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries,
  });

  const isEveryoneView = viewMode === "everyone";

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
      mapRef.current?.panTo({ lat: memory.lat, lng: memory.lng });
      mapRef.current?.setZoom(Math.max(mapRef.current.getZoom() ?? 4, 11));
    },
    [onSelectMemory],
  );

  const handlePlaceSelected = useCallback(
    (selected: SelectedLocation) => {
      mapRef.current?.panTo(selected);
      mapRef.current?.setZoom(12);
      if (isSelectingLocation) {
        onLocationSelected(selected);
      }
    },
    [isSelectingLocation, onLocationSelected],
  );

  const handleMapClick = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (!isPinDropMode || !event.latLng) return;

      const selected = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
        locationName: `Dropped pin (${event.latLng.lat().toFixed(4)}, ${event.latLng.lng().toFixed(4)})`,
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
      <PlaceSearch
        className="map-search"
        onPlaceSelected={handlePlaceSelected}
        placeholder="Search for a place..."
      />
      {isPinDropMode ? <div className="pin-drop-hint">Click the map to drop a memory pin</div> : null}
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
        center={selectedMemory ? { lat: selectedMemory.lat, lng: selectedMemory.lng } : defaultCenter}
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
        zoom={selectedMemory ? 10 : 2}
      >
        {markerGroups.map(({ memory, count }) => (
          <OverlayView
            getPixelPositionOffset={(width, height) => ({
              x: -(width / 2),
              y: -height,
            })}
            key={memory.id}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            position={{ lat: memory.lat, lng: memory.lng }}
          >
            {isEveryoneView ? (
              <button
                className="aggregate-pin"
                onClick={() => focusMemory(memory)}
                type="button"
                title={`${count} ${count === 1 ? "memory" : "memories"} at ${memory.locationName}`}
              >
                <span className="aggregate-count">{count}</span>
              </button>
            ) : (
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
            )}
          </OverlayView>
        ))}
        {draftLocation ? (
          <Marker
            draggable
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
