import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import {
  decrementMemoryLocationAggregate,
  incrementMemoryLocationAggregate,
  moveMemoryLocationAggregate,
} from "@/lib/aggregates";
import type { Memory, MemoryInput } from "@/types/memory";

const memoriesCollection = (uid: string) => collection(db, "users", uid, "memories");
const memoryDoc = (uid: string, memoryId: string) =>
  doc(db, "users", uid, "memories", memoryId);
const publicMemoryDoc = (uid: string, memoryId: string) =>
  doc(db, "publicMemories", `${uid}_${memoryId}`);

export function subscribeToMemories(
  uid: string,
  onNext: (memories: Memory[]) => void,
  onError: (error: Error) => void,
) {
  if (!uid?.trim()) {
    onNext([]);
    return () => {};
  }

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

async function uploadPublicMemoryPhotos(uid: string, memoryId: string, photos: File[]) {
  const uploads = photos.map(async (photo) => {
    const cleanName = photo.name.replace(/[^\w.\-]+/g, "_");
    const path = `publicMemories/${uid}_${memoryId}/${Date.now()}-${cleanName}`;
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
  console.info("[DEBUG public memory] save start", {
    uid,
    audience: input.audience ?? "private",
    title: input.title,
  });
  const audience = input.audience ?? "private";
  const created = await addDoc(memoriesCollection(uid), {
    ...input,
    audience,
    groupId: null,
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

  await incrementMemoryLocationAggregate(input);

  if (audience === "public") {
    try {
      console.info("[DEBUG public memory] mirror create start", {
        path: `publicMemories/${uid}_${created.id}`,
      });
      const publicUploaded = await uploadPublicMemoryPhotos(uid, created.id, photos);
      await updateDoc(created, {
        publicPhotoUrls: publicUploaded.map((photo) => photo.url),
        publicStoragePaths: publicUploaded.map((photo) => photo.path),
        updatedAt: serverTimestamp(),
      });

      // Visibility logic: public personal memories get a public preview mirror;
      // private memories only affect the aggregate circle count below.
      // Public/private Firestore writes: public mirror failures should not block
      // the core personal-memory save if the main document already succeeded.
      await setDoc(publicMemoryDoc(uid, created.id), {
        ...input,
        audience: "public",
        groupId: null,
        id: `${uid}_${created.id}`,
        ownerId: uid,
        sourceMemoryId: created.id,
        photoUrls: publicUploaded.map((photo) => photo.url),
        storagePaths: [],
        publicStoragePaths: publicUploaded.map((photo) => photo.path),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.info("[DEBUG public memory] mirror create end", {
        path: `publicMemories/${uid}_${created.id}`,
      });
    } catch (publicMirrorError) {
      console.warn("[MemoryJar] Public mirror write failed after memory save", publicMirrorError);
    }
  }

  console.info("[DEBUG public memory] save end", {
    uid,
    memoryId: created.id,
    audience,
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
  console.info("[DEBUG public memory] edit start", {
    uid,
    memoryId: memory.id,
    previousAudience: memory.audience ?? "private",
    nextAudience: input.audience ?? memory.audience ?? "private",
  });
  const audience = input.audience ?? memory.audience ?? "private";
  const keptStoragePaths = (memory.storagePaths ?? []).filter((path, index) =>
    photoUrlsToKeep.includes(memory.photoUrls[index]),
  );
  const removedPaths = (memory.storagePaths ?? []).filter(
    (path) => !keptStoragePaths.includes(path),
  );
  const uploaded = await uploadMemoryPhotos(uid, memory.id, photosToAdd);
  const keptPublicPhotoUrls = memory.publicPhotoUrls?.length
    ? memory.publicPhotoUrls.filter((url, index) => photoUrlsToKeep.includes(memory.photoUrls[index]))
    : photoUrlsToKeep;
  const keptPublicStoragePaths = (memory.publicStoragePaths ?? []).filter((path, index) =>
    photoUrlsToKeep.includes(memory.photoUrls[index]),
  );
  const removedPublicPaths = (memory.publicStoragePaths ?? []).filter(
    (path) => !keptPublicStoragePaths.includes(path),
  );

  await Promise.allSettled(
    [...removedPaths, ...removedPublicPaths].map((path) => deleteObject(ref(storage, path))),
  );

  await updateDoc(memoryDoc(uid, memory.id), {
    ...input,
    audience,
    groupId: null,
    photoUrls: [...photoUrlsToKeep, ...uploaded.map((photo) => photo.url)],
    storagePaths: [...keptStoragePaths, ...uploaded.map((photo) => photo.path)],
    publicPhotoUrls: audience === "public"
      ? keptPublicPhotoUrls
      : [],
    publicStoragePaths: audience === "public"
      ? keptPublicStoragePaths
      : [],
    updatedAt: serverTimestamp(),
  });

  await moveMemoryLocationAggregate(memory, input);

  try {
    if (audience === "public") {
      console.info("[DEBUG public memory] mirror update start", {
        path: `publicMemories/${uid}_${memory.id}`,
        transition: `${memory.audience ?? "private"}->public`,
      });
      const publicUploaded = await uploadPublicMemoryPhotos(uid, memory.id, photosToAdd);
      const nextPublicPhotoUrls = [...keptPublicPhotoUrls, ...publicUploaded.map((photo) => photo.url)];
      const nextPublicStoragePaths = [...keptPublicStoragePaths, ...publicUploaded.map((photo) => photo.path)];

      await updateDoc(memoryDoc(uid, memory.id), {
        publicPhotoUrls: nextPublicPhotoUrls,
        publicStoragePaths: nextPublicStoragePaths,
        updatedAt: serverTimestamp(),
      });

      // Visibility logic: keep the public preview in sync with the private
      // source document without exposing storage paths or private-only records.
      // Public/private Firestore writes: newly added images are mirrored to
      // public Storage so logged-out Everyone's Memories can render thumbnails.
      await setDoc(publicMemoryDoc(uid, memory.id), {
        ...input,
        audience: "public",
        groupId: null,
        id: `${uid}_${memory.id}`,
        ownerId: uid,
        sourceMemoryId: memory.id,
        photoUrls: nextPublicPhotoUrls,
        storagePaths: [],
        publicStoragePaths: nextPublicStoragePaths,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      console.info("[DEBUG public memory] mirror update end", {
        path: `publicMemories/${uid}_${memory.id}`,
      });
    } else if (memory.audience === "public") {
      console.info("[DEBUG public memory] mirror delete start", {
        path: `publicMemories/${uid}_${memory.id}`,
        transition: "public->private",
      });
      await deleteDoc(publicMemoryDoc(uid, memory.id));
      console.info("[DEBUG public memory] mirror delete end", {
        path: `publicMemories/${uid}_${memory.id}`,
      });
    }
  } catch (publicMirrorError) {
    console.warn("[MemoryJar] Public mirror update failed after memory save", publicMirrorError);
  }

  console.info("[DEBUG public memory] edit end", {
    uid,
    memoryId: memory.id,
    audience,
  });
}

export async function deleteMemory(uid: string, memory: Memory) {
  await Promise.allSettled(
    [...(memory.storagePaths ?? []), ...(memory.publicStoragePaths ?? [])].map((path) => deleteObject(ref(storage, path))),
  );
  await deleteDoc(memoryDoc(uid, memory.id));
  if (memory.audience === "public") {
    await deleteDoc(publicMemoryDoc(uid, memory.id));
  }
  await decrementMemoryLocationAggregate(memory);
}
