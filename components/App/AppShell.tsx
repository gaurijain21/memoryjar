"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Flame,
  Heart,
  Layers3,
  Map,
  Moon,
  Plus,
  Sparkles,
  Sun,
  User,
  Users,
  X,
} from "lucide-react";
import { CreateGroupModal } from "@/components/Groups/CreateGroupModal";
import { MemoryReactions } from "@/components/Memory/MemoryReactions";
import { UserAvatar } from "@/components/UserAvatar";
import { useApp } from "@/contexts/AppContext";
import { getMemoryExpandedHref } from "@/lib/expandedMemory";
import { formatMemoryDate } from "@/lib/formatDate";
import { getReadableLocationName } from "@/lib/locationText";
import { getReactionSummary } from "@/lib/reactions";
import type { AppPage, Group, Memory } from "@/types/memory";

export type MemoryJarTheme = "light" | "dark";

type AppShellProps = {
  children: ReactNode;
  canAddMemory: boolean;
  memoriesForStreak: Memory[];
  onAddMemory: () => void;
  showTopControls?: boolean;
};

type LeftSidebarProps = {
  activePage: AppPage;
  groups: Group[];
  onAddMemory: () => void;
  streakDays: number;
  theme: MemoryJarTheme;
  onThemeChange: (theme: MemoryJarTheme) => void;
};

type TopMapControlsProps = {
  canAddMemory: boolean;
  onAddMemory: () => void;
};

type RecentMemoriesDrawerProps = {
  isOpen: boolean;
  memories: Memory[];
  onOpenChange: (isOpen: boolean) => void;
  onSelectMemory: (memory: Memory) => void;
};

type MapLegendProps = {
  hidden?: boolean;
};

type SelectedMemoryPanelProps = {
  memory: Memory | null;
  onClose: () => void;
};

type MemoryToastStackProps = {
  message: string | null;
  onDismiss?: () => void;
};

function getMemoryKey(memory: Memory) {
  return `${memory.groupId ?? memory.ownerId ?? "memory"}:${memory.sourceMemoryId ?? memory.id}`;
}

function getLocation(memory: Memory) {
  return getReadableLocationName(memory.placeName || memory.locationName || memory.formattedAddress || "");
}

function getVibeLabel(memory: Memory) {
  return memory.vibes?.[0] || memory.feeling || "Memory";
}

function getPhoto(memory: Memory | null) {
  return memory?.photoUrls?.[0] ?? null;
}

function calculateStreak(memories: Memory[]) {
  const dates = new Set(
    memories
      .map((memory) => memory.date)
      .filter(Boolean)
      .map((date) => date.slice(0, 10)),
  );
  if (!dates.size) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cursor = today;
  let count = 0;

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dates.has(key)) break;
    count += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }

  return count;
}

export function AppShell({ children, canAddMemory, memoriesForStreak, onAddMemory, showTopControls = true }: AppShellProps) {
  const { currentPage, groups } = useApp();
  const [theme, setTheme] = useState<MemoryJarTheme>("light");
  const streakDays = useMemo(() => calculateStreak(memoriesForStreak), [memoriesForStreak]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("memoryjar-theme");
    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.memoryjarTheme = theme;
    window.localStorage.setItem("memoryjar-theme", theme);
    window.dispatchEvent(new CustomEvent("memoryjar:theme-changed", { detail: { theme } }));
  }, [theme]);

  return (
    <main className="memoryjar-layout" data-theme={theme}>
      <LeftSidebar
        activePage={currentPage}
        groups={groups}
        onAddMemory={onAddMemory}
        onThemeChange={setTheme}
        streakDays={streakDays}
        theme={theme}
      />
      <section className="memoryjar-main-shell">
        {showTopControls ? <TopMapControls canAddMemory={canAddMemory} onAddMemory={onAddMemory} /> : null}
        {children}
      </section>
    </main>
  );
}

export function LeftSidebar({
  activePage,
  groups,
  onAddMemory,
  onThemeChange,
  streakDays,
  theme,
}: LeftSidebarProps) {
  const { user, viewMode, pendingAction, setPendingAction, setCurrentPage, setViewMode, requestLogin } = useApp();
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  useEffect(() => {
    if (!user || pendingAction?.type !== "create-group") return;
    setIsCreateGroupOpen(true);
    setPendingAction(null);
  }, [pendingAction, setPendingAction, user]);

  const navItems: Array<{
    label: string;
    icon: typeof Map;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      label: "Map",
      icon: Map,
      active: activePage === "main",
      onClick: () => {
        setViewMode(user ? "all-memories" : "everyone");
        setCurrentPage("main");
      },
    },
    { label: "Timeline", icon: CalendarDays, active: activePage === "timeline", onClick: () => setCurrentPage("timeline") },
    { label: "Groups", icon: Users, active: activePage === "view-groups", onClick: () => (user ? setCurrentPage("view-groups") : requestLogin({ type: "view-groups" })) },
    {
      label: "My Memories",
      icon: Layers3,
      active: activePage === "main" && viewMode === "my-memories",
      onClick: () => {
        if (!user) {
          requestLogin({ type: "sign-in" });
          return;
        }
        setViewMode("my-memories");
        setCurrentPage("main");
      },
    },
    { label: "Edit Memories", icon: Edit3, active: activePage === "edit-memories", onClick: () => (user ? setCurrentPage("edit-memories") : requestLogin({ type: "edit-memories" })) },
  ];

  return (
    <aside className="memoryjar-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <Image alt="" height={42} src="/logomap.jpg" width={42} />
        </div>
        <div>
          <h1>Memory Jar</h1>
          <p>Every place has a story.</p>
        </div>
      </div>

      <div className="memoryjar-sidebar-scroll">
        <nav className="sidebar-nav" aria-label="Memory Jar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button className={`sidebar-nav-item ${item.active ? "active" : ""}`} key={item.label} onClick={item.onClick} type="button">
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="sidebar-section">
          <div className="section-heading">
            <span>Your Groups</span>
            <button
              aria-label="Create group"
              onClick={() => {
                if (!user) {
                  requestLogin({ type: "create-group" });
                  return;
                }
                setIsCreateGroupOpen(true);
              }}
              type="button"
            >
              <Plus size={15} />
            </button>
          </div>
          {groups.length ? (
            <div className="sidebar-groups">
              {groups.map((group, index) => {
                const members = Object.values(group.members ?? {});
                const isSelected = activePage === "main" && viewMode === `group-${group.id}`;
                const initial = group.name.trim().slice(0, 1).toUpperCase() || "G";
                return (
                  <button
                    className={`sidebar-group-card ${isSelected ? "active" : ""}`}
                    key={group.id}
                    onClick={() => {
                      setViewMode(`group-${group.id}`);
                      setCurrentPage("main");
                    }}
                    type="button"
                  >
                    <div className={`group-thumb group-thumb-${index + 1}`}>
                      {members[0]?.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" src={members[0].photoURL} />
                      ) : (
                        <span>{initial}</span>
                      )}
                    </div>
                    <div>
                      <strong>{group.name}</strong>
                      <small>{group.memberIds.length} members</small>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="sidebar-empty">No groups yet.</p>
          )}
        </section>

        <section className={`memory-streak-card ${streakDays === 0 ? "empty" : ""}`}>
          <Flame size={22} fill="currentColor" />
          <strong>Memory Streak</strong>
          {streakDays > 0 ? (
            <>
              <p><b>{streakDays}</b> days in a row</p>
              <small>Keep capturing!</small>
            </>
          ) : (
            <>
              <p>Start a streak</p>
              <small>A little streak starts with one saved place.</small>
            </>
          )}
          <div className="streak-dots" aria-hidden="true">
            {Array.from({ length: 7 }).map((_, index) => (
              <span className={index < Math.min(7, streakDays) ? "complete" : ""} key={index} />
            ))}
          </div>
        </section>

        <button className="sidebar-add-memory" onClick={onAddMemory} type="button">
          <Plus size={17} />
          <span>Add Memory</span>
          <Sparkles size={15} />
        </button>

        <div className="sidebar-profile">
          <UserAvatar className="sidebar-profile-avatar" email={user?.email} id={user?.uid} name={user?.displayName} photoURL={user?.photoURL} />
          <div>
            <strong>{user?.displayName || user?.email?.split("@")[0] || "Guest Explorer"}</strong>
            <small>{user?.email || "Sign in to save memories"}</small>
          </div>
          {user ? (
            <button
              aria-label="Open personal information"
              onClick={() => {
                setCurrentPage("personal-info");
              }}
              type="button"
            >
              <ArrowRight size={16} />
            </button>
          ) : (
            <button aria-label="Sign in" onClick={() => requestLogin(null)} type="button">
              <User size={16} />
            </button>
          )}
        </div>

        <button
          className="theme-toggle"
          onClick={() => onThemeChange(theme === "light" ? "dark" : "light")}
          type="button"
        >
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
        </button>
      </div>

      {isCreateGroupOpen ? <CreateGroupModal onClose={() => setIsCreateGroupOpen(false)} /> : null}
    </aside>
  );
}

export function TopMapControls({ canAddMemory, onAddMemory }: TopMapControlsProps) {
  const { user, viewMode, setViewMode, requestLogin } = useApp();
  const viewLabel = viewMode === "everyone" ? "Public Memories" : viewMode === "my-memories" ? "My Memories" : "All Memories";

  return (
    <header className="memoryjar-topbar">
      <button
        className="floating-select"
        onClick={() => setViewMode(viewMode === "all-memories" ? "my-memories" : "all-memories")}
        type="button"
      >
        {viewLabel}
        <ChevronDown size={17} />
      </button>
      <button
        className="premium-add-memory"
        disabled={!canAddMemory}
        onClick={() => {
          if (!user) {
            requestLogin({ type: "add-memory" });
            return;
          }
          onAddMemory();
        }}
        type="button"
      >
        <Plus size={20} />
        <span>Add Memory</span>
      </button>
    </header>
  );
}

export function MapLegend({ hidden = false }: MapLegendProps) {
  if (hidden) return null;

  return (
    <section className="map-legend open">
      <div className="map-legend-title">Legend</div>
      <div className="map-legend-list">
        <span><i className="legend-dot public" /> Public memories</span>
        <span><i className="legend-dot private" /> Private memories</span>
        <span><i className="legend-dot group" /> Group memories</span>
        <span><i className="legend-stack"><b /><b /><b /></i> Multiple nearby</span>
        <span><i className="legend-emoji">✨</i> Someone reacted</span>
      </div>
    </section>
  );
}

export function SelectedMemoryPanel({ memory, onClose }: SelectedMemoryPanelProps) {
  const { user, requestLogin, setCurrentPage, setViewMode } = useApp();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [floatingEmoji, setFloatingEmoji] = useState<{ id: number; emoji: string } | null>(null);

  useEffect(() => {
    setPhotoIndex(0);
  }, [memory?.id]);

  if (!memory) return null;

  const photos = memory.photoUrls.length ? memory.photoUrls : [""];
  const activePhoto = photos[Math.min(photoIndex, photos.length - 1)];
  const floatEmoji = (emoji: string) => {
    const id = Date.now();
    setFloatingEmoji({ id, emoji });
    window.setTimeout(() => {
      setFloatingEmoji((current) => current?.id === id ? null : current);
    }, 1500);
  };

  return (
    <section className="selected-memory-panel">
      <div className="panel-heading">
        <h2>{memory.title || "Untitled memory"}</h2>
        <button aria-label="Close memory details" onClick={onClose} type="button"><X size={16} /></button>
      </div>
      <div className="selected-memory-photo">
        {activePhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={activePhoto} />
        ) : (
          <Map size={34} />
        )}
        {floatingEmoji ? (
          <span className="floating-emoji detail-floating-emoji" key={floatingEmoji.id}>
            {floatingEmoji.emoji}
          </span>
        ) : null}
        {photos.length > 1 ? (
          <>
            <button
              aria-label="Previous photo"
              className="selected-gallery-arrow selected-gallery-arrow-left"
              onClick={() => setPhotoIndex((current) => (current === 0 ? photos.length - 1 : current - 1))}
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              aria-label="Next photo"
              className="selected-gallery-arrow selected-gallery-arrow-right"
              onClick={() => setPhotoIndex((current) => (current + 1) % photos.length)}
              type="button"
            >
              <ChevronRight size={18} />
            </button>
          </>
        ) : null}
        {photos.length > 1 ? (
          <div className="gallery-dots">
            {photos.map((photo, index) => (
              <button
                aria-label={`Show photo ${index + 1}`}
                className={index === photoIndex ? "active" : ""}
                key={`${photo}-${index}`}
                onClick={() => setPhotoIndex(index)}
                type="button"
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="selected-memory-copy">
        {getLocation(memory) ? <p>{getLocation(memory)}</p> : null}
        {memory.date ? <small>{formatMemoryDate(memory.date, "long")}</small> : null}
        <span className="vibe-badge">
          <Sparkles size={13} />
          {getVibeLabel(memory)}
        </span>
        {memory.description ? <div className="selected-description">{memory.description}</div> : null}
        {memory.groupId ? (
          <button
            className="group-context-link"
            onClick={() => {
              if (!memory.groupId) return;
              setViewMode(`group-${memory.groupId}`);
              setCurrentPage("main");
            }}
            type="button"
          >
            <Users size={15} />
            Part of: {memory.groupName ?? "Group memories"}
          </button>
        ) : null}
        <MemoryReactions
          memory={memory}
          uid={user?.uid ?? null}
          onReacted={floatEmoji}
          onRequireLogin={() => requestLogin(null)}
        />
        <Link className="expanded-view-button light" href={getMemoryExpandedHref(memory)} target="_blank" rel="noopener noreferrer">
          <Eye size={15} />
          Open full memory ✨
        </Link>
      </div>
    </section>
  );
}

export function RecentMemoriesDrawer({ isOpen, memories, onOpenChange, onSelectMemory }: RecentMemoriesDrawerProps) {
  const visible = memories.slice(0, 16);

  return (
    <>
      <button className="recent-memories-pill" onClick={() => onOpenChange(true)} type="button">
        <Layers3 size={17} />
        Recent Memories
      </button>
      {isOpen ? (
        <section className="recent-drawer">
          <div className="panel-heading">
            <h2>Recent Memories</h2>
            <button aria-label="Close recent memories" onClick={() => onOpenChange(false)} type="button"><X size={16} /></button>
          </div>
          <div className="recent-drawer-grid">
            {visible.length ? visible.map((memory) => (
              <button
                className="recent-memory-card"
                key={getMemoryKey(memory)}
                onClick={() => {
                  onSelectMemory(memory);
                  onOpenChange(false);
                }}
                type="button"
              >
                <div className="recent-image">
                  {getPhoto(memory) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={getPhoto(memory) ?? ""} />
                  ) : (
                    <Map size={28} />
                  )}
                </div>
                <div className="recent-copy">
                  <span className="vibe-badge compact">{getVibeLabel(memory)}</span>
                  <strong>{memory.title || "Untitled memory"}</strong>
                  <small>{getLocation(memory)}</small>
                  <span>{formatMemoryDate(memory.date)}</span>
                  <span className="recent-like">
                    {getReactionSummary(memory).topEmojis.length
                      ? getReactionSummary(memory).topEmojis.slice(0, 3).map(({ emoji, count }) => `${emoji} ${count}`).join(" ")
                      : <><Heart size={13} fill="currentColor" /> 0</>}
                  </span>
                </div>
              </button>
            )) : (
              <div className="empty-state compact-empty">
                <h3>No recent memories</h3>
                <p>Add a memory or join a group to see recent moments here.</p>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}

export function MemoryToastStack({ message, onDismiss }: MemoryToastStackProps) {
  if (!message) return null;

  return (
    <div className="memory-toast-stack">
      <aside className="memory-save-toast">
        <span className="toast-confetti">+</span>
        <div>
          <strong>New memory saved!</strong>
          <p>{message}</p>
        </div>
        {onDismiss ? (
          <button aria-label="Dismiss notification" onClick={onDismiss} type="button">
            <X size={15} />
          </button>
        ) : null}
      </aside>
    </div>
  );
}
