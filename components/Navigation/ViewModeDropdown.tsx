"use client";

import { Globe, Lock, Users, Plus, Check } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

interface ViewModeDropdownProps {
  onClose: () => void;
  onCreateGroup: () => void;
}

export function ViewModeDropdown({ onClose, onCreateGroup }: ViewModeDropdownProps) {
  const { viewMode, setViewMode, groups, user } = useApp();

  const handleSelect = (mode: "my-memories" | "everyone" | `group-${string}`) => {
    setViewMode(mode);
    onClose();
  };

  return (
    <div className="view-dropdown-menu">
      <button
        className={`view-dropdown-item ${viewMode === "my-memories" ? "active" : ""}`}
        onClick={() => handleSelect("my-memories")}
        type="button"
      >
        <Lock size={16} />
        <span>My Memories</span>
        {viewMode === "my-memories" && <Check size={14} className="check-icon" />}
      </button>
      
      <button
        className={`view-dropdown-item ${viewMode === "everyone" ? "active" : ""}`}
        onClick={() => handleSelect("everyone")}
        type="button"
      >
        <Globe size={16} />
        <span>Everyone&apos;s Memories</span>
        {viewMode === "everyone" && <Check size={14} className="check-icon" />}
      </button>

      {user && groups.length > 0 && (
        <>
          <div className="view-dropdown-divider" />
          <div className="view-dropdown-section-label">Your Groups</div>
          {groups.map((group) => (
            <button
              key={group.id}
              className={`view-dropdown-item ${viewMode === `group-${group.id}` ? "active" : ""}`}
              onClick={() => handleSelect(`group-${group.id}`)}
              type="button"
            >
              <Users size={16} />
              <span>{group.name}</span>
              {viewMode === `group-${group.id}` && <Check size={14} className="check-icon" />}
            </button>
          ))}
        </>
      )}

      <div className="view-dropdown-divider" />
      <button
        className="view-dropdown-item view-dropdown-item-action"
        onClick={onCreateGroup}
        type="button"
      >
        <Plus size={16} />
        <span>Create Group</span>
      </button>
    </div>
  );
}
