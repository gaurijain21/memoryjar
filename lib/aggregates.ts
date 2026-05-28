import {
  collection,
  deleteField,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AggregateMarker, MemoryInput } from "@/types/memory";

const aggregateCollection = collection(db, "memoryLocationAggregates");

function aggregateId(input: Pick<MemoryInput, "lat" | "lng" | "placeId">) {
  if (input.placeId) return `place_${input.placeId}`;
  return `${input.lat.toFixed(1)}_${input.lng.toFixed(1)}`;
}

function aggregatePayload(input: MemoryInput) {
  return {
    formattedAddress: input.formattedAddress ?? null,
    lat: input.lat,
    lng: input.lng,
    locationName: input.placeName || input.formattedAddress || input.locationName || "Memory location",
    locationSource: input.locationSource ?? (input.placeId ? "search" : "pin"),
    placeId: input.placeId ?? null,
    placeName: input.placeName ?? null,
    placePhotoReference: input.placePhotoReference ?? null,
    updatedAt: serverTimestamp(),
  };
}

export function subscribeToMemoryLocationAggregates(
  onNext: (markers: AggregateMarker[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    aggregateCollection,
    (snapshot) => {
      onNext(
        snapshot.docs
          .map((document) => ({
            id: document.id,
            ...document.data(),
          }) as AggregateMarker),
      );
    },
    onError,
  );
}

export async function incrementMemoryLocationAggregate(input: MemoryInput) {
  await setDoc(
    doc(aggregateCollection, aggregateId(input)),
    {
      ...aggregatePayload(input),
      count: increment(1),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function decrementMemoryLocationAggregate(input: MemoryInput) {
  await setDoc(
    doc(aggregateCollection, aggregateId(input)),
    {
      count: increment(-1),
      updatedAt: serverTimestamp(),
      // Keep the document small and public-safe; clients hide count <= 0.
      deletedAt: deleteField(),
    },
    { merge: true },
  );
}

export async function moveMemoryLocationAggregate(previous: MemoryInput, next: MemoryInput) {
  if (aggregateId(previous) === aggregateId(next)) {
    await setDoc(
      doc(aggregateCollection, aggregateId(next)),
      aggregatePayload(next),
      { merge: true },
    );
    return;
  }

  await Promise.all([
    decrementMemoryLocationAggregate(previous),
    incrementMemoryLocationAggregate(next),
  ]);
}
