import { db } from "@/lib/firebase";
import {
  collection, addDoc, doc, getDoc, updateDoc, deleteDoc,
  query, where, getDocs, onSnapshot, Timestamp,
} from "firebase/firestore";
import { cleanForFirestore } from "@/lib/firebaseUtils";
import type { Client } from "@/types";

const col = () => collection(db, "clients");

export const createClient = async (
  data: Omit<Client, "id" | "createdAt" | "updatedAt">
): Promise<{ id: string }> => {
  const ref = await addDoc(col(), {
    ...cleanForFirestore(data as Record<string, unknown>),
    createdAt: Timestamp.now(),
  });
  return { id: ref.id };
};

export const getClient = async (id: string): Promise<Client> => {
  const snap = await getDoc(doc(db, "clients", id));
  return { id: snap.id, ...snap.data() } as Client;
};

export const getClients = async (userId: string): Promise<Client[]> => {
  const q = query(col(), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Client))
    .sort((a, b) => (a.nom ?? "").localeCompare(b.nom ?? ""));
};

export const listenClients = (
  userId: string,
  cb: (clients: Client[]) => void
) => {
  const q = query(col(), where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Client));
    data.sort((a, b) => (a.nom ?? "").localeCompare(b.nom ?? ""));
    cb(data);
  });
};

export const updateClient = async (
  id: string,
  data: Partial<Omit<Client, "id" | "createdAt">>
): Promise<void> => {
  await updateDoc(doc(db, "clients", id), {
    ...cleanForFirestore(data as Record<string, unknown>),
    updatedAt: Timestamp.now(),
  });
};

export const deleteClient = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "clients", id));
};
