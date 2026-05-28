"use client";

import { signInWithPopup } from "firebase/auth";
import { MapPin, Sparkles } from "lucide-react";
import { auth, googleProvider } from "@/lib/firebase";

export function LoginScreen() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">
          <MapPin size={30} />
        </div>
        <p className="eyebrow">Private memory mapping</p>
        <h1>Memory Jar</h1>
        <p className="login-copy">
          Pin the places that made you pause, keep the photos close, and wander
          through your own little world map by time.
        </p>
        <button
          className="primary-button"
          onClick={() => signInWithPopup(auth, googleProvider)}
          type="button"
        >
          <Sparkles size={18} />
          Continue with Google
        </button>
      </section>
    </main>
  );
}
