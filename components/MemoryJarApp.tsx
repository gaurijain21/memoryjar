"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { LoginScreen } from "@/components/Auth/LoginScreen";
import { AddMemoryModal } from "@/components/Memory/AddMemoryModal";
import { AggregateDetailPanel } from "@/components/Memory/AggregateDetailPanel";
import { MemoryDetailPanel } from "@/components/Memory/MemoryDetailPanel";
import { MemoryTimeline } from "@/components/Timeline/MemoryTimeline";
import { TopNavBar } from "@/components/Navigation/TopNavBar";
import { ViewGroupsPage } from "@/components/Pages/ViewGroupsPage";
import { PersonalInfoPage } from "@/components/Pages/PersonalInfoPage";
import { EditMemoriesPage } from "@/components/Pages/EditMemoriesPage";
import { useApp } from "@/contexts/AppContext";
import {
  createMemory,
  subscribeToMemories,
  updateMemory,
} from "@/lib/memories";
import {
  createGroupMemory,
  subscribeToGroupMemories,
  updateGroupMemory,
} from "@/lib/groups";
import { subscribeToMemoryLocationAggregates } from "@/lib/aggregates";
import type { AggregateMarker, Memory, MemoryInput, SelectedLocation } from "@/types/memory";

const MemoryMap = dynamic(
  () => import("@/components/Map/MemoryMap").then((module) => module.MemoryMap),
  {
    ssr: false,
  },
);

export function MemoryJarApp() {
  const {
    user,
    isAuthLoading,
    viewMode,
    currentPage,
    pendingAction,
    setPendingAction,
    selectedMemory,
    setSelectedMemory,
    memoryToEdit,
    setMemoryToEdit,
    currentGroupId,
    setViewMode,
  } = useApp();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [aggregateMarkers, setAggregateMarkers] = useState<AggregateMarker[]>([]);
  const [selectedAggregate, setSelectedAggregate] = useState<AggregateMarker | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeIndex, setRangeIndex] = useState(0);
  const [isPinDropMode, setIsPinDropMode] = useState(false);

  // Subscribe to memories based on view mode
  useEffect(() => {
    if (!user) {
      setMemories([]);
      return;
    }

    if (viewMode === "everyone") {
      setMemories([]);
      setSelectedMemory(null);
      return subscribeToMemoryLocationAggregates(
        (markers) => setAggregateMarkers(markers.filter((marker) => marker.count > 0)),
        (snapshotError) => setError(snapshotError.message),
      );
    }

    setAggregateMarkers([]);
    setSelectedAggregate(null);

    if (viewMode === "my-memories") {
      return subscribeToMemories(
        user.uid,
        setMemories,
        (snapshotError) => setError(snapshotError.message),
      );
    }

    // For group view, subscribe to group memories
    if (currentGroupId) {
      return subscribeToGroupMemories(
        currentGroupId,
        setMemories,
        (snapshotError) => setError(snapshotError.message),
      );
    }
  }, [user, viewMode, currentGroupId, setSelectedMemory]);

  // Handle joined group from session storage (after join page redirect)
  useEffect(() => {
    const joinedGroupId = sessionStorage.getItem("joinedGroupId");
    if (joinedGroupId && user) {
      setViewMode(`group-${joinedGroupId}`);
      sessionStorage.removeItem("joinedGroupId");
    }
  }, [user, setViewMode]);

  // Handle pending action after login
  useEffect(() => {
    if (user && pendingAction) {
      if (pendingAction.type === "add-memory") {
        openAddModal();
        setPendingAction(null);
      }
    }
  }, [user, pendingAction, setPendingAction]);

  // Open edit modal only for explicit edit requests from management pages.
  useEffect(() => {
    if (memoryToEdit && currentPage === "main") {
      openEditModal(memoryToEdit);
      setMemoryToEdit(null);
    }
  }, [memoryToEdit, currentPage, setMemoryToEdit]);

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
    setSelectedMemory(null);
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
      if (currentGroupId) {
        // Group memory
        if (editingMemory) {
          await updateGroupMemory(currentGroupId, editingMemory, input, photos, photoUrlsToKeep);
        } else {
          await createGroupMemory(currentGroupId, user.uid, input, photos);
        }
      } else {
        // Personal memory
        if (editingMemory) {
          await updateMemory(user.uid, editingMemory, input, photos, photoUrlsToKeep);
        } else {
          await createMemory(user.uid, input, photos);
        }
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

  const handleTimelineRange = (index: number) => {
    setRangeIndex(index);
    const memory = sortedMemories[index];
    if (memory) setSelectedMemory(memory);
  };

  // Can add memory when not in "everyone" view
  const canAddMemory = viewMode !== "everyone";

  if (isAuthLoading) {
    return <main className="loading-shell">Opening Memory Jar...</main>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Render different pages based on currentPage
  if (currentPage === "view-groups") {
    return (
      <div className="app-shell-with-nav">
        <TopNavBar onAddMemory={openAddModal} canAddMemory={canAddMemory} />
        <ViewGroupsPage />
      </div>
    );
  }

  if (currentPage === "personal-info") {
    return (
      <div className="app-shell-with-nav">
        <TopNavBar onAddMemory={openAddModal} canAddMemory={canAddMemory} />
        <PersonalInfoPage />
      </div>
    );
  }

  if (currentPage === "edit-memories") {
    return (
      <div className="app-shell-with-nav">
        <TopNavBar onAddMemory={openAddModal} canAddMemory={canAddMemory} />
        <EditMemoriesPage />
      </div>
    );
  }

  // Main map view
  return (
    <main className="app-shell-with-nav">
      <TopNavBar onAddMemory={openAddModal} canAddMemory={canAddMemory} />

      {error ? <div className="error-toast">{error}</div> : null}

      <div className="map-container">
        <MemoryMap
          draftLocation={selectedLocation}
          aggregateMarkers={aggregateMarkers}
          isPinDropMode={isPinDropMode}
          memories={memories}
          selectedAggregate={selectedAggregate}
          viewMode={viewMode}
          onLocationSelected={setSelectedLocation}
          onPinDropComplete={() => setIsPinDropMode(false)}
          onSelectAggregate={setSelectedAggregate}
          onSelectMemory={setSelectedMemory}
          selectedMemory={selectedMemory}
        />
      </div>

      <MemoryDetailPanel
        memory={viewMode === "everyone" ? null : selectedMemory}
        onClose={() => setSelectedMemory(null)}
      />

      <AggregateDetailPanel
        marker={viewMode === "everyone" ? selectedAggregate : null}
        onClose={() => setSelectedAggregate(null)}
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
