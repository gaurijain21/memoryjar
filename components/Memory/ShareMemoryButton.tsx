"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { shareMemory } from "@/lib/shareMemory";
import type { Memory } from "@/types/memory";

type ShareMemoryButtonProps = {
  memory: Memory;
};

export function ShareMemoryButton({ memory }: ShareMemoryButtonProps) {
  const [message, setMessage] = useState("");

  const handleShare = async () => {
    try {
      const result = await shareMemory(memory);
      setMessage(result === "copied" ? "Link copied!" : "Shared!");
      window.setTimeout(() => setMessage(""), 1800);
    } catch {
      setMessage("Could not share");
      window.setTimeout(() => setMessage(""), 1800);
    }
  };

  return (
    <div className="share-memory-wrap">
      <button className="icon-button share-memory-button" onClick={() => void handleShare()} type="button" aria-label="Share memory">
        <Share2 size={16} />
      </button>
      {message ? <span className="share-memory-toast">{message}</span> : null}
    </div>
  );
}
