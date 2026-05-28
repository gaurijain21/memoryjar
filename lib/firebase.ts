import { getApp, initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-api-key",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "demo-memory-jar.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-memory-jar",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "demo-memory-jar.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "000000000000",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:000000000000:web:memoryjar",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Local/dev checklist: Firebase Authentication must list localhost under
// Authentication > Settings > Authorized domains. The authDomain should stay as
// <project-id>.firebaseapp.com, never localhost.
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
// Firestore INTERNAL ASSERTION ca9 can be triggered by stale IndexedDB state
// after listener/schema changes. Keep this client on memory cache so listeners
// rebuild from server state instead of persisted local cache.
export const db = (() => {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: memoryLocalCache(),
    });
  } catch {
    return getFirestore(firebaseApp);
  }
})();
export const storage = getStorage(firebaseApp);
