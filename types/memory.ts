import type { Timestamp } from "firebase/firestore";

export type Memory = {
  id: string;
  title: string;
  description: string;
  date: string;
  locationName: string;
  lat: number;
  lng: number;
  photoUrls: string[];
  storagePaths?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type MemoryInput = Omit<Memory, "id" | "createdAt" | "updatedAt">;

export type SelectedLocation = {
  locationName: string;
  lat: number;
  lng: number;
};
