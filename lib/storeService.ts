import { db } from "@/lib/firebase";
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, Timestamp,
} from "firebase/firestore";
import type { StoreApp, StoreSubscription } from "@/types";

const appsCol = collection(db, "store_apps");
const subsCol = collection(db, "store_subscriptions");

// ── Apps ──────────────────────────────────────────────────────────────────────

export const listenStoreApps = (cb: (apps: StoreApp[]) => void) => {
  const q = query(appsCol, orderBy("ordre", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreApp)));
  });
};

export const createStoreApp = (data: Omit<StoreApp, "id" | "createdAt">) =>
  addDoc(appsCol, { ...data, createdAt: Timestamp.now() });

export const updateStoreApp = (id: string, data: Partial<StoreApp>) =>
  updateDoc(doc(db, "store_apps", id), { ...data, updatedAt: Timestamp.now() });

export const deleteStoreApp = (id: string) =>
  deleteDoc(doc(db, "store_apps", id));

// ── Subscriptions ─────────────────────────────────────────────────────────────

export const listenStoreSubscriptions = (cb: (subs: StoreSubscription[]) => void) => {
  const q = query(subsCol, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreSubscription)));
  });
};

export const listenMyStoreSubscriptions = (
  userUid: string,
  cb: (subs: StoreSubscription[]) => void
) => {
  const q = query(subsCol, where("userUid", "==", userUid));
  return onSnapshot(q, (snap) => {
    const subs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as StoreSubscription))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    cb(subs);
  });
};

export const createStoreSubscription = (data: Omit<StoreSubscription, "id" | "createdAt">) =>
  addDoc(subsCol, { ...data, createdAt: Timestamp.now() });

export const updateStoreSubscription = (id: string, data: Partial<StoreSubscription>) =>
  updateDoc(doc(db, "store_subscriptions", id), { ...data, updatedAt: Timestamp.now() });

export const deleteStoreSubscription = (id: string) =>
  deleteDoc(doc(db, "store_subscriptions", id));
