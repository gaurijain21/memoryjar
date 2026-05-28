"use client";

import { useState } from "react";
import { ArrowLeft, Users, Crown, Trash2, LogOut, Check, Link2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { deleteGroup, leaveGroup, removeMember } from "@/lib/groups";
import type { Group } from "@/types/memory";

export function ViewGroupsPage() {
  const { user, groups, setCurrentPage, setViewMode } = useApp();
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState<string | null>(null);
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleViewGroup = (group: Group) => {
    setViewMode(`group-${group.id}`);
    setCurrentPage("main");
  };

  const handleCopyLink = async (group: Group) => {
    const link = `${window.location.origin}/join/${group.joinCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedGroupId(group.id);
      setTimeout(() => setCopiedGroupId(null), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedGroupId(group.id);
      setTimeout(() => setCopiedGroupId(null), 2000);
    }
  };

  const handleLeave = async (group: Group) => {
    if (!user) return;
    const confirmed = window.confirm(`Leave "${group.name}"? You will no longer have access to this group's memories.`);
    if (!confirmed) return;

    setIsLeaving(group.id);
    setError(null);

    try {
      await leaveGroup(user.uid, group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave group");
    } finally {
      setIsLeaving(null);
    }
  };

  const handleDelete = async (group: Group) => {
    if (!user) return;
    if (group.ownerId !== user.uid) {
      setError("Only the owner can delete this group.");
      return;
    }

    const confirmed = window.confirm(`Delete "${group.name}"? This will permanently delete all memories in this group.`);
    if (!confirmed) return;

    setIsDeleting(group.id);
    setError(null);

    try {
      await deleteGroup(user.uid, group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete group");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRemoveMember = async (group: Group, memberUid: string, memberName: string) => {
    if (!user) return;
    const confirmed = window.confirm(`Remove ${memberName} from "${group.name}"?`);
    if (!confirmed) return;

    setError(null);
    try {
      await removeMember(user.uid, group.id, memberUid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <button 
          className="back-button" 
          onClick={() => setCurrentPage("main")} 
          type="button"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">Your Groups</h1>
      </div>

      {error && <div className="page-error">{error}</div>}

      {groups.length === 0 ? (
        <div className="empty-state">
          <Users size={48} className="empty-state-icon" />
          <h3>No groups yet</h3>
          <p>Create a group to share memories with friends and family.</p>
        </div>
      ) : (
        <div className="groups-list">
          {groups.map((group) => {
            const isOwner = user?.uid === group.ownerId;
            const isExpanded = expandedGroupId === group.id;
            const memberCount = group.memberIds.length;

            return (
              <div key={group.id} className="group-card">
                <div 
                  className="group-card-header"
                  onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="group-card-icon">
                    <Users size={20} />
                  </div>
                  <div className="group-card-info">
                    <div className="group-card-name">
                      {group.name}
                      {isOwner && (
                        <span className="owner-badge">
                          <Crown size={12} />
                          Owner
                        </span>
                      )}
                    </div>
                    <div className="group-card-meta">
                      {memberCount} {memberCount === 1 ? "member" : "members"}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="group-card-expanded">
                    <div className="group-card-actions">
                      <button 
                        className="group-action-button"
                        onClick={() => handleViewGroup(group)}
                        type="button"
                      >
                        Group Memories
                      </button>
                      <button
                        className="group-action-button"
                        onClick={() => setError("Member editing is coming soon. Owners can remove members below.")}
                        type="button"
                      >
                        Edit Members
                      </button>
                      <button
                        className="group-action-button"
                        onClick={() => handleCopyLink(group)}
                        type="button"
                      >
                        {copiedGroupId === group.id ? (
                          <>
                            <Check size={14} />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Link2 size={14} />
                            Copy Invite Link
                          </>
                        )}
                      </button>
                    </div>

                    <div className="group-members-section">
                      <h4>Members</h4>
                      <div className="group-members-list">
                        {Object.values(group.members).filter(Boolean).map((member) => (
                          <div key={member.uid} className="group-member">
                            {member.photoURL ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={member.photoURL} alt="" className="member-avatar" />
                            ) : (
                              <div className="member-avatar-placeholder" />
                            )}
                            <span className="member-name">
                              {member.displayName}
                              {member.uid === group.ownerId && (
                                <Crown size={12} className="member-crown" />
                              )}
                            </span>
                            {isOwner && member.uid !== user?.uid && (
                              <button
                                className="remove-member-button"
                                onClick={() => handleRemoveMember(group, member.uid, member.displayName)}
                                type="button"
                                aria-label={`Remove ${member.displayName}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="group-card-footer">
                      {!isOwner ? (
                        <button
                          className="secondary-button"
                          onClick={() => handleLeave(group)}
                          disabled={isLeaving === group.id}
                          type="button"
                        >
                          <LogOut size={14} />
                          {isLeaving === group.id ? "Leaving..." : "Leave Group"}
                        </button>
                      ) : null}
                      <button
                        className="danger-button"
                        onClick={() => handleDelete(group)}
                        disabled={isDeleting === group.id}
                        type="button"
                      >
                        <Trash2 size={14} />
                        {isDeleting === group.id ? "Deleting..." : "Delete Group"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
