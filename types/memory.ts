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
  groupId?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type MemoryInput = Omit<Memory, "id" | "createdAt" | "updatedAt">;

export type SelectedLocation = {
  locationName: string;
  lat: number;
  lng: number;
};

// Group types
export type GroupMember = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  joinedAt: Timestamp;
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
export type ViewMode = "my-memories" | "everyone" | `group-${string}`;

// Page types for internal navigation
export type AppPage = "main" | "edit-memories" | "view-groups" | "personal-info";

// Aggregate marker for "Everyone's Memories" view
export type AggregateMarker = {
  lat: number;
  lng: number;
  count: number;
  locationName: string;
};
