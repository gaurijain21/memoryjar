import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Memory, MemoryInput } from "@/types/memory";

const memoriesCollection = (uid: string) => collection(db, "users", uid, "memories");
const memoryDoc = (uid: string, memoryId: string) =>
  doc(db, "users", uid, "memories", memoryId);

export function subscribeToMemories(
  uid: string,
  onNext: (memories: Memory[]) => void,
  onError: (error: Error) => void,
) {
  const q = query(memoriesCollection(uid), orderBy("date", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      onNext(
        snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Memory[],
      );
    },
    onError,
  );
}

async function uploadMemoryPhotos(uid: string, memoryId: string, photos: File[]) {
  const uploads = photos.map(async (photo) => {
    const cleanName = photo.name.replace(/[^\w.\-]+/g, "_");
    const path = `users/${uid}/memories/${memoryId}/${Date.now()}-${cleanName}`;
    const photoRef = ref(storage, path);
    await uploadBytes(photoRef, photo);

    return {
      url: await getDownloadURL(photoRef),
      path,
    };
  });

  return Promise.all(uploads);
}

export async function createMemory(
  uid: string,
  input: MemoryInput,
  photos: File[],
) {
  const created = await addDoc(memoriesCollection(uid), {
    ...input,
    photoUrls: [],
    storagePaths: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const uploaded = await uploadMemoryPhotos(uid, created.id, photos);
  await updateDoc(created, {
    photoUrls: uploaded.map((photo) => photo.url),
    storagePaths: uploaded.map((photo) => photo.path),
    updatedAt: serverTimestamp(),
  });

  return created.id;
}

export async function updateMemory(
  uid: string,
  memory: Memory,
  input: MemoryInput,
  photosToAdd: File[],
  photoUrlsToKeep: string[],
) {
  const keptStoragePaths = (memory.storagePaths ?? []).filter((path, index) =>
    photoUrlsToKeep.includes(memory.photoUrls[index]),
  );
  const removedPaths = (memory.storagePaths ?? []).filter(
    (path) => !keptStoragePaths.includes(path),
  );
  const uploaded = await uploadMemoryPhotos(uid, memory.id, photosToAdd);

  await Promise.allSettled(
    removedPaths.map((path) => deleteObject(ref(storage, path))),
  );

  await updateDoc(memoryDoc(uid, memory.id), {
    ...input,
    photoUrls: [...photoUrlsToKeep, ...uploaded.map((photo) => photo.url)],
    storagePaths: [...keptStoragePaths, ...uploaded.map((photo) => photo.path)],
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMemory(uid: string, memory: Memory) {
  await Promise.allSettled(
    (memory.storagePaths ?? []).map((path) => deleteObject(ref(storage, path))),
  );
  await deleteDoc(memoryDoc(uid, memory.id));
}
