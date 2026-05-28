"use client";

const inviteStorageKeys = ["pendingInviteCode", "pendingJoinCode"] as const;

export function getStoredInviteCode() {
  if (typeof window === "undefined") return null;

  for (const key of inviteStorageKeys) {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;
  }

  return localStorage.getItem("pendingInviteCode");
}

export function saveInviteCode(code: string) {
  if (typeof window === "undefined") return;

  sessionStorage.setItem("pendingInviteCode", code);
  sessionStorage.setItem("postLoginRedirect", `/join/${code}`);
  localStorage.setItem("pendingInviteCode", code);
}

export function clearInviteCode() {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem("pendingInviteCode");
  sessionStorage.removeItem("pendingJoinCode");
  sessionStorage.removeItem("postLoginRedirect");
  localStorage.removeItem("pendingInviteCode");
}
