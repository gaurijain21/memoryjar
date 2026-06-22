"use client";

import type { ReactNode } from "react";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ExpandedMemoryView } from "@/components/Memory/ExpandedMemoryView";
import { useApp } from "@/contexts/AppContext";
import { db } from "@/lib/firebase";
import { getMemoryVisibilityLabel } from "@/lib/expandedMemory";
import type { Memory } from "@/types/memory";

type ExpandedMemoryPageProps = {
  params: Promise<{ memoryId: string }>;
  searchParams: Promise<{
    groupId?: string;
    ownerId?: string;
    public?: string;
  }>;
};

type PageState =
  | { status: "loading" }
  | { status: "ready"; memory: Memory }
  | { status: "not-found" }
  | { status: "no-access" }
  | { status: "error"; message: string };

export default function ExpandedMemoryPage({
  params,
  searchParams,
}: ExpandedMemoryPageProps) {
  const { memoryId } = use(params);
  const query = use(searchParams);
  const router = useRouter();
  const { user, isAuthLoading } = useApp();
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const decodedMemoryId = decodeURIComponent(memoryId);
    const isPublicMemory = query.public === "1";

    async function loadMemory() {
      setState({ status: "loading" });

      try {
        if (query.groupId) {
          if (isAuthLoading) return;
          if (!user) {
            setState({ status: "no-access" });
            return;
          }

          const snapshot = await getDoc(doc(db, "groups", query.groupId, "memories", decodedMemoryId));
          if (cancelled) return;
          if (!snapshot.exists()) {
            setState({ status: "not-found" });
            return;
          }

          const groupSnapshot = await getDoc(doc(db, "groups", query.groupId));
          const groupData = groupSnapshot.data() as { name?: string } | undefined;

          setState({
            status: "ready",
            memory: {
              id: snapshot.id,
              groupId: query.groupId,
              groupName: groupData?.name ?? null,
              ...snapshot.data(),
            } as Memory,
          });
          return;
        }

        if (isPublicMemory && query.ownerId) {
          const publicId = `${query.ownerId}_${decodedMemoryId}`;
          const snapshot = await getDoc(doc(db, "publicMemories", publicId));
          if (cancelled) return;
          if (!snapshot.exists()) {
            setState({ status: "not-found" });
            return;
          }

          setState({
            status: "ready",
            memory: {
              id: decodedMemoryId,
              ownerId: query.ownerId,
              sourceMemoryId: decodedMemoryId,
              ...snapshot.data(),
            } as Memory,
          });
          return;
        }

        if (isAuthLoading) return;
        const ownerId = query.ownerId ?? user?.uid ?? null;

        if (!user || !ownerId || ownerId !== user.uid) {
          setState({ status: "no-access" });
          return;
        }

        const snapshot = await getDoc(doc(db, "users", ownerId, "memories", decodedMemoryId));
        if (cancelled) return;
        if (!snapshot.exists()) {
          setState({ status: "not-found" });
          return;
        }

        setState({
          status: "ready",
          memory: {
            id: snapshot.id,
            ownerId,
            ...snapshot.data(),
          } as Memory,
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Could not load this memory.";
        const isPermissionError = message.toLowerCase().includes("permission");
        setState(isPermissionError ? { status: "no-access" } : { status: "error", message });
      }
    }

    void loadMemory();

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, memoryId, query.groupId, query.ownerId, query.public, user]);

  return (
    <main className="expanded-page-shell">
      <button
        className="expanded-page-back"
        onClick={() => {
          if (window.history.length > 1) {
            router.back();
            return;
          }
          router.replace("/app");
        }}
        type="button"
      >
        <ArrowLeft size={18} />
        Memory Jar
      </button>

      {state.status === "loading" ? (
        <ExpandedPageMessage
          icon={<Loader2 className="spinning" size={30} />}
          title="Loading memory..."
          message="Opening the expanded view."
        />
      ) : null}

      {state.status === "not-found" ? (
        <ExpandedPageMessage
          title="Memory not found"
          message="This memory may have been moved or deleted."
        />
      ) : null}

      {state.status === "no-access" ? (
        <ExpandedPageMessage
          title="No access"
          message="Sign in with an account that can view this memory."
        />
      ) : null}

      {state.status === "error" ? (
        <ExpandedPageMessage
          title="Could not open memory"
          message={state.message}
        />
      ) : null}

      {state.status === "ready" ? (
        <ExpandedMemoryView
          className="expanded-memory-view-page"
          memory={state.memory}
          visibilityLabel={getMemoryVisibilityLabel(state.memory)}
        />
      ) : null}
    </main>
  );
}

function ExpandedPageMessage({
  icon,
  title,
  message,
}: {
  icon?: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <section className="expanded-page-message">
      {icon}
      <h1>{title}</h1>
      <p>{message}</p>
    </section>
  );
}
