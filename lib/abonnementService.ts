import { db } from "@/lib/firebase";
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  query, where, onSnapshot, Timestamp,
} from "firebase/firestore";
import { cleanForFirestore } from "@/lib/firebaseUtils";
import type { Abonnement } from "@/types";

const col = () => collection(db, "abonnements");

export const createAbonnement = async (
  data: Omit<Abonnement, "id" | "createdAt" | "updatedAt">
): Promise<{ id: string }> => {
  const ref = await addDoc(col(), {
    ...cleanForFirestore(data as Record<string, unknown>),
    createdAt: Timestamp.now(),
  });
  return { id: ref.id };
};

export const listenAbonnements = (
  userId: string,
  cb: (abonnements: Abonnement[]) => void
) => {
  const q = query(col(), where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Abonnement));
    data.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    cb(data);
  });
};

export const listenAbonnementsForClient = (
  clientId: string,
  cb: (abonnements: Abonnement[]) => void
) => {
  const q = query(col(), where("clientId", "==", clientId));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Abonnement));
    data.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    cb(data);
  });
};

export const updateAbonnement = async (
  id: string,
  data: Partial<Omit<Abonnement, "id" | "createdAt">>
): Promise<void> => {
  await updateDoc(doc(db, "abonnements", id), {
    ...cleanForFirestore(data as Record<string, unknown>),
    updatedAt: Timestamp.now(),
  });
};

export const deleteAbonnement = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "abonnements", id));
};
