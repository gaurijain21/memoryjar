"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { subscribeToUserGroups } from "@/lib/groups";
import type { Group, ViewMode, AppPage, Memory } from "@/types/memory";

// Pending action types for login redirects
export type PendingAction =
  | { type: "add-memory" }
  | { type: "edit-memories" }
  | { type: "view-groups" }
  | { type: "personal-info" }
  | { type: "join-group"; joinCode: string }
  | null;

interface AppContextValue {
  // Auth state
  user: User | null;
  isAuthLoading: boolean;
  
  // View mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  
  // Current page
  currentPage: AppPage;
  setCurrentPage: (page: AppPage) => void;
  
  // Groups
  groups: Group[];
  isGroupsLoading: boolean;
  
  // Pending action for login redirects
  pendingAction: PendingAction;
  setPendingAction: (action: PendingAction) => void;
  
  // Selected memory for editing
  selectedMemory: Memory | null;
  setSelectedMemory: (memory: Memory | null) => void;

  memoryToEdit: Memory | null;
  setMemoryToEdit: (memory: Memory | null) => void;
  
  // Helper to get current group ID from view mode
  currentGroupId: string | null;
  
  // Helper to get current group
  currentGroup: Group | null;
  
  // Request login with pending action
  requestLogin: (action: PendingAction) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("my-memories");
  
  // Current page
  const [currentPage, setCurrentPage] = useState<AppPage>("main");
  
  // Groups
  const [groups, setGroups] = useState<Group[]>([]);
  const [isGroupsLoading, setIsGroupsLoading] = useState(true);
  
  // Pending action
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  
  // Selected memory for editing
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [memoryToEdit, setMemoryToEdit] = useState<Memory | null>(null);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.info("[MemoryJar auth] onAuthStateChanged user", {
        currentUserExists: Boolean(firebaseUser),
        uid: firebaseUser?.uid ?? null,
        email: firebaseUser?.email ?? null,
      });
      setUser(firebaseUser);
      setIsAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Groups listener
  useEffect(() => {
    if (!user) {
      setGroups([]);
      setIsGroupsLoading(false);
      return;
    }

    setIsGroupsLoading(true);
    const unsubscribe = subscribeToUserGroups(
      user.uid,
      (fetchedGroups) => {
        setGroups(fetchedGroups);
        setIsGroupsLoading(false);
      },
      (error) => {
        console.error("Error fetching groups:", error);
        setIsGroupsLoading(false);
      }
    );
    return unsubscribe;
  }, [user]);

  // Compute current group ID from view mode
  const currentGroupId = viewMode.startsWith("group-")
    ? viewMode.replace("group-", "")
    : null;

  // Get current group
  const currentGroup = currentGroupId
    ? groups.find((g) => g.id === currentGroupId) ?? null
    : null;

  // Request login with pending action
  const requestLogin = useCallback((action: PendingAction) => {
    setPendingAction(action);
    // The LoginScreen will be shown by the app when user is null
    // After login, the pending action will be processed
  }, []);

  // Process pending action after login
  useEffect(() => {
    if (user && pendingAction) {
      switch (pendingAction.type) {
        case "edit-memories":
          setCurrentPage("edit-memories");
          break;
        case "view-groups":
          setCurrentPage("view-groups");
          break;
        case "personal-info":
          setCurrentPage("personal-info");
          break;
        // add-memory and join-group are handled elsewhere
      }
      // Clear the pending action after processing
      if (pendingAction.type !== "add-memory" && pendingAction.type !== "join-group") {
        setPendingAction(null);
      }
    }
  }, [user, pendingAction]);

  const value: AppContextValue = {
    user,
    isAuthLoading,
    viewMode,
    setViewMode,
    currentPage,
    setCurrentPage,
    groups,
    isGroupsLoading,
    pendingAction,
    setPendingAction,
    selectedMemory,
    setSelectedMemory,
    memoryToEdit,
    setMemoryToEdit,
    currentGroupId,
    currentGroup,
    requestLogin,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
