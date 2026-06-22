import type { Memory } from "@/types/memory";

function timestampMillis(value: Memory["createdAt"] | Memory["updatedAt"]) {
  return value?.toMillis?.() ?? 0;
}

export function memorySortValue(memory: Memory) {
  const dateValue = Date.parse(memory.date || "");
  if (Number.isFinite(dateValue)) return dateValue;
  return timestampMillis(memory.createdAt) || timestampMillis(memory.updatedAt);
}

export function sortMemoriesNewestFirst(memories: Memory[]) {
  return [...memories].sort((a, b) => memorySortValue(b) - memorySortValue(a));
}
