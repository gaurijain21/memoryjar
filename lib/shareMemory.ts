import { getMemoryExpandedHref } from "@/lib/expandedMemory";
import type { Memory } from "@/types/memory";

export function getMemoryShareUrl(memory: Memory) {
  if (typeof window === "undefined") return getMemoryExpandedHref(memory);
  return `${window.location.origin}${getMemoryExpandedHref(memory)}`;
}

export async function shareMemory(memory: Memory) {
  const url = getMemoryShareUrl(memory);
  const title = memory.title || "Memory Jar";

  if (navigator.share) {
    await navigator.share({
      title,
      text: "Take a peek at this Memory Jar moment.",
      url,
    });
    return "shared";
  }

  await navigator.clipboard.writeText(url);
  return "copied";
}
