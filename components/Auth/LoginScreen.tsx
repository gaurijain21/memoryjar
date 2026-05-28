"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, firebaseApp, firebaseConfig, googleProvider } from "@/lib/firebase";
import { useApp } from "@/contexts/AppContext";
import { joinGroupByCode } from "@/lib/groups";
import { clearInviteCode, getStoredInviteCode, saveInviteCode } from "@/lib/inviteStorage";
import { trackEvent, trackGroupJoined, trackLogin } from "@/lib/analytics";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="google-g-icon" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}

function validateFirebaseAuthConfig() {
  const expectedAuthDomain = `${firebaseConfig.projectId}.firebaseapp.com`;
  const isDemoConfig =
    firebaseConfig.projectId === "demo-memory-jar" ||
    firebaseConfig.authDomain === "demo-memory-jar.firebaseapp.com";
  const isAuthDomainCorrect = firebaseConfig.authDomain === expectedAuthDomain;

  if (!firebaseConfig.authDomain || isDemoConfig || !isAuthDomainCorrect) {
    console.error("[MemoryJar auth] Firebase authDomain looks wrong", {
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      expectedAuthDomain,
      firebaseAppName: firebaseApp.name,
    });
    return;
  }

  console.info("[MemoryJar auth] Firebase auth config", {
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    firebaseAppName: firebaseApp.name,
    currentHost: window.location.hostname,
    localhostAuthorizedDomainRequired: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1",
  });
}

type LoginScreenProps = {
  variant?: "page" | "modal";
  onClose?: () => void;
};

export function LoginScreen({ variant = "page", onClose }: LoginScreenProps) {
  const router = useRouter();
  const { user, isAuthLoading, setViewMode } = useApp();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isJoiningInvite, setIsJoiningInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const joinAttemptedRef = useRef(false);
  const popupInProgressRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlInviteCode = params.get("inviteCode");
    const storedInviteCode = getStoredInviteCode();
    const code = urlInviteCode || storedInviteCode;

    validateFirebaseAuthConfig();
    trackEvent("login_view", { has_invite: Boolean(code) });
    console.info("[MemoryJar invite] login page loaded", {
      currentUserExists: Boolean(auth.currentUser),
      authCurrentUserUid: auth.currentUser?.uid ?? null,
      firebaseAppName: firebaseApp.name,
      authDomain: firebaseConfig.authDomain,
      host: window.location.hostname,
      inviteCodeFromUrl: urlInviteCode,
      pendingInviteCodeFromStorage: storedInviteCode,
    });

    if (code) {
      setInviteCode(code);
      saveInviteCode(code);
    }
  }, []);

  useEffect(() => {
    console.info("[MemoryJar invite] onAuthStateChanged/context auth", {
      authLoading: isAuthLoading,
      currentUserExists: Boolean(user),
      uid: user?.uid ?? null,
      inviteCode,
    });
  }, [inviteCode, isAuthLoading, user]);

  useEffect(() => {
    if (isAuthLoading || user) return;

    setIsSigningIn(false);
    setIsJoiningInvite(false);
    setError(null);
    joinAttemptedRef.current = false;
    popupInProgressRef.current = false;

    if (!inviteCode) {
      clearInviteCode();
    }
  }, [inviteCode, isAuthLoading, user]);

  useEffect(() => {
    if (isAuthLoading || !user || !inviteCode || joinAttemptedRef.current) return;

    const currentUser = user;
    const currentInviteCode = inviteCode;
    let cancelled = false;

    async function joinPendingInvite() {
      joinAttemptedRef.current = true;
      setIsJoiningInvite(true);
      setError(null);
      console.info("[MemoryJar invite] joining group started", {
        inviteCode: currentInviteCode,
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
          currentInviteCode,
        );

        if (cancelled) return;

        if (!result.success || !result.groupId) {
          console.error("[MemoryJar invite] joining group failed", result);
          setError(result.error ?? "Could not join this group.");
          setIsJoiningInvite(false);
          return;
        }

        console.info("[MemoryJar invite] joining group success", {
          groupId: result.groupId,
          alreadyMember: Boolean(result.alreadyMember),
          redirectDestination: "/",
        });
        trackGroupJoined(result.groupId, result.alreadyMember);
        sessionStorage.setItem("joinedGroupId", result.groupId);
        setViewMode(`group-${result.groupId}`);
        clearInviteCode();
        console.info("[MemoryJar invite] redirecting to home");
        router.replace("/");
      } catch (joinError) {
        if (!cancelled) {
          console.error("[MemoryJar invite] joining group threw", joinError);
          setError(joinError instanceof Error ? joinError.message : "Could not join this group.");
          setIsJoiningInvite(false);
        }
      }
    }

    joinPendingInvite();

    return () => {
      cancelled = true;
    };
  }, [inviteCode, isAuthLoading, router, setViewMode, user]);

  useEffect(() => {
    if (isAuthLoading || !user || inviteCode || window.location.pathname !== "/login") return;
    console.info("[MemoryJar invite] current user exists without invite, redirecting home");
    router.replace("/");
  }, [inviteCode, isAuthLoading, router, user]);

  const handleGoogleSignIn = async () => {
    if (isSigningIn || isJoiningInvite || popupInProgressRef.current) return;

    if (inviteCode) {
      saveInviteCode(inviteCode);
    }

    popupInProgressRef.current = true;
    setIsSigningIn(true);
    setError(null);

    try {
      console.info("[MemoryJar invite] starting popup sign-in", {
        inviteCode,
        authCurrentUserBeforePopup: auth.currentUser?.uid ?? null,
      });
      const result = await signInWithPopup(auth, googleProvider);
      console.info("[MemoryJar invite] popup sign-in success", {
        resultUserUid: result.user.uid,
        authCurrentUserAfterPopup: auth.currentUser?.uid ?? null,
      });
      trackLogin("google_popup");

      if (!inviteCode && window.location.pathname === "/login") {
        router.replace("/");
      }
    } catch (signInError) {
      console.error("[MemoryJar invite] Google sign-in failed", signInError);
      const firebaseError = signInError as { code?: string; message?: string };

      console.error("[MemoryJar invite] Google sign-in error details", {
        code: firebaseError.code ?? null,
        message: firebaseError.message ?? null,
      });

      setError(
        firebaseError.code === "auth/popup-blocked"
          ? "Popup sign-in was blocked. Please allow popups or try another browser."
          : signInError instanceof Error
            ? `Google sign-in failed: ${signInError.message}`
            : "Google sign-in failed. Please try again.",
      );
    } finally {
      popupInProgressRef.current = false;
      setIsSigningIn(false);
    }
  };

  const content = (
    <section className={`login-card ${variant === "modal" ? "login-modal-card" : ""}`}>
      {variant === "modal" && onClose ? (
        <button
          aria-label="Close login"
          className="login-modal-close"
          onClick={onClose}
          type="button"
        >
          X
        </button>
      ) : null}
        <Image
          alt="Memory Jar"
          className="login-logo-image"
          height={96}
          priority
          src="/logomap.jpg"
          width={96}
        />
        <p className="eyebrow">Every pin tells a story</p>
        <h1>Memory Jar</h1>
        <p className="login-copy">
          {inviteCode
            ? "Sign in once to accept your group invite."
            : "Save photos, places, and moments that matter most."}
        </p>

        {error ? <div className="join-error login-error">{error}</div> : null}
        
        <button
          className="google-signin-button"
          disabled={isSigningIn || isJoiningInvite}
          onClick={handleGoogleSignIn}
          type="button"
        >
          <GoogleIcon />
          {isJoiningInvite ? "Joining group..." : isSigningIn ? "Opening Google..." : "Continue with Google"}
        </button>
      </section>
  );

  if (variant === "modal") {
    return (
      <div className="login-modal-layer" role="dialog" aria-modal="true">
        {content}
      </div>
    );
  }

  return (
    <main className="login-shell">
      {content}
    </main>
  );
}
