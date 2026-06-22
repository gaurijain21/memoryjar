"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { Compass, LocateFixed, Minus, Plus } from "lucide-react";
import { getReadableLocationName } from "@/lib/locationText";
import { getReactionKey, subscribeToReactionEvents } from "@/lib/reactions";
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
const publicPinColor = "#3b82f6";
const groupPinColors = ["#6cc7f5", "#8f7cff", "#3ddc97", "#ff8f70", "#d783ff", "#4fd1c5"];

function getGroupPinColor(groupId?: string | null) {
  if (!groupId) return personalPinColor;

  let hash = 0;
  for (let index = 0; index < groupId.length; index += 1) {
    hash = (hash + groupId.charCodeAt(index) * (index + 1)) % groupPinColors.length;
  }

  return groupPinColors[hash];
}

function getMemoryPinColor(memory: Memory) {
  if (memory.audience === "public" && !memory.groupId) return publicPinColor;
  return getGroupPinColor(memory.groupId);
}

function getAggregateVariant(marker: AggregateMarker) {
  const publicCount = marker.publicCount ?? 0;
  const privateCount = marker.privateCount ?? 0;
  const groupCount = marker.groupCount ?? 0;
  const variants = [
    publicCount > 0 ? "public" : null,
    privateCount > 0 ? "private" : null,
    groupCount > 0 ? "group" : null,
  ].filter(Boolean);

  if (variants.length > 1) return "mixed";
  return variants[0] ?? "private";
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
  onMapInteraction?: () => void;
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
  onMapInteraction,
  onPinDropComplete,
}: MemoryMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const seenAggregateIdsRef = useRef<Set<string> | null>(null);
  const reactionEventsInitializedRef = useRef(false);
  const [burstAggregateId, setBurstAggregateId] = useState<string | null>(null);
  const [reactionBursts, setReactionBursts] = useState<Array<{ id: string; emoji: string; lat: number; lng: number }>>([]);
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries,
  });

  const isEveryoneView = viewMode === "everyone";
  const reactionTargets = useMemo(() => {
    const targets = new Map<string, { lat: number; lng: number }>();
    memories.forEach((memory) => {
      targets.set(getReactionKey(memory), { lat: memory.lat, lng: memory.lng });
    });
    aggregateMarkers.forEach((marker) => {
      marker.previewItems?.forEach((item) => {
        if (item.memory) {
          targets.set(getReactionKey(item.memory), { lat: marker.lat, lng: marker.lng });
        }
      });
      if (marker.previewMemory) {
        targets.set(getReactionKey(marker.previewMemory), { lat: marker.lat, lng: marker.lng });
      }
    });
    return targets;
  }, [aggregateMarkers, memories]);

  useEffect(() => {
    reactionEventsInitializedRef.current = false;
    return subscribeToReactionEvents(
      (events) => {
        if (!reactionEventsInitializedRef.current) {
          reactionEventsInitializedRef.current = true;
          return;
        }

        events.forEach((event) => {
          const target = reactionTargets.get(event.id);
          if (!target || !event.emoji) return;
          const id = `${event.id}-${event.reactionAt || Date.now()}`;
          setReactionBursts((current) => [...current, { id, emoji: event.emoji, ...target }]);
          window.setTimeout(() => {
            setReactionBursts((current) => current.filter((burst) => burst.id !== id));
          }, 4200);
        });
      },
      (error) => console.warn("[MemoryJar reactions] map event listener failed", error),
    );
  }, [reactionTargets]);

  useEffect(() => {
    if (!isEveryoneView) {
      seenAggregateIdsRef.current = null;
      return;
    }

    const activeIds = new Set(aggregateMarkers.filter((marker) => marker.count > 0).map((marker) => marker.id));
    if (!seenAggregateIdsRef.current) {
      seenAggregateIdsRef.current = activeIds;
      return;
    }

    const newMarker = aggregateMarkers.find((marker) => marker.count > 0 && !seenAggregateIdsRef.current?.has(marker.id));
    seenAggregateIdsRef.current = activeIds;

    if (!newMarker) return;
    setBurstAggregateId(newMarker.id);
    const timeoutId = window.setTimeout(() => setBurstAggregateId(null), 1100);
    return () => window.clearTimeout(timeoutId);
  }, [aggregateMarkers, isEveryoneView]);
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

  const markerItems = useMemo(() => {
    const grouped = new Map<string, Memory[]>();
    memories.forEach((memory) => {
      const key = `${memory.lat.toFixed(3)}:${memory.lng.toFixed(3)}`;
      grouped.set(key, [...(grouped.get(key) ?? []), memory]);
    });

    // Marker overlap handling: memories at the same or very close location get
    // a tiny radial offset, keeping them visually clustered but individually clickable.
    return Array.from(grouped.values()).flatMap((group) => {
      if (group.length === 1) {
        return [{ memory: group[0], lat: group[0].lat, lng: group[0].lng }];
      }

      return group.map((memory, index) => {
        const angle = (Math.PI * 2 * index) / group.length;
        const radius = 0.00016 + Math.floor(index / 8) * 0.00008;
        return {
          memory,
          lat: memory.lat + Math.sin(angle) * radius,
          lng: memory.lng + Math.cos(angle) * radius,
        };
      });
    });
  }, [memories]);

  const focusMemory = useCallback(
    (memory: Memory) => {
      onSelectMemory(memory);
    },
    [onSelectMemory],
  );

  const handleMapClick = useCallback(
    async (event: google.maps.MapMouseEvent) => {
      onMapInteraction?.();
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
    [isPinDropMode, onLocationSelected, onMapInteraction, onPinDropComplete],
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
          mapTypeId: "roadmap",
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
        {markerItems.map(({ memory, lat, lng }) => (
          <OverlayView
            getPixelPositionOffset={() => ({ x: 0, y: 0 })}
            key={memory.id}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            position={{ lat, lng }}
          >
            <div
              className={`marker-anchor marker-anchor-pin ${selectedMemory?.id === memory.id ? "active" : ""}`}
              style={{ "--pin-color": getMemoryPinColor(memory) } as CSSProperties}
            >
              <button
                className={`memory-pin memory-pin-pulse ${selectedMemory?.id === memory.id ? "active" : ""}`}
                onClick={() => focusMemory(memory)}
                type="button"
              >
                {memory.photoUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={memory.photoUrls[0]} />
                ) : (
                  <span />
                )}
              </button>
            </div>
          </OverlayView>
        ))}
        {isEveryoneView
          ? aggregateMarkers.map((marker) => {
              const locationName = getReadableLocationName(marker.locationName);
              const variant = getAggregateVariant(marker);
              console.info("[DEBUG everyone] render circle", {
                id: marker.id,
                count: marker.count,
                publicCount: marker.publicCount ?? 0,
                privateCount: marker.privateCount ?? 0,
                groupCount: marker.groupCount ?? 0,
                chosenColor: variant,
              });

              return (
                <OverlayView
                  getPixelPositionOffset={() => ({ x: 0, y: 0 })}
                  key={marker.id}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  position={{ lat: marker.lat, lng: marker.lng }}
                >
                  <div className={`marker-anchor marker-anchor-circle ${selectedAggregate?.id === marker.id ? "active" : ""}`}>
                    <button
                      className={`aggregate-pin aggregate-pin-${variant} ${selectedAggregate?.id === marker.id ? "active" : ""}`}
                      onClick={() => onSelectAggregate(marker)}
                      title={`${marker.count} ${marker.count === 1 ? "memory" : "memories"}${
                        locationName ? ` at ${locationName}` : ""
                      }`}
                      type="button"
                    >
                      <span className="aggregate-count">{marker.count}</span>
                      {burstAggregateId === marker.id ? <span className="map-local-confetti" aria-hidden="true" /> : null}
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
        {reactionBursts.map((burst) => (
          <OverlayView
            getPixelPositionOffset={() => ({ x: 0, y: 0 })}
            key={burst.id}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            position={{ lat: burst.lat, lng: burst.lng }}
          >
            <span className="map-reaction-float">{burst.emoji}</span>
          </OverlayView>
        ))}
      </GoogleMap>
    </div>
  );
}
