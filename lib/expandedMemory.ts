import type { Memory } from "@/types/memory";

export function getMemoryExpandedHref(memory: Memory) {
  const realMemoryId = memory.sourceMemoryId ?? memory.id;
  const params = new URLSearchParams();

  if (memory.groupId) {
    params.set("groupId", memory.groupId);
  } else if (memory.ownerId) {
    params.set("ownerId", memory.ownerId);
  }

  if (memory.audience === "public" && memory.ownerId) {
    params.set("public", "1");
  }

  const query = params.toString();
  return `/app/memory/${encodeURIComponent(realMemoryId)}${query ? `?${query}` : ""}`;
}

export function getMemoryVisibilityLabel(memory: Memory) {
  if (memory.groupId) return memory.groupName ? `${memory.groupName} group memory` : "Group memory";
  if (memory.audience === "public") return "Public memory";
  return "Private memory";
}
