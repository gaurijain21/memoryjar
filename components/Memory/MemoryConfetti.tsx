"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useApp } from "@/contexts/AppContext";

export function MemoryConfetti() {
  const { user } = useApp();
  const [burstId, setBurstId] = useState(0);

  useEffect(() => {
    const handleConfetti = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string }>).detail;
      if (detail?.uid && detail.uid !== user?.uid) return;
      setBurstId((current) => current + 1);
    };
    window.addEventListener("memoryjar:confetti", handleConfetti);
    return () => window.removeEventListener("memoryjar:confetti", handleConfetti);
  }, [user?.uid]);

  if (!burstId) return null;

  return (
    <div className="memory-confetti" key={burstId} aria-hidden="true">
      {Array.from({ length: 80 }, (_, index) => (
        <span key={index} style={{ "--confetti-index": index } as CSSProperties} />
      ))}
    </div>
  );
}
