import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import { firebaseApp, firebaseConfig } from "@/lib/firebase";

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

let analyticsPromise: Promise<Analytics | null> | null = null;

function getAnalyticsClient() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!firebaseConfig.measurementId) return Promise.resolve(null);

  analyticsPromise ??= isSupported()
    .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
    .catch(() => null);

  return analyticsPromise;
}

function cleanParams(params?: AnalyticsParams) {
  if (!params) return undefined;

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null),
  ) as Record<string, string | number | boolean>;
}

export function trackEvent(eventName: string, params?: AnalyticsParams) {
  void getAnalyticsClient().then((analytics) => {
    if (!analytics) return;
    try {
      logEvent(analytics, eventName, cleanParams(params));
    } catch {
      // Analytics must never interrupt app behavior.
    }
  });
}

export function trackLogin(method: string) {
  trackEvent("login_success", { method });
}

export function trackGroupCreated(groupId: string) {
  trackEvent("group_created", { group_id: groupId });
}

export function trackGroupJoined(groupId: string, alreadyMember?: boolean) {
  trackEvent("group_joined", { group_id: groupId, already_member: Boolean(alreadyMember) });
}

export function trackMemoryCreated(sourceType: string) {
  trackEvent("memory_created", { source_type: sourceType });
}

export function trackMemoryEdited(sourceType: string) {
  trackEvent("memory_edited", { source_type: sourceType });
}

export function trackMemoryDeleted(sourceType: string) {
  trackEvent("memory_deleted", { source_type: sourceType });
}

export function trackPhotoUploaded(count: number, sourceType: string) {
  if (count <= 0) return;
  trackEvent("photo_uploaded", { count, source_type: sourceType });
}

export function trackButtonClick(
  buttonName: string,
  pageName: string,
  params?: AnalyticsParams,
) {
  trackEvent("button_clicked", {
    button_name: buttonName,
    page: pageName,
    ...params,
  });
}
