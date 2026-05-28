"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, MapPin, Trash2, Edit3, ImageIcon } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { formatMemoryDate } from "@/lib/formatDate";
import { subscribeToMemories, deleteMemory } from "@/lib/memories";
import { subscribeToGroupMemories, deleteGroupMemory } from "@/lib/groups";
import type { Memory } from "@/types/memory";

export function EditMemoriesPage() {
  const { user, viewMode, currentGroup, setCurrentPage, setMemoryToEdit } = useApp();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isGroupView = viewMode.startsWith("group-");
  const groupId = isGroupView ? viewMode.replace("group-", "") : null;

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    if (isGroupView && groupId) {
      return subscribeToGroupMemories(
        groupId,
        (fetchedMemories) => {
          setMemories(fetchedMemories);
          setIsLoading(false);
        },
        (err) => {
          setError(err.message);
          setIsLoading(false);
        }
      );
    } else {
      return subscribeToMemories(
        user.uid,
        (fetchedMemories) => {
          setMemories(fetchedMemories);
          setIsLoading(false);
        },
        (err) => {
          setError(err.message);
          setIsLoading(false);
        }
      );
    }
  }, [user, isGroupView, groupId]);

  const handleDelete = async (memory: Memory) => {
    if (!user) return;
    const confirmed = window.confirm(`Delete "${memory.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(memory.id);
    setError(null);

    try {
      if (isGroupView && groupId) {
        await deleteGroupMemory(groupId, memory);
      } else {
        await deleteMemory(user.uid, memory);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete memory");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (memory: Memory) => {
    setMemoryToEdit(memory);
    setCurrentPage("main");
  };

  const pageTitle = isGroupView && currentGroup 
    ? `${currentGroup.name} Memories` 
    : "My Memories";

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
        <h1 className="page-title">{pageTitle}</h1>
      </div>

      {error && <div className="page-error">{error}</div>}

      {isLoading ? (
        <div className="loading-state">Loading memories...</div>
      ) : memories.length === 0 ? (
        <div className="empty-state">
          <ImageIcon size={48} className="empty-state-icon" />
          <h3>No memories yet</h3>
          <p>Add your first memory to get started.</p>
        </div>
      ) : (
        <div className="memories-edit-list">
          {memories.map((memory) => (
            <div key={memory.id} className="memory-edit-card">
              <div className="memory-edit-image">
                {memory.photoUrls.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={memory.photoUrls[0]} alt="" />
                ) : (
                  <div className="memory-image-placeholder">
                    <ImageIcon size={24} />
                  </div>
                )}
              </div>
              <div className="memory-edit-info">
                <h3 className="memory-edit-title">{memory.title}</h3>
                <div className="memory-edit-meta">
                  <span>
                    <Calendar size={14} />
                    {formatMemoryDate(memory.date)}
                  </span>
                  <span>
                    <MapPin size={14} />
                    {memory.locationName}
                  </span>
                </div>
              </div>
              <div className="memory-edit-actions">
                <button
                  className="icon-button"
                  onClick={() => handleEdit(memory)}
                  type="button"
                  aria-label="Edit memory"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  className="icon-button danger"
                  onClick={() => handleDelete(memory)}
                  disabled={deletingId === memory.id}
                  type="button"
                  aria-label="Delete memory"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
