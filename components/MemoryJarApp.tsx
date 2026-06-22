"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { LoginScreen } from "@/components/Auth/LoginScreen";
import { AddMemoryModal } from "@/components/Memory/AddMemoryModal";
import { AggregateDetailPanel } from "@/components/Memory/AggregateDetailPanel";
import { MemoryConfetti } from "@/components/Memory/MemoryConfetti";
import { MemoryDetailPanel } from "@/components/Memory/MemoryDetailPanel";
import { PublicActivityNotifications } from "@/components/Memory/PublicActivityNotifications";
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
import { subscribeToMemoryLocationAggregates, subscribeToPublicMemories } from "@/lib/aggregates";
import {
  trackButtonClick,
  trackEvent,
  trackMemoryCreated,
  trackMemoryEdited,
  trackPhotoUploaded,
} from "@/lib/analytics";
import { sortMemoriesNewestFirst } from "@/lib/memorySort";
import type { AggregateMarker, AggregatePreviewItem, Memory, MemoryDestination, MemoryInput, SelectedLocation } from "@/types/memory";

const MemoryMap = dynamic(
  () => import("@/components/Map/MemoryMap").then((module) => module.MemoryMap),
  {
    ssr: false,
  },
);

function getAggregateKey(memory: Pick<Memory, "lat" | "lng" | "placeId">) {
  return memory.placeId
    ? `place_${memory.placeId}`
    : `${memory.lat.toFixed(1)}_${memory.lng.toFixed(1)}`;
}

function sortNewestFirst(memories: Memory[]) {
  return sortMemoriesNewestFirst(memories);
}

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
    requestLogin,
    setViewMode,
  } = useApp();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [personalTimelineMemories, setPersonalTimelineMemories] = useState<Memory[]>([]);
  const [groupTimelineMemories, setGroupTimelineMemories] = useState<Memory[]>([]);
  const [publicMemories, setPublicMemories] = useState<Memory[]>([]);
  const [rawAggregateMarkers, setRawAggregateMarkers] = useState<AggregateMarker[]>([]);
  const [selectedAggregate, setSelectedAggregate] = useState<AggregateMarker | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPinDropMode, setIsPinDropMode] = useState(false);
  const [guestPublicPreviewCount, setGuestPublicPreviewCount] = useState(0);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const [timelineCollapseSignal, setTimelineCollapseSignal] = useState(0);
  const groupListenerKey = useMemo(
    () => groups
      .map((group) => group.id)
      .filter((groupId): groupId is string => Boolean(groupId?.trim()))
      .sort()
      .join("|"),
    [groups],
  );
  const groupNameMap = useMemo(
    () => Object.fromEntries(groups.map((group) => [group.id, group.name])),
    [groups],
  );

  const handleSubscriptionError = useCallback((snapshotError: Error & { code?: string }) => {
    const isPermissionNoise =
      snapshotError.code === "permission-denied"
      || snapshotError.message.toLowerCase().includes("missing or insufficient permissions");

    if (isPermissionNoise) {
      console.warn("[MemoryJar] Suppressed passive Firestore permission snapshot error", snapshotError);
      return;
    }

    setError(snapshotError.message);
  }, []);

  const sourceType = currentGroupId
    ? "group"
    : viewMode === "all-memories"
      ? "all_memories"
      : viewMode === "everyone"
        ? "everyones_memories"
        : "my_memories";
  const showEveryoneMode = viewMode === "everyone" || (!user && isAuthLoading);

  useEffect(() => {
    if (currentPage !== "main") return;
    trackEvent("home_map_view", { selected_view: viewMode });
  }, [currentPage, viewMode]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timeoutId = window.setTimeout(() => setSuccessMessage(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  useEffect(() => {
    if (user || isAuthLoading) return;
    if (viewMode !== "everyone") setViewMode("everyone");
  }, [isAuthLoading, setViewMode, user, viewMode]);

  useEffect(() => {
    if (!user) return;
    if (currentPage === "personal-info") trackEvent("personal_information_view");
    if (currentPage === "edit-memories") trackEvent("edit_memories_view", { selected_view: viewMode });
    if (currentPage === "view-groups") trackEvent("view_groups_view");
  }, [currentPage, user, viewMode]);

  useEffect(() => {
    // Public-readable listener: this is the single publicMemories snapshot used
    // by both Everyone's Memories markers and the independent timeline.
    return subscribeToPublicMemories(
      setPublicMemories,
      handleSubscriptionError,
    );
  }, [handleSubscriptionError]);

  const aggregateMarkers = useMemo(() => {
    const publicByAggregate = new Map<string, Memory[]>();
    const personalByAggregate = new Map<string, Memory[]>();
    const groupByAggregate = new Map<string, Memory[]>();

    publicMemories.forEach((memory) => {
      const key = getAggregateKey(memory);
      publicByAggregate.set(key, [...(publicByAggregate.get(key) ?? []), { ...memory, audience: "public" }]);
    });

    personalTimelineMemories.forEach((memory) => {
      const key = getAggregateKey(memory);
      personalByAggregate.set(key, [...(personalByAggregate.get(key) ?? []), { ...memory, audience: memory.audience ?? "private" }]);
    });

    groupTimelineMemories.forEach((memory) => {
      const key = getAggregateKey(memory);
      groupByAggregate.set(key, [...(groupByAggregate.get(key) ?? []), memory]);
    });

    const markers = rawAggregateMarkers
      .filter((marker) => marker.count > 0)
      .map((marker) => {
        const publicPreviews = sortNewestFirst(publicByAggregate.get(marker.id) ?? []);
        const personalPreviews = sortNewestFirst(personalByAggregate.get(marker.id) ?? []);
        const groupPreviews = sortNewestFirst(groupByAggregate.get(marker.id) ?? []);
        const privatePreviews = personalPreviews.filter((memory) => memory.audience !== "public");
        const publicPreview = publicPreviews[0] ?? null;
        const personalPreview = personalPreviews[0] ?? null;
        const groupPreview = groupPreviews[0] ?? null;
        const publicCount = marker.publicCount ?? publicPreviews.length;
        const groupCount = marker.groupCount ?? groupPreviews.length;
        const inferredHiddenCount = Math.max(0, marker.count - publicCount - groupCount - privatePreviews.length);
        const privateCount = marker.privateCount ?? (privatePreviews.length + inferredHiddenCount);
        const publicItems: AggregatePreviewItem[] = publicPreviews.map((memory) => ({
          id: `public-${memory.ownerId ?? "unknown"}-${memory.sourceMemoryId ?? memory.id}`,
          type: "public",
          memory,
          label: "Public memory",
        }));
        const privateItems: AggregatePreviewItem[] = privatePreviews.map((memory) => ({
          id: `private-${memory.ownerId ?? "owner"}-${memory.sourceMemoryId ?? memory.id}`,
          type: "private",
          memory,
          label: "Private memory",
        }));
        const groupItems: AggregatePreviewItem[] = groupPreviews.map((memory) => ({
          id: `group-${memory.groupId ?? "group"}-${memory.id}`,
          type: "group",
          memory,
          label: memory.groupName ?? "Group memory",
        }));
        const hiddenPrivateCount = Math.max(0, privateCount - privateItems.length);
        const hiddenGroupCount = Math.max(0, groupCount - groupItems.length);
        const hiddenPrivateItems: AggregatePreviewItem[] = Array.from({ length: hiddenPrivateCount }, (_, index) => ({
          id: `hidden-private-${marker.id}-${index}`,
          type: "private",
          memory: null,
          label: "Private memory",
        }));
        const hiddenGroupItems: AggregatePreviewItem[] = Array.from({ length: hiddenGroupCount }, (_, index) => ({
          id: `hidden-group-${marker.id}-${index}`,
          type: "group",
          memory: null,
          label: "Group memory",
        }));
        // Visibility carousel logic: public previews are shown first, then
        // readable owner/group items, then privacy-card placeholders for
        // aggregate-only private/group memories.
        const previewItems = [
          ...publicItems,
          ...privateItems,
          ...groupItems,
          ...hiddenPrivateItems,
          ...hiddenGroupItems,
        ];
        const previewMemory = publicPreview ?? personalPreview ?? groupPreview ?? null;

        // DEBUG visibility: aggregate docs are public-safe, while previewMemory
        // is selected only from data this client can read.
        console.info("[DEBUG everyone] aggregate categorize", {
          id: marker.id,
          count: marker.count,
          publicCount,
          privateCount,
          groupCount,
          hasPublicPreviewImage: Boolean(publicPreview?.photoUrls?.[0]),
          previewItemCount: previewItems.length,
          selectedPreviewId: previewMemory?.id ?? null,
          selectedPreviewAudience: previewMemory?.groupId ? "group" : previewMemory?.audience ?? null,
          isLoggedIn: Boolean(user),
          isOwnerPreview: Boolean(user && previewMemory?.ownerId === user.uid),
          isGroupPreview: Boolean(previewMemory?.groupId),
          shouldImageBeVisible: Boolean(previewMemory && (previewMemory.audience === "public" || previewMemory.ownerId === user?.uid || previewMemory.groupId)),
        });

        return {
          ...marker,
          publicCount,
          privateCount,
          groupCount,
          previewMemory,
          previewItems,
        };
      });
    return markers;
  }, [groupTimelineMemories, personalTimelineMemories, publicMemories, rawAggregateMarkers, user]);

  useEffect(() => {
    if (!showEveryoneMode) return;
    console.info("[DEBUG aggregate] rendered circle count", aggregateMarkers.length);
    if (!user) {
      console.info("[DEBUG aggregate] before-login rendered count", aggregateMarkers.length);
    }
  }, [aggregateMarkers.length, showEveryoneMode, user]);

  useEffect(() => {
    if (!selectedAggregate) return;

    // DEBUG/privacy sync: keep the open Everyone's Memories thumbnail aligned
    // with the latest public/group preview data as aggregate listeners refresh.
    const refreshedMarker = aggregateMarkers.find((marker) => marker.id === selectedAggregate.id);

    if (!refreshedMarker) {
      setSelectedAggregate(null);
      return;
    }

    if (refreshedMarker !== selectedAggregate) {
      setSelectedAggregate(refreshedMarker);
    }
  }, [aggregateMarkers, selectedAggregate]);

  const timelineMemories = useMemo(() => {
    const seen = new Set<string>();

    return [...publicMemories, ...personalTimelineMemories, ...groupTimelineMemories]
      .filter((memory) => {
        const stableKey = memory.sourceMemoryId && memory.ownerId
          ? `personal:${memory.ownerId}:${memory.sourceMemoryId}`
          : `${memory.groupId ?? "personal"}:${memory.id}`;
        if (seen.has(stableKey)) return false;
        seen.add(stableKey);
        return true;
      })
      .sort((a, b) => sortMemoriesNewestFirst([a, b])[0] === a ? -1 : 1);
  }, [groupTimelineMemories, personalTimelineMemories, publicMemories]);

  // Subscribe to memories based on view mode
  useEffect(() => {
    if (!user) {
      setMemories([]);
      setSelectedMemory(null);
      setSelectedAggregate(null);
      if (!isAuthLoading && viewMode !== "everyone") setViewMode("everyone");
      return subscribeToMemoryLocationAggregates(
        setRawAggregateMarkers,
        handleSubscriptionError,
      );
    }

    if (showEveryoneMode) {
      setMemories([]);
      setSelectedMemory(null);
      return subscribeToMemoryLocationAggregates(
        setRawAggregateMarkers,
        handleSubscriptionError,
      );
    }

    setRawAggregateMarkers([]);
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
                  sourceMemoryId: memory.id,
                  ownerId: user.uid,
                  groupId: null,
                })),
            );
            updateCombinedMemories();
          },
          handleSubscriptionError,
        ),
      ];

      groupListenerKey.split("|").filter(Boolean).forEach((groupId) => {
        unsubscribers.push(
          subscribeToGroupMemories(
            groupId,
            (groupMemories) => {
              memoryBuckets.set(
                `group-${groupId}`,
                groupMemories.map((memory) => ({
                  ...memory,
                  id: `group-${groupId}-${memory.id}`,
                  sourceMemoryId: memory.id,
                  groupId,
                  groupName: groupNameMap[groupId] ?? "Group memory",
                })),
              );
              updateCombinedMemories();
            },
            handleSubscriptionError,
          ),
        );
      });

      return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    }

    if (viewMode === "my-memories") {
      return subscribeToMemories(
        user.uid,
        (personalMemories) => setMemories(personalMemories.map((memory) => ({
          ...memory,
          ownerId: user.uid,
          sourceMemoryId: memory.id,
        }))),
        handleSubscriptionError,
      );
    }

    // For group view, subscribe to group memories
    if (currentGroupId) {
      return subscribeToGroupMemories(
        currentGroupId,
        (groupMemories) => {
          setMemories(groupMemories.map((memory) => ({
            ...memory,
            groupId: currentGroupId,
            groupName: groupNameMap[currentGroupId] ?? "Group memory",
          })));
        },
        handleSubscriptionError,
      );
    }
  }, [user, isAuthLoading, viewMode, currentGroupId, groupListenerKey, groupNameMap, setSelectedMemory, setViewMode, handleSubscriptionError, showEveryoneMode]);

  useEffect(() => {
    if (isAuthLoading) {
      setPersonalTimelineMemories([]);
      setGroupTimelineMemories([]);
      return undefined;
    }

    const unsubscribers: Array<() => void> = [];

    if (user) {
      setGroupTimelineMemories([]);
      const groupBuckets = new Map<string, Memory[]>();
      const updateGroupTimelineMemories = () => {
        setGroupTimelineMemories(Array.from(groupBuckets.values()).flat());
      };

      unsubscribers.push(
        subscribeToMemories(
          user.uid,
          (personalMemories) => {
            setPersonalTimelineMemories(
              personalMemories.map((memory) => ({
                ...memory,
                ownerId: user.uid,
                sourceMemoryId: memory.id,
              })),
            );
          },
          handleSubscriptionError,
        ),
      );

      groupListenerKey.split("|").filter(Boolean).forEach((groupId) => {
        unsubscribers.push(
          subscribeToGroupMemories(
            groupId,
            (groupMemories) => {
              groupBuckets.set(
                `group-${groupId}`,
                groupMemories.map((memory) => ({
                  ...memory,
                  groupId,
                  groupName: groupNameMap[groupId] ?? "Group memory",
                })),
              );
              updateGroupTimelineMemories();
            },
            handleSubscriptionError,
          ),
        );
      });
    } else {
      setPersonalTimelineMemories([]);
      setGroupTimelineMemories([]);
    }

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [groupListenerKey, groupNameMap, handleSubscriptionError, isAuthLoading, user]);

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
        if (pendingAction.groupId) {
          setViewMode(`group-${pendingAction.groupId}`);
        }
        trackEvent("add_memory_opened", { source_type: sourceType, selected_view: viewMode });
        setEditingMemory(null);
        setSelectedLocation(null);
        setIsPinDropMode(false);
        setIsModalOpen(true);
        setPendingAction(null);
      }
    }
  }, [pendingAction, setPendingAction, setViewMode, sourceType, user, viewMode]);

  // Open edit modal only for explicit edit requests from management pages.
  useEffect(() => {
    if (memoryToEdit && currentPage === "main") {
      openEditModal(memoryToEdit);
      setMemoryToEdit(null);
    }
  }, [memoryToEdit, currentPage, setMemoryToEdit]);

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
    options: { destination: MemoryDestination; audience: "private" | "public" },
  ) => {
    if (!user) return;
    setIsSaving(true);
    setError(null);

    try {
      const targetGroupId = options.destination.startsWith("group-")
        ? options.destination.replace("group-", "")
        : null;
      const isPublicPersonalSave = options.destination === "my-memories" && options.audience === "public";

      if (editingMemory?.groupId || (!editingMemory && targetGroupId)) {
        const groupId = editingMemory?.groupId ?? targetGroupId;
        if (!groupId) throw new Error("Select a group before saving this memory.");

        // Audience/group logic: group memories stay inside the selected group
        // and do not create public Everyone's Memories previews.
        if (editingMemory) {
          await updateGroupMemory(groupId, editingMemory, input, photos, photoUrlsToKeep);
          trackMemoryEdited("group");
        } else {
          await createGroupMemory(groupId, user.uid, input, photos);
          trackMemoryCreated("group");
        }
      } else {
        // Audience/group logic: personal memories always belong to the current
        // user; public ones are mirrored for Everyone's Memories.
        if (editingMemory) {
          await updateMemory(user.uid, editingMemory, input, photos, photoUrlsToKeep);
          trackMemoryEdited("my_memories");
        } else {
          await createMemory(user.uid, input, photos);
          trackMemoryCreated("my_memories");
        }
      }

      const savedSourceType = options.destination.startsWith("group-") ? "group" : "my_memories";
      const savedGroupId = options.destination.startsWith("group-")
        ? options.destination.replace("group-", "")
        : null;

      trackEvent("add_memory_saved", { source_type: savedSourceType });
      trackPhotoUploaded(photos.length, savedSourceType);
      trackButtonClick("save_memory", "add_edit_memory", {
        source_type: savedSourceType,
        group_id: savedGroupId,
      });
      setSuccessMessage("Memory saved successfully");
      window.dispatchEvent(new CustomEvent("memoryjar:confetti", { detail: { uid: user.uid } }));
      closeModal();
      setSelectedLocation(null);
      setIsPinDropMode(false);
      if (isPublicPersonalSave) {
        setViewMode("all-memories");
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save memory.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectAggregate = (marker: AggregateMarker) => {
    const firstPreviewItem = marker.previewItems?.[0] ?? null;
    const isPublicPreview = firstPreviewItem?.type === "public"
      || (marker.previewMemory?.audience === "public" && !marker.previewMemory.groupId);
    const canViewImage = Boolean(marker.previewMemory)
      && (isPublicPreview || Boolean(user && marker.previewMemory?.ownerId === user.uid) || Boolean(marker.previewMemory?.groupId));

    console.info("[DEBUG everyone] circle click", {
      id: marker.id,
      selectedPreviewId: marker.previewMemory?.id ?? null,
      audience: marker.previewMemory?.groupId ? "group" : marker.previewMemory?.audience ?? null,
      isPublic: isPublicPreview,
      canViewImage,
      isLoggedIn: Boolean(user),
      isCurrentUserOwner: Boolean(user && marker.previewMemory?.ownerId === user.uid),
      isCurrentUserGroupMember: Boolean(marker.previewMemory?.groupId),
      guestPublicPreviewCount,
    });

    if (!user && isPublicPreview && guestPublicPreviewCount >= 3) {
      console.info("[DEBUG everyone] public preview limit reached", {
        id: marker.id,
        guestPublicPreviewCount,
      });
      requestLogin(null);
      return;
    }

    setSelectedAggregate(marker);

    if (!user && isPublicPreview) {
      setGuestPublicPreviewCount((count) => {
        console.info("[DEBUG everyone] public preview limit count", {
          before: count,
          after: count + 1,
          markerId: marker.id,
        });
        return count + 1;
      });
    }
  };

  const handlePublicPreviewAttempt = useCallback((markerId: string, previewId: string) => {
    if (user) return true;

    if (guestPublicPreviewCount >= 3) {
      console.info("[DEBUG everyone] public preview limit reached", {
        id: markerId,
        previewId,
        guestPublicPreviewCount,
      });
      requestLogin(null);
      return false;
    }

    setGuestPublicPreviewCount((count) => {
      console.info("[DEBUG everyone] public preview limit count", {
        before: count,
        after: count + 1,
        markerId,
        previewId,
      });
      return count + 1;
    });
    return true;
  }, [guestPublicPreviewCount, requestLogin, user]);

  const handleSelectTimelineMemory = (memory: Memory) => {
    if (!user && guestPublicPreviewCount >= 3) {
      console.info("[DEBUG everyone] timeline public preview limit reached", {
        memoryId: memory.id,
        guestPublicPreviewCount,
      });
      requestLogin(null);
      return;
    }

    setSelectedAggregate(null);
    setSelectedMemory(memory);

    if (!user) {
      setGuestPublicPreviewCount((count) => {
        console.info("[DEBUG everyone] public preview limit count", {
          before: count,
          after: count + 1,
          memoryId: memory.id,
          source: "timeline",
        });
        return count + 1;
      });
    }
  };

  // Add Memory is available from all main view modes; the form decides whether
  // the saved memory goes to My Memories or a selected group.
  const canAddMemory = true;
  const showLoginPrompt = !user && pendingAction !== null;
  const defaultMemoryDestination: MemoryDestination = currentGroupId
    ? (`group-${currentGroupId}` as MemoryDestination)
    : "my-memories";

  // Render different pages based on currentPage
  if (user && currentPage === "view-groups") {
    return (
      <div className="app-shell-with-nav">
        <TopNavBar onAddMemory={openAddModal} canAddMemory={canAddMemory} />
        <ViewGroupsPage />
      </div>
    );
  }

  if (user && currentPage === "personal-info") {
    return (
      <div className="app-shell-with-nav">
        <TopNavBar onAddMemory={openAddModal} canAddMemory={canAddMemory} />
        <PersonalInfoPage />
      </div>
    );
  }

  if (user && currentPage === "edit-memories") {
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
      {successMessage ? (
        <div className={`success-toast save-success-toast ${isTimelineExpanded ? "above-timeline" : ""}`}>
          {successMessage}
        </div>
      ) : null}
      <MemoryConfetti />
      <PublicActivityNotifications
        hidden={Boolean(selectedMemory || selectedAggregate || isModalOpen)}
        memories={publicMemories}
        timelineExpanded={isTimelineExpanded}
      />

      <div className="map-container">
        <MemoryMap
          draftLocation={selectedLocation}
          aggregateMarkers={aggregateMarkers}
          isPinDropMode={isPinDropMode}
          memories={memories}
          selectedAggregate={selectedAggregate}
          viewMode={showEveryoneMode ? "everyone" : viewMode}
          onLocationSelected={setSelectedLocation}
          onMapInteraction={() => setTimelineCollapseSignal((current) => current + 1)}
          onPinDropComplete={() => setIsPinDropMode(false)}
          onSelectAggregate={handleSelectAggregate}
          onSelectMemory={setSelectedMemory}
          selectedMemory={selectedMemory}
        />
      </div>

      <MemoryDetailPanel
        memory={selectedMemory}
        onClose={() => setSelectedMemory(null)}
      />

      <AggregateDetailPanel
        marker={showEveryoneMode ? selectedAggregate : null}
        onClose={() => setSelectedAggregate(null)}
        onPublicPreviewAttempt={handlePublicPreviewAttempt}
      />

      {user ? (
        <MemoryTimeline
          collapseSignal={timelineCollapseSignal}
          memories={timelineMemories}
          onExpandedChange={setIsTimelineExpanded}
          onSelectMemory={handleSelectTimelineMemory}
          selectedMemoryId={selectedMemory?.id}
        />
      ) : null}

      <AddMemoryModal
        editingMemory={editingMemory}
        defaultDestination={defaultMemoryDestination}
        groups={groups}
        isOpen={isModalOpen}
        isSaving={isSaving}
        onClose={closeModal}
        onLocationSelected={setSelectedLocation}
        onRequestPinDrop={() => setIsPinDropMode(true)}
        onSubmit={handleSubmitMemory}
        pinDropMode={isPinDropMode}
        selectedLocation={selectedLocation}
      />

      {showLoginPrompt ? (
        <LoginScreen
          variant="modal"
          onClose={() => setPendingAction(null)}
        />
      ) : null}
    </main>
  );
}
