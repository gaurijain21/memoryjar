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
import {
  trackButtonClick,
  trackEvent,
  trackMemoryCreated,
  trackMemoryEdited,
  trackPhotoUploaded,
} from "@/lib/analytics";
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
    groups,
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

  const sourceType = currentGroupId
    ? "group"
    : viewMode === "all-memories"
      ? "all_memories"
      : viewMode === "everyone"
        ? "everyones_memories"
        : "my_memories";

  useEffect(() => {
    if (!user || currentPage !== "main") return;
    trackEvent("home_map_view", { selected_view: viewMode });
  }, [currentPage, user, viewMode]);

  useEffect(() => {
    if (!user) return;
    if (currentPage === "personal-info") trackEvent("personal_information_view");
    if (currentPage === "edit-memories") trackEvent("edit_memories_view", { selected_view: viewMode });
    if (currentPage === "view-groups") trackEvent("view_groups_view");
  }, [currentPage, user, viewMode]);

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

    if (viewMode === "all-memories") {
      setSelectedMemory(null);
      const memoryBuckets = new Map<string, Memory[]>();

      const updateCombinedMemories = () => {
        const combined = Array.from(memoryBuckets.values()).flat();
        setMemories(combined);
      };

      const unsubscribers: Array<() => void> = [
        subscribeToMemories(
          user.uid,
          (personalMemories) => {
            memoryBuckets.set(
              "my-memories",
              personalMemories.map((memory) => ({
                ...memory,
                id: `private-${memory.id}`,
                groupId: null,
              })),
            );
            updateCombinedMemories();
          },
          (snapshotError) => setError(snapshotError.message),
        ),
      ];

      groups.forEach((group) => {
        unsubscribers.push(
          subscribeToGroupMemories(
            group.id,
            (groupMemories) => {
              memoryBuckets.set(
                `group-${group.id}`,
                groupMemories.map((memory) => ({
                  ...memory,
                  id: `group-${group.id}-${memory.id}`,
                  groupId: group.id,
                })),
              );
              updateCombinedMemories();
            },
            (snapshotError) => setError(snapshotError.message),
          ),
        );
      });

      return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    }

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
  }, [user, viewMode, currentGroupId, groups, setSelectedMemory]);

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
        trackEvent("add_memory_opened", { source_type: sourceType, selected_view: viewMode });
        setEditingMemory(null);
        setSelectedLocation(null);
        setIsPinDropMode(false);
        setIsModalOpen(true);
        setPendingAction(null);
      }
    }
  }, [pendingAction, setPendingAction, sourceType, user, viewMode]);

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
    trackEvent("add_memory_opened", { source_type: sourceType, selected_view: viewMode });
    setEditingMemory(null);
    setSelectedLocation(null);
    setIsPinDropMode(false);
    setIsModalOpen(true);
  };

  const openEditModal = (memory: Memory) => {
    trackEvent("edit_memory_opened", {
      source_type: memory.groupId ? "group" : "my_memories",
      group_id: memory.groupId,
    });
    setEditingMemory(memory);
    setSelectedLocation({
      locationName: memory.locationName,
      lat: memory.lat,
      lng: memory.lng,
      formattedAddress: memory.formattedAddress,
      locationSource: memory.locationSource,
      placeId: memory.placeId,
      placeName: memory.placeName,
      placePhotoReference: memory.placePhotoReference,
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
          trackMemoryEdited("group");
        } else {
          await createGroupMemory(currentGroupId, user.uid, input, photos);
          trackMemoryCreated("group");
        }
      } else {
        // Personal memory
        if (editingMemory) {
          await updateMemory(user.uid, editingMemory, input, photos, photoUrlsToKeep);
          trackMemoryEdited("my_memories");
        } else {
          await createMemory(user.uid, input, photos);
          trackMemoryCreated("my_memories");
        }
      }

      trackEvent("add_memory_saved", { source_type: currentGroupId ? "group" : "my_memories" });
      trackPhotoUploaded(photos.length, currentGroupId ? "group" : "my_memories");
      trackButtonClick("save_memory", "add_edit_memory", {
        source_type: currentGroupId ? "group" : "my_memories",
        group_id: currentGroupId,
      });
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

  // Can add memory only into a concrete personal or group context.
  const canAddMemory = viewMode !== "everyone" && viewMode !== "all-memories";

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
