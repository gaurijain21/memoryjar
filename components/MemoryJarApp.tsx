"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { ChevronDown, LogOut, MapPinned, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { LoginScreen } from "@/components/Auth/LoginScreen";
import { AddMemoryModal } from "@/components/Memory/AddMemoryModal";
import { MemoryDetailPanel } from "@/components/Memory/MemoryDetailPanel";
import { MemoryTimeline } from "@/components/Timeline/MemoryTimeline";
import { auth } from "@/lib/firebase";
import {
  createMemory,
  deleteMemory,
  subscribeToMemories,
  updateMemory,
} from "@/lib/memories";
import type { Memory, MemoryInput, SelectedLocation } from "@/types/memory";

const MemoryMap = dynamic(
  () => import("@/components/Map/MemoryMap").then((module) => module.MemoryMap),
  {
    ssr: false,
  },
);

export function MemoryJarApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeIndex, setRangeIndex] = useState(0);
  const [isPinDropMode, setIsPinDropMode] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setMemories([]);
      return;
    }

    return subscribeToMemories(
      user.uid,
      setMemories,
      (snapshotError) => setError(snapshotError.message),
    );
  }, [user]);

  const sortedMemories = useMemo(
    () => [...memories].sort((a, b) => a.date.localeCompare(b.date)),
    [memories],
  );

  const openAddModal = () => {
    setEditingMemory(null);
    setSelectedLocation(null);
    setIsPinDropMode(false);
    setIsModalOpen(true);
  };

  const openEditModal = (memory: Memory) => {
    setEditingMemory(memory);
    setSelectedLocation({
      locationName: memory.locationName,
      lat: memory.lat,
      lng: memory.lng,
    });
    setIsPinDropMode(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMemory(null);
    setIsPinDropMode(false);
  };

  const handleSubmitMemory = async (
    input: MemoryInput,
    photos: File[],
    photoUrlsToKeep: string[],
  ) => {
    if (!user) return;
    setIsSaving(true);
    setError(null);

    try {
      if (editingMemory) {
        await updateMemory(user.uid, editingMemory, input, photos, photoUrlsToKeep);
      } else {
        await createMemory(user.uid, input, photos);
      }

      closeModal();
      setSelectedLocation(null);
      setIsPinDropMode(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save memory.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (memory: Memory) => {
    if (!user) return;
    const confirmed = window.confirm(`Delete "${memory.title}"?`);
    if (!confirmed) return;

    await deleteMemory(user.uid, memory);
    setSelectedMemory(null);
  };

  const handleTimelineRange = (index: number) => {
    setRangeIndex(index);
    const memory = sortedMemories[index];
    if (memory) setSelectedMemory(memory);
  };

  if (!authReady) {
    return <main className="loading-shell">Opening Memory Jar...</main>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-chip">
          <MapPinned size={27} />
          <h1>Memory Jar</h1>
        </div>
        <div className="user-chip">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" src={user.photoURL} />
          ) : null}
          <span>{user.displayName ?? user.email}</span>
          <button
            aria-label="Log out"
            className="account-menu-button"
            onClick={() => signOut(auth)}
            type="button"
          >
            <ChevronDown className="desktop-only" size={17} />
            <LogOut className="mobile-only" size={17} />
          </button>
        </div>
      </header>

      {error ? <div className="error-toast">{error}</div> : null}

      <MemoryMap
        draftLocation={selectedLocation}
        isSelectingLocation={isModalOpen}
        isPinDropMode={isPinDropMode}
        memories={memories}
        onLocationSelected={setSelectedLocation}
        onPinDropComplete={() => setIsPinDropMode(false)}
        onSelectMemory={setSelectedMemory}
        selectedMemory={selectedMemory}
      />

      <button aria-label="Add memory" className="add-button" onClick={openAddModal} type="button">
        <Plus size={30} />
      </button>

      <MemoryDetailPanel
        memory={selectedMemory}
        onClose={() => setSelectedMemory(null)}
        onDelete={handleDelete}
        onEdit={openEditModal}
      />

      <MemoryTimeline
        memories={sortedMemories}
        onRangeChange={handleTimelineRange}
        onSelectMemory={setSelectedMemory}
        rangeIndex={rangeIndex}
        selectedMemoryId={selectedMemory?.id}
      />

      <AddMemoryModal
        editingMemory={editingMemory}
        isOpen={isModalOpen}
        isSaving={isSaving}
        onClose={closeModal}
        onLocationSelected={setSelectedLocation}
        onRequestPinDrop={() => setIsPinDropMode(true)}
        onSubmit={handleSubmitMemory}
        pinDropMode={isPinDropMode}
        selectedLocation={selectedLocation}
      />
    </main>
  );
}
