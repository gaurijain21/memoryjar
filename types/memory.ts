import type { FieldValue, Timestamp } from "firebase/firestore";

export type Memory = {
  id: string;
  title: string;
  description: string;
  date: string;
  locationName: string;
  placeId?: string | null;
  placeName?: string | null;
  formattedAddress?: string | null;
  placePhotoReference?: string | null;
  locationSource?: "search" | "pin";
  lat: number;
  lng: number;
  photoUrls: string[];
  storagePaths?: string[];
  publicPhotoUrls?: string[];
  publicStoragePaths?: string[];
  groupId?: string | null;
  groupName?: string | null;
  audience?: "private" | "public";
  vibes?: string[];
  feeling?: string | null;
  ownerId?: string;
  creatorUid?: string;
  sourceMemoryId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type MemoryInput = Omit<Memory, "id" | "createdAt" | "updatedAt">;
export type MemoryAudience = "private" | "public";
export type MemoryDestination = "my-memories" | `group-${string}`;

export type SelectedLocation = {
  locationName: string;
  lat: number;
  lng: number;
  placeId?: string | null;
  placeName?: string | null;
  formattedAddress?: string | null;
  placePhotoReference?: string | null;
  locationSource?: "search" | "pin";
};

// Group types
export type GroupMember = {
  uid: string;
  displayName: string;
  email?: string | null;
  photoURL: string | null;
  joinedAt: Timestamp | FieldValue;
};

export type Group = {
  id: string;
  name: string;
  ownerId: string;
  joinCode: string;
  memberIds: string[];
  members: Record<string, GroupMember>;
  createdAt: Timestamp;
};

export type GroupInput = {
  name: string;
};

// View mode types
export type ViewMode = "all-memories" | "my-memories" | "everyone" | `group-${string}`;

// Page types for internal navigation
export type AppPage = "main" | "timeline" | "edit-memories" | "view-groups" | "personal-info";

// Aggregate marker for "Everyone's Memories" view
export type AggregateMarker = {
  id: string;
  lat: number;
  lng: number;
  count: number;
  publicCount?: number;
  privateCount?: number;
  groupCount?: number;
  locationName: string;
  placeId?: string | null;
  placeName?: string | null;
  formattedAddress?: string | null;
  placePhotoReference?: string | null;
  locationSource?: "search" | "pin";
  previewMemory?: Memory | null;
  previewItems?: AggregatePreviewItem[];
};

export type AggregatePreviewItem = {
  id: string;
  type: "public" | "private" | "group";
  memory?: Memory | null;
  label?: string;
};
