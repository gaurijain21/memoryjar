"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Users, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { getGroupByJoinCode, joinGroupByCode } from "@/lib/groups";
import { clearInviteCode, saveInviteCode } from "@/lib/inviteStorage";
import { trackEvent, trackGroupJoined } from "@/lib/analytics";
import type { Group } from "@/types/memory";

interface JoinPageProps {
  params: Promise<{ code: string }>;
}

export default function JoinPage({ params }: JoinPageProps) {
  const { code } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check auth state
  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      console.info("[MemoryJar invite] join route auth state", {
        code,
        authLoading: false,
        currentUserExists: Boolean(currentUser),
        uid: currentUser?.uid ?? null,
      });
      setUser(currentUser);
      setAuthReady(true);
    });
  }, [code]);

  // Keep the invite code through the Google redirect round-trip.
  useEffect(() => {
    if (code) {
      trackEvent("join_invite_view", { invite_code_present: true });
      saveInviteCode(code);
      console.info("[MemoryJar invite] join code found", {
        code,
        savedToSessionStorage: true,
        savedToLocalStorage: true,
      });
    }
  }, [code]);

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      try {
        const fetchedGroup = await getGroupByJoinCode(code);
        if (cancelled) return;
        if (!fetchedGroup) {
          setError("This invite link is invalid or has expired.");
          return;
        }
        setGroup(fetchedGroup);
      } catch (inviteError) {
        if (!cancelled) {
          setError(inviteError instanceof Error ? inviteError.message : "Could not load this invite.");
        }
      }
    }

    void loadInvite();

    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleAcceptInvite = async () => {
    if (!user) {
      saveInviteCode(code);
      router.push(`/login?inviteCode=${encodeURIComponent(code)}`);
      return;
    }

    const currentUser = user;
      setIsJoining(true);
      setError(null);
      console.info("[MemoryJar invite] direct join started", {
      inviteCode: code,
        uid: currentUser.uid,
      });

      try {
        const result = await joinGroupByCode(
          currentUser.uid,
          {
            displayName: currentUser.displayName ?? currentUser.email ?? "User",
            email: currentUser.email,
            photoURL: currentUser.photoURL,
          },
        code,
        );

        if (result.success && result.groupId) {
          console.info("[MemoryJar invite] direct join success", {
            groupId: result.groupId,
            alreadyMember: Boolean(result.alreadyMember),
            redirectDestination: "/app",
          });
          trackGroupJoined(result.groupId, result.alreadyMember);
          sessionStorage.setItem("joinedGroupId", result.groupId);
          clearInviteCode();
          router.replace("/app");
          return;
        }

        console.error("[MemoryJar invite] direct join failed", result);
        setError(result.error ?? "Failed to join group");
        setIsJoining(false);
      } catch (err) {
          console.error("[MemoryJar invite] direct join threw", err);
          setError(err instanceof Error ? err.message : "Failed to join group");
          setIsJoining(false);
      }
  };

  // Loading state
  if (!authReady || (!group && !error)) {
    return (
      <main className="join-page">
        <div className="join-card">
          <div className="join-loading">
            <Loader2 size={32} className="spinning" />
            <span>Loading invite...</span>
          </div>
        </div>
      </main>
    );
  }

  // Error state
  if (error && !group) {
    return (
      <main className="join-page">
        <div className="join-card">
          <div className="join-brand">
            <div className="join-brand-icon">
              <Image alt="" height={36} src="/logomap.jpg" width={36} />
            </div>
            <h1>Memory Jar</h1>
          </div>
          <div className="join-error">{error}</div>
          <button className="primary-button" onClick={() => router.push("/app")} type="button">
            Go to Memory Jar
          </button>
        </div>
      </main>
    );
  }

  if (!group) return null;

  const admin = group.members?.[group.ownerId];
  const adminName = admin?.displayName || admin?.email?.split("@")[0] || "Gauri";

  return (
    <main className="join-page">
      <div className="join-card">
        <div className="join-brand">
          <div className="join-brand-icon">
            <Image alt="" height={36} src="/logomap.jpg" width={36} />
          </div>
          <h1>Memory Jar</h1>
        </div>

        <div className="join-invite">
          <div className="join-invite-icon">
            <Users size={24} />
          </div>
          <h2>{adminName} invited you to join {group.name}</h2>
          <p>Step into the shared memory map, add your favorite moments, and see the places your group is saving together.</p>
        </div>

        {error && <div className="join-error">{error}</div>}

        <button
          className="primary-button"
          onClick={() => void handleAcceptInvite()}
          disabled={isJoining}
          type="button"
        >
          {isJoining ? "Joining..." : "Accept invite"}
        </button>
        <button className="popup-test-button" onClick={() => router.push("/")} type="button">
          Not now
        </button>
      </div>
    </main>
  );
}
