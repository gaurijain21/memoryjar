"use client";

import { useState } from "react";
import { X, Copy, Check, Link2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { createGroup, getGroup } from "@/lib/groups";
import { trackButtonClick, trackGroupCreated } from "@/lib/analytics";

interface CreateGroupModalProps {
  onClose: () => void;
}

export function CreateGroupModal({ onClose }: CreateGroupModalProps) {
  const { user, setViewMode } = useApp();
  const [groupName, setGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<{ id: string; joinCode: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!user || !groupName.trim()) return;
    
    setIsCreating(true);
    setError(null);

    try {
      const groupId = await createGroup(
        user.uid,
        {
          displayName: user.displayName ?? user.email ?? "User",
          email: user.email,
          photoURL: user.photoURL,
        },
        { name: groupName.trim() }
      );
      trackGroupCreated(groupId);
      
      const group = await getGroup(groupId);
      if (group) {
        setCreatedGroup({ id: groupId, joinCode: group.joinCode, name: group.name });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsCreating(false);
    }
  };

  const joinLink = createdGroup 
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${createdGroup.joinCode}`
    : "";

  const handleCopy = async () => {
    trackButtonClick("copy_group_invite_link", "create_group_modal", {
      group_id: createdGroup?.id,
    });
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = joinLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDone = () => {
    if (createdGroup) {
      trackButtonClick("group_created_done", "create_group_modal", { group_id: createdGroup.id });
      setViewMode(`group-${createdGroup.id}`);
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="group-modal-header">
          <h2>{createdGroup ? "Group Created!" : "Create a Group"}</h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!createdGroup ? (
          <>
            <p className="group-modal-description">
              Create a group to share memories with friends and family.
            </p>

            <label className="group-input-label">
              <span>Group Name</span>
              <input
                type="text"
                placeholder="e.g., Family Vacation 2024"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={50}
                autoFocus
              />
            </label>

            {error && <div className="group-error">{error}</div>}

            <div className="group-modal-actions">
              <button className="secondary-button" onClick={onClose} type="button">
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={handleCreate}
                disabled={!groupName.trim() || isCreating}
                type="button"
              >
                {isCreating ? "Creating..." : "Create Group"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="group-success-message">
              <div className="group-name-badge">{createdGroup.name}</div>
              <p>Share this link with others to invite them to your group:</p>
            </div>

            <div className="join-link-container">
              <Link2 size={16} className="join-link-icon" />
              <input
                type="text"
                value={joinLink}
                readOnly
                className="join-link-input"
              />
              <button
                className="copy-button"
                onClick={handleCopy}
                type="button"
                aria-label="Copy link"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <div className="join-code-display">
              <span className="join-code-label">Or share this code:</span>
              <span className="join-code">{createdGroup.joinCode}</span>
            </div>

            <div className="group-modal-actions">
              <button className="primary-button" onClick={handleDone} type="button">
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
