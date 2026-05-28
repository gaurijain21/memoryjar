"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithPopup, type User } from "firebase/auth";
import { MapPinned, Users, Loader2 } from "lucide-react";
import { auth, googleProvider } from "@/lib/firebase";
import { getGroupByJoinCode, joinGroupByCode } from "@/lib/groups";

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
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Check auth state
  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
  }, []);

  // Validate the group code
  useEffect(() => {
    async function validateCode() {
      try {
        const group = await getGroupByJoinCode(code);
        if (group) {
          setGroupName(group.name);
        } else {
          setError("This invite link is invalid or has expired.");
        }
      } catch {
        setError("Failed to validate invite link.");
      }
    }
    validateCode();
  }, [code]);

  // Auto-join if user is already logged in
  useEffect(() => {
    if (authReady && user && groupName && !isJoining && !error) {
      handleJoin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, groupName]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      // After sign in, the auth state change will trigger auto-join
    } catch (err) {
      setError("Failed to sign in. Please try again.");
      setIsSigningIn(false);
    }
  };

  const handleJoin = async () => {
    if (!user) return;

    setIsJoining(true);
    setError(null);

    try {
      const result = await joinGroupByCode(
        user.uid,
        { displayName: user.displayName ?? "User", photoURL: user.photoURL },
        code
      );

      if (result.success && result.groupId) {
        // Store the group to select after redirect
        sessionStorage.setItem("joinedGroupId", result.groupId);
        router.push("/");
      } else {
        setError(result.error ?? "Failed to join group");
        setIsJoining(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join group");
      setIsJoining(false);
    }
  };

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
              <MapPinned size={28} />
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

  // Not logged in - show sign in
  if (!user) {
    return (
      <main className="join-page">
        <div className="join-card">
          <div className="join-brand">
            <div className="join-brand-icon">
              <MapPinned size={28} />
            </div>
            <h1>Memory Jar</h1>
          </div>

          <div className="join-invite">
            <div className="join-invite-icon">
              <Users size={24} />
            </div>
            <h2>You&apos;re invited!</h2>
            {groupName && <p>Join <strong>{groupName}</strong> on Memory Jar</p>}
          </div>

          {error && <div className="join-error">{error}</div>}

          <button
            className="primary-button"
            onClick={handleSignIn}
            disabled={isSigningIn}
            type="button"
          >
            {isSigningIn ? "Signing in..." : "Sign in to Join"}
          </button>
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
            <MapPinned size={28} />
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
          onClick={handleJoin}
          disabled={isJoining}
          type="button"
        >
          {isJoining ? "Joining..." : "Join Group"}
        </button>
      </div>
    </main>
  );
}
