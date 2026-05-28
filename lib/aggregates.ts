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
import type { AggregateMarker, Memory, MemoryInput } from "@/types/memory";

const aggregateCollection = collection(db, "memoryLocationAggregates");
const publicMemoriesCollection = collection(db, "publicMemories");

function aggregateId(input: Pick<MemoryInput, "lat" | "lng" | "placeId">) {
  if (input.placeId) return `place_${input.placeId}`;
  return `${input.lat.toFixed(1)}_${input.lng.toFixed(1)}`;
}

function hasValidCoordinates(input: Pick<MemoryInput, "lat" | "lng">) {
  return Number.isFinite(input.lat) && Number.isFinite(input.lng);
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

function aggregateCountPayload(input: MemoryInput, amount: 1 | -1) {
  if (input.groupId) {
    return { groupCount: increment(amount) };
  }

  if (input.audience === "public") {
    return { publicCount: increment(amount) };
  }

  return { privateCount: increment(amount) };
}

function aggregateBucket(input: MemoryInput) {
  if (input.groupId) return "group";
  if (input.audience === "public") return "public";
  return "private";
}

export function subscribeToMemoryLocationAggregates(
  onNext: (markers: AggregateMarker[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    aggregateCollection,
    (snapshot) => {
      console.info("[DEBUG aggregate] listener load count", snapshot.size);
      onNext(
        snapshot.docs
          .map((document) => ({
            id: document.id,
            ...document.data(),
          }) as AggregateMarker)
          .filter((marker) => hasValidCoordinates(marker)),
      );
    },
    onError,
  );
}

export function subscribeToPublicMemories(
  onNext: (memories: Memory[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    publicMemoriesCollection,
    (snapshot) => {
      console.info("[DEBUG publicMemories] listener load count", snapshot.size);
      onNext(
        (snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Memory[]).filter(hasValidCoordinates),
      );
    },
    onError,
  );
}

export async function incrementMemoryLocationAggregate(input: MemoryInput) {
  console.info("[DEBUG aggregate] increment start", {
    audience: input.audience ?? "private",
    groupId: input.groupId ?? null,
    placeId: input.placeId ?? null,
    lat: input.lat,
    lng: input.lng,
  });
  await setDoc(
    doc(aggregateCollection, aggregateId(input)),
    {
      ...aggregatePayload(input),
      count: increment(1),
      ...aggregateCountPayload(input, 1),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
  console.info("[DEBUG aggregate] increment end", { aggregateId: aggregateId(input) });
}

export async function decrementMemoryLocationAggregate(input: MemoryInput) {
  console.info("[DEBUG aggregate] decrement start", {
    audience: input.audience ?? "private",
    groupId: input.groupId ?? null,
    placeId: input.placeId ?? null,
    lat: input.lat,
    lng: input.lng,
  });
  await setDoc(
    doc(aggregateCollection, aggregateId(input)),
    {
      count: increment(-1),
      ...aggregateCountPayload(input, -1),
      updatedAt: serverTimestamp(),
      // Keep the document small and public-safe; clients hide count <= 0.
      deletedAt: deleteField(),
    },
    { merge: true },
  );
  console.info("[DEBUG aggregate] decrement end", { aggregateId: aggregateId(input) });
}

export async function moveMemoryLocationAggregate(previous: MemoryInput, next: MemoryInput) {
  console.info("[DEBUG aggregate] move start", {
    previousAggregateId: aggregateId(previous),
    nextAggregateId: aggregateId(next),
  });
  if (aggregateId(previous) === aggregateId(next)) {
    const sameBucket = aggregateBucket(previous) === aggregateBucket(next);

    if (sameBucket) {
      await setDoc(
        doc(aggregateCollection, aggregateId(next)),
        aggregatePayload(next),
        { merge: true },
      );
    } else {
      await Promise.all([
        decrementMemoryLocationAggregate(previous),
        incrementMemoryLocationAggregate(next),
      ]);
    }
    console.info("[DEBUG aggregate] move end same location", { aggregateId: aggregateId(next) });
    return;
  }

  await Promise.all([
    decrementMemoryLocationAggregate(previous),
    incrementMemoryLocationAggregate(next),
  ]);
  console.info("[DEBUG aggregate] move end different location", {
    previousAggregateId: aggregateId(previous),
    nextAggregateId: aggregateId(next),
  });
}
