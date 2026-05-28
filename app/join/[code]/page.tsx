"use client";

import { useEffect, useRef, useState, use } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Users, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { getGroupByJoinCode, joinGroupByCode } from "@/lib/groups";
import { trackEvent, trackGroupJoined } from "@/lib/analytics";

interface JoinPageProps {
  params: Promise<{ code: string }>;
}

export default function JoinPage({ params }: JoinPageProps) {
  const { code } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRedirectToLogin, setCanRedirectToLogin] = useState(false);
  const joinAttemptedRef = useRef(false);

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
      window.setTimeout(() => setCanRedirectToLogin(true), 900);
    });
  }, [code]);

  // Keep the invite code through the Google redirect round-trip.
  useEffect(() => {
    if (code) {
      trackEvent("join_invite_view", { invite_code_present: true });
      sessionStorage.setItem("pendingInviteCode", code);
      sessionStorage.setItem("postLoginRedirect", `/join/${code}`);
      localStorage.setItem("pendingInviteCode", code);
      console.info("[MemoryJar invite] join code found", {
        code,
        savedToSessionStorage: true,
        savedToLocalStorage: true,
      });
    }
  }, [code]);

  // Once Firebase has finished initializing, send logged-out users to login.
  // Do not call Google sign-in from this page; the login button owns that action.
  useEffect(() => {
    if (!authReady || !canRedirectToLogin || user || error) return;
    console.info("[MemoryJar invite] no current user after auth load, redirecting to login", {
      code,
      redirectDestination: `/login?inviteCode=${code}`,
    });
    router.replace(`/login?inviteCode=${encodeURIComponent(code)}`);
  }, [authReady, canRedirectToLogin, code, error, router, user]);

  useEffect(() => {
    if (!authReady || !user || joinAttemptedRef.current) return;

    const currentUser = user;
    const inviteCode =
      sessionStorage.getItem("pendingInviteCode") ||
      localStorage.getItem("pendingInviteCode") ||
      sessionStorage.getItem("pendingJoinCode") ||
      code;
    if (!inviteCode) {
      console.error("[MemoryJar invite] pending invite code missing on join route");
      setError("This invite link is invalid or has expired.");
      return;
    }

    let cancelled = false;

    async function acceptInvite() {
      joinAttemptedRef.current = true;
      setIsJoining(true);
      setError(null);
      console.info("[MemoryJar invite] direct join started", {
        inviteCode,
        uid: currentUser.uid,
      });

      try {
        const group = await getGroupByJoinCode(inviteCode);
        console.info("[MemoryJar invite] group lookup finished", {
          inviteCode,
          groupFound: Boolean(group),
          groupId: group?.id ?? null,
        });
        if (!group) {
          if (!cancelled) {
            setError("This invite link is invalid or has expired.");
            setIsJoining(false);
          }
          return;
        }

        if (!cancelled) setGroupName(group.name);

        const result = await joinGroupByCode(
          currentUser.uid,
          {
            displayName: currentUser.displayName ?? currentUser.email ?? "User",
            email: currentUser.email,
            photoURL: currentUser.photoURL,
          },
          inviteCode
        );

        if (cancelled) return;

        if (result.success && result.groupId) {
          console.info("[MemoryJar invite] direct join success", {
            groupId: result.groupId,
            alreadyMember: Boolean(result.alreadyMember),
            redirectDestination: "/",
          });
          trackGroupJoined(result.groupId, result.alreadyMember);
          sessionStorage.setItem("joinedGroupId", result.groupId);
          sessionStorage.removeItem("pendingInviteCode");
          sessionStorage.removeItem("pendingJoinCode");
          sessionStorage.removeItem("postLoginRedirect");
          localStorage.removeItem("pendingInviteCode");
          router.replace("/");
          return;
        }

        console.error("[MemoryJar invite] direct join failed", result);
        setError(result.error ?? "Failed to join group");
        setIsJoining(false);
      } catch (err) {
        if (!cancelled) {
          console.error("[MemoryJar invite] direct join threw", err);
          setError(err instanceof Error ? err.message : "Failed to join group");
          setIsJoining(false);
        }
      }
    }

    acceptInvite();

    return () => {
      cancelled = true;
    };
  }, [authReady, code, router, user]);

  // Loading state
  if (!authReady || (groupName && user && isJoining)) {
    return (
      <main className="join-page">
        <div className="join-card">
          <div className="join-loading">
            <Loader2 size={32} className="spinning" />
            <span>{isJoining ? "Joining group..." : "Loading..."}</span>
          </div>
        </div>
      </main>
    );
  }

  // Error state
  if (error && !groupName) {
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
          <button className="primary-button" onClick={() => router.push("/")} type="button">
            Go to Memory Jar
          </button>
        </div>
      </main>
    );
  }

  // Not logged in - login redirect is in progress.
  if (!user) {
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
            <h2>You&apos;re invited!</h2>
            <p>Sign in with Google to accept this Memory Jar group invite.</p>
          </div>

          {error && <div className="join-error">{error}</div>}

          <div className="join-loading">
            <Loader2 size={24} className="spinning" />
            <span>Opening sign in...</span>
          </div>
        </div>
      </main>
    );
  }

  // Logged in but not yet joining (edge case - should auto-join)
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
          <h2>Join Group</h2>
          {groupName && <p>Join <strong>{groupName}</strong></p>}
        </div>

        {error && <div className="join-error">{error}</div>}

        <button
          className="primary-button"
          onClick={() => window.location.reload()}
          disabled={isJoining}
          type="button"
        >
          {isJoining ? "Joining..." : "Join Group"}
        </button>
      </div>
    </main>
  );
}
