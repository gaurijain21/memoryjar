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

function aggregateId(input: Pick<MemoryInput, "lat" | "lng">) {
  return `${input.lat.toFixed(1)}_${input.lng.toFixed(1)}`;
}

function aggregatePayload(input: MemoryInput) {
  return {
    lat: Number(input.lat.toFixed(1)),
    lng: Number(input.lng.toFixed(1)),
    locationName: input.locationName || "Selected location",
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
          })) as AggregateMarker[],
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
