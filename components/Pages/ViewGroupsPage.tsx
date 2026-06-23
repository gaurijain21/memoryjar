"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Users, Crown, Trash2, LogOut, Check, Link2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { UserAvatar } from "@/components/UserAvatar";
import { deleteGroup, leaveGroup, removeMember } from "@/lib/groups";
import { trackButtonClick, trackEvent } from "@/lib/analytics";
import type { Group } from "@/types/memory";

type ViewGroupsPageProps = {
  embedded?: boolean;
};

export function ViewGroupsPage({ embedded = false }: ViewGroupsPageProps) {
  const { user, groups, setCurrentPage, setViewMode } = useApp();
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState<string | null>(null);
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locallyRemovedMembers, setLocallyRemovedMembers] = useState<Record<string, string[]>>({});

  useEffect(() => {
    trackEvent("view_groups_opened");
  }, []);

  const handleGroupMemories = (group: Group) => {
    trackEvent("group_memories_opened", { group_id: group.id });
    trackEvent("group_detail_view", { group_id: group.id });
    setViewMode(`group-${group.id}`);
    setCurrentPage("edit-memories");
  };

  const handleCopyLink = async (group: Group) => {
    trackButtonClick("copy_group_invite_link", "view_groups", { group_id: group.id });
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
      trackEvent("group_deleted", { group_id: group.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete group");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRemoveMember = async (group: Group, memberUid: string, memberName: string) => {
    if (!user) return;
    if (group.ownerId !== user.uid) {
      setError("Only the owner can remove members.");
      return;
    }
    if (memberUid === group.ownerId) {
      setError("The owner cannot be removed.");
      return;
    }
    if (memberUid === user.uid) {
      setError("Use Leave Group to remove yourself.");
      return;
    }

    const confirmed = window.confirm(`Remove ${memberName} from "${group.name}"?`);
    if (!confirmed) return;

    setError(null);
    try {
      await removeMember(user.uid, group.id, memberUid);
      trackEvent("member_removed", { group_id: group.id });
      setLocallyRemovedMembers((current) => ({
        ...current,
        [group.id]: [...(current[group.id] ?? []), memberUid],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  return (
    <div className={`page-container ${embedded ? "embedded-page" : ""}`}>
      <div className="page-header">
        {!embedded ? (
          <button 
            className="back-button" 
            onClick={() => {
              setCurrentPage("main");
            }} 
            type="button"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
        ) : null}
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
                        onClick={() => handleGroupMemories(group)}
                        type="button"
                      >
                        Group Memories
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
                        {Object.values(group.members)
                          .filter(Boolean)
                          .filter((member) => !(locallyRemovedMembers[group.id] ?? []).includes(member.uid))
                          .map((member) => {
                          const isGroupOwner = member.uid === group.ownerId;
                          const memberLabel = member.displayName || member.email || "Member";
                          const canCurrentUserRemove = isOwner && !isGroupOwner && member.uid !== user?.uid;

                          return (
                            <div key={member.uid} className="group-member">
                              <UserAvatar
                                className="member-avatar"
                                email={member.email}
                                id={member.uid}
                                name={member.displayName}
                                photoURL={member.photoURL}
                              />
                              <div className="member-copy">
                                <div className="member-name-row">
                                  <span className="member-name">{memberLabel}</span>
                                  {isGroupOwner ? (
                                    <span className="owner-badge">
                                      <Crown size={12} />
                                      Owner
                                    </span>
                                  ) : null}
                                </div>
                                {member.email ? <span className="member-email">{member.email}</span> : null}
                              </div>
                              {isOwner && !isGroupOwner && member.uid !== user?.uid ? (
                                <button
                                  className="remove-member-button"
                                  onClick={() => handleRemoveMember(group, member.uid, memberLabel)}
                                  type="button"
                                  aria-label={`Remove ${memberLabel}`}
                                  title={
                                    canCurrentUserRemove
                                      ? `Remove ${memberLabel}`
                                      : "Only the owner can remove members"
                                  }
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
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
