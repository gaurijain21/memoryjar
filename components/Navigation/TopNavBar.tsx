"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Plus, ChevronDown, User, Users, Edit3, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useApp } from "@/contexts/AppContext";
import { UserAvatar } from "@/components/UserAvatar";
import { ViewModeDropdown } from "./ViewModeDropdown";
import { CreateGroupModal } from "@/components/Groups/CreateGroupModal";
import { trackButtonClick, trackEvent } from "@/lib/analytics";

interface TopNavBarProps {
  onAddMemory: () => void;
  canAddMemory: boolean;
}

export function TopNavBar({ onAddMemory, canAddMemory }: TopNavBarProps) {
  const { user, viewMode, setCurrentPage, requestLogin, currentGroup } = useApp();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const viewDropdownRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleProfileAction = (action: "personal-info" | "view-groups" | "edit-memories" | "logout") => {
    setIsProfileMenuOpen(false);
    
    if (action === "logout") {
      trackEvent("logout_clicked", { page: "top_ribbon" });
      signOut(auth);
      return;
    }

    if (!user) {
      requestLogin({ type: action });
      return;
    }

    setCurrentPage(action);
  };

  const handleAddMemory = () => {
    trackEvent("add_memory_clicked", { selected_view: viewMode });
    trackButtonClick("add_memory", "top_ribbon", { selected_view: viewMode });
    if (!user) {
      requestLogin({ type: "add-memory" });
      return;
    }
    onAddMemory();
  };

  // Get view mode display text
  const getViewModeLabel = () => {
    if (viewMode === "all-memories") return "All Memories";
    if (viewMode === "my-memories") return "My Memories";
    if (viewMode === "everyone") return "Everyone";
    if (viewMode.startsWith("group-")) {
      return currentGroup?.name ?? "Group";
    }
    return "My Memories";
  };

  return (
    <>
      <header className="top-nav-bar">
        {/* Left: Logo */}
        <div className="nav-brand" onClick={() => setCurrentPage("main")} role="button" tabIndex={0}>
          <div className="nav-brand-icon">
            <Image alt="" height={32} src="/logomap.jpg" width={32} />
          </div>
          <span className="nav-brand-text">Memory Jar</span>
        </div>

        {/* Center: Add Memory + View Dropdown */}
        <div className="nav-center">
          <button
            className="add-memory-button"
            onClick={handleAddMemory}
            disabled={!canAddMemory}
            type="button"
          >
            <Plus size={18} />
            <span>Add Memory</span>
          </button>

          <div className="view-dropdown-container" ref={viewDropdownRef}>
            <button
              className="view-dropdown-trigger"
              onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              type="button"
            >
              <span>{getViewModeLabel()}</span>
              <ChevronDown size={16} className={isViewDropdownOpen ? "rotated" : ""} />
            </button>
            
            {isViewDropdownOpen && (
              <ViewModeDropdown
                onClose={() => setIsViewDropdownOpen(false)}
                onCreateGroup={() => {
                  setIsViewDropdownOpen(false);
                  trackEvent("create_group_clicked", { selected_view: viewMode });
                  trackButtonClick("create_group", "view_dropdown", { selected_view: viewMode });
                  if (!user) {
                    requestLogin({ type: "view-groups" });
                    return;
                  }
                  setIsCreateGroupOpen(true);
                }}
              />
            )}
          </div>
        </div>

        {/* Right: Profile */}
        <div className="nav-profile" ref={profileMenuRef}>
          {user ? (
            <button
              className="profile-avatar-button"
              onClick={() => {
                const nextOpen = !isProfileMenuOpen;
                setIsProfileMenuOpen(nextOpen);
                if (nextOpen) trackEvent("profile_menu_opened", { selected_view: viewMode });
              }}
              type="button"
              aria-label="Profile menu"
            >
              <UserAvatar
                className="profile-avatar"
                email={user.email}
                id={user.uid}
                name={user.displayName}
                photoURL={user.photoURL}
              />
            </button>
          ) : (
            <button
              className="login-nav-button"
              onClick={() => requestLogin(null)}
              type="button"
            >
              Sign In
            </button>
          )}

          {isProfileMenuOpen && user && (
            <div className="profile-menu">
              <div className="profile-menu-header">
                <span className="profile-menu-name">{user.displayName ?? "User"}</span>
                <span className="profile-menu-email">{user.email}</span>
              </div>
              <div className="profile-menu-divider" />
              <button
                className="profile-menu-item"
                onClick={() => handleProfileAction("personal-info")}
                type="button"
              >
                <User size={16} />
                <span>Personal Information</span>
              </button>
              <button
                className="profile-menu-item"
                onClick={() => handleProfileAction("view-groups")}
                type="button"
              >
                <Users size={16} />
                <span>View Groups</span>
              </button>
              <button
                className="profile-menu-item"
                onClick={() => handleProfileAction("edit-memories")}
                type="button"
              >
                <Edit3 size={16} />
                <span>Edit Memories</span>
              </button>
              <div className="profile-menu-divider" />
              <button
                className="profile-menu-item profile-menu-item-danger"
                onClick={() => handleProfileAction("logout")}
                type="button"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {isCreateGroupOpen && (
        <CreateGroupModal onClose={() => setIsCreateGroupOpen(false)} />
      )}
    </>
  );
}
