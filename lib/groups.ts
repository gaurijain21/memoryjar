import {
  decrementMemoryLocationAggregate,
  incrementMemoryLocationAggregate,
  moveMemoryLocationAggregate,
} from "@/lib/aggregates";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  arrayUnion,
  arrayRemove,
  deleteField,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Group, GroupInput, GroupMember, Memory, MemoryInput } from "@/types/memory";

type JoinGroupResult = {
  success: boolean;
  groupId?: string;
  alreadyMember?: boolean;
  error?: string;
};

// Collection references
const groupsCollection = collection(db, "groups");
const groupDoc = (groupId: string) => doc(db, "groups", groupId);
const groupMemoriesCollection = (groupId: string) =>
  collection(db, "groups", groupId, "memories");
const groupMemoryDoc = (groupId: string, memoryId: string) =>
  doc(db, "groups", groupId, "memories", memoryId);

// Generate a random 6-character alphanumeric join code
function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars like 0, O, 1, I
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new group
export async function createGroup(
  uid: string,
  userInfo: { displayName: string; email?: string | null; photoURL: string | null },
  input: GroupInput
): Promise<{ id: string; joinCode: string }> {
  const joinCode = generateJoinCode();
  const memberData: GroupMember = {
    uid,
    displayName: userInfo.displayName,
    email: userInfo.email ?? null,
    photoURL: userInfo.photoURL,
    joinedAt: serverTimestamp(),
  };

  const groupData = {
    name: input.name,
    ownerId: uid,
    joinCode,
    memberIds: [uid],
    members: { [uid]: memberData },
    createdAt: serverTimestamp(),
  };

  const created = await addDoc(groupsCollection, groupData);
  return { id: created.id, joinCode };
}

// Subscribe to groups where user is a member
export function subscribeToUserGroups(
  uid: string,
  onNext: (groups: Group[]) => void,
  onError: (error: Error) => void
) {
  if (!uid?.trim()) {
    onNext([]);
    return () => {};
  }

  const q = query(
    groupsCollection,
    where("memberIds", "array-contains", uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const groups = snapshot.docs
        .map((document) => ({
          id: document.id,
          ...document.data(),
        })) as Group[];

      onNext(
        groups.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        })
      );
    },
    onError
  );
}

// Get a group by ID
export async function getGroup(groupId: string): Promise<Group | null> {
  const docSnap = await getDoc(groupDoc(groupId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Group;
}

// Get a group by join code
export async function getGroupByJoinCode(joinCode: string): Promise<Group | null> {
  const q = query(groupsCollection, where("joinCode", "==", joinCode.toUpperCase()));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as Group;
}

// Join a group by code
export async function joinGroupByCode(
  uid: string,
  userInfo: { displayName: string; email?: string | null; photoURL: string | null },
  joinCode: string
): Promise<JoinGroupResult> {
  console.info("[MemoryJar invite] joinGroupByCode lookup", { joinCode, uid });
  const group = await getGroupByJoinCode(joinCode);
  if (!group) {
    console.error("[MemoryJar invite] joinGroupByCode group not found", { joinCode });
    return { success: false, error: "Group not found" };
  }

  if (group.memberIds.includes(uid)) {
    console.info("[MemoryJar invite] joinGroupByCode already member", {
      groupId: group.id,
      uid,
    });
    return { success: true, groupId: group.id, alreadyMember: true };
  }

  const memberData: GroupMember = {
    uid,
    displayName: userInfo.displayName,
    email: userInfo.email ?? null,
    photoURL: userInfo.photoURL,
    joinedAt: serverTimestamp(),
  };

  try {
    await updateDoc(groupDoc(group.id), {
      memberIds: arrayUnion(uid),
      [`members.${uid}`]: memberData,
    });
  } catch (error) {
    console.error("[MemoryJar invite] joinGroupByCode Firestore update failed", error);
    throw error;
  }

  console.info("[MemoryJar invite] joinGroupByCode member added", {
    groupId: group.id,
    uid,
  });
  return { success: true, groupId: group.id, alreadyMember: false };
}

// Leave a group
export async function leaveGroup(uid: string, groupId: string): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) throw new Error("Group not found");
  
  if (group.ownerId === uid) {
    throw new Error("Owner cannot leave. Transfer ownership or delete the group.");
  }

  await updateDoc(groupDoc(groupId), {
    memberIds: arrayRemove(uid),
    [`members.${uid}`]: deleteField(),
  });
}

// Remove a member from a group. Only owners can remove non-owner members.
export async function removeMember(
  requestingUid: string,
  groupId: string,
  memberUid: string
): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) throw new Error("Group not found");
  
  if (group.ownerId !== requestingUid) {
    throw new Error("Only the owner can remove members.");
  }

  if (memberUid === requestingUid) {
    throw new Error("The owner cannot remove themselves here.");
  }
  
  if (memberUid === group.ownerId) {
    throw new Error("The owner cannot be removed");
  }

  await updateDoc(groupDoc(groupId), {
    memberIds: arrayRemove(memberUid),
    [`members.${memberUid}`]: deleteField(),
  });
}

// Delete a group (owner only)
export async function deleteGroup(uid: string, groupId: string): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) throw new Error("Group not found");
  
  if (group.ownerId !== uid) {
    throw new Error("Only the owner can delete the group");
  }

  // Delete all memories in the group first
  const memoriesSnapshot = await getDocs(groupMemoriesCollection(groupId));
  const batch = writeBatch(db);
  
  // Collect storage paths to delete
  const storagePaths: string[] = [];
  const aggregateRemovals: Promise<void>[] = [];
  memoriesSnapshot.docs.forEach((memDoc) => {
    const data = memDoc.data();
    if (data.storagePaths) {
      storagePaths.push(...data.storagePaths);
    }
    aggregateRemovals.push(decrementMemoryLocationAggregate({
      lat: data.lat,
      lng: data.lng,
      placeId: data.placeId ?? null,
      placeName: data.placeName ?? null,
      formattedAddress: data.formattedAddress ?? null,
      locationName: data.locationName ?? "Memory location",
      locationSource: data.locationSource ?? "pin",
      placePhotoReference: data.placePhotoReference ?? null,
      date: data.date ?? "",
      title: data.title ?? "",
      description: data.description ?? "",
      photoUrls: data.photoUrls ?? [],
      storagePaths: data.storagePaths ?? [],
      groupId,
    }));
    batch.delete(memDoc.ref);
  });

  // Delete the group document
  batch.delete(groupDoc(groupId));
  await batch.commit();
  await Promise.allSettled(aggregateRemovals);

  // Clean up storage
  await Promise.allSettled(
    storagePaths.map((path) => deleteObject(ref(storage, path)))
  );
}

// Subscribe to group memories
export function subscribeToGroupMemories(
  groupId: string,
  onNext: (memories: Memory[]) => void,
  onError: (error: Error) => void
) {
  if (!groupId?.trim()) {
    onNext([]);
    return () => {};
  }

  const q = query(groupMemoriesCollection(groupId), orderBy("date", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      onNext(
        snapshot.docs.map((document) => ({
          id: document.id,
          groupId,
          ...document.data(),
        })) as Memory[]
      );
    },
    onError
  );
}

// Upload photos for group memories
async function uploadGroupMemoryPhotos(
  groupId: string,
  memoryId: string,
  photos: File[]
) {
  const uploads = photos.map(async (photo) => {
    const cleanName = photo.name.replace(/[^\w.\-]+/g, "_");
    const path = `groups/${groupId}/memories/${memoryId}/${Date.now()}-${cleanName}`;
    const photoRef = ref(storage, path);
    await uploadBytes(photoRef, photo);

    return {
      url: await getDownloadURL(photoRef),
      path,
    };
  });

  return Promise.all(uploads);
}

// Create a memory in a group
export async function createGroupMemory(
  groupId: string,
  creatorUid: string,
  input: MemoryInput,
  photos: File[]
): Promise<string> {
  const created = await addDoc(groupMemoriesCollection(groupId), {
    ...input,
    groupId,
    creatorUid,
    photoUrls: [],
    storagePaths: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const uploaded = await uploadGroupMemoryPhotos(groupId, created.id, photos);
  await updateDoc(created, {
    photoUrls: uploaded.map((photo) => photo.url),
    storagePaths: uploaded.map((photo) => photo.path),
    updatedAt: serverTimestamp(),
  });
  await incrementMemoryLocationAggregate(input);

  return created.id;
}

// Update a group memory
export async function updateGroupMemory(
  groupId: string,
  memory: Memory,
  input: MemoryInput,
  photosToAdd: File[],
  photoUrlsToKeep: string[]
) {
  const keptStoragePaths = (memory.storagePaths ?? []).filter((path, index) =>
    photoUrlsToKeep.includes(memory.photoUrls[index])
  );
  const removedPaths = (memory.storagePaths ?? []).filter(
    (path) => !keptStoragePaths.includes(path)
  );
  const uploaded = await uploadGroupMemoryPhotos(groupId, memory.id, photosToAdd);

  await Promise.allSettled(
    removedPaths.map((path) => deleteObject(ref(storage, path)))
  );

  await updateDoc(groupMemoryDoc(groupId, memory.id), {
    ...input,
    photoUrls: [...photoUrlsToKeep, ...uploaded.map((photo) => photo.url)],
    storagePaths: [...keptStoragePaths, ...uploaded.map((photo) => photo.path)],
    updatedAt: serverTimestamp(),
  });
  await moveMemoryLocationAggregate(memory, input);
}

// Delete a group memory
export async function deleteGroupMemory(groupId: string, memory: Memory) {
  await Promise.allSettled(
    (memory.storagePaths ?? []).map((path) => deleteObject(ref(storage, path)))
  );
  await deleteDoc(groupMemoryDoc(groupId, memory.id));
  await decrementMemoryLocationAggregate(memory);
}
