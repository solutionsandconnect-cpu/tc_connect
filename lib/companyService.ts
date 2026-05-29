import { db } from "@/lib/firebase";
import {
  collection, addDoc, doc, getDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, Timestamp,
} from "firebase/firestore";
import { cleanForFirestore } from "@/lib/firebaseUtils";
import type { Company } from "@/types";

const col = () => collection(db, "companies");

export const createCompany = async (
  data: Omit<Company, "id" | "createdAt">
): Promise<{ id: string }> => {
  const ref = await addDoc(col(), {
    ...cleanForFirestore(data as Record<string, unknown>),
    createdAt: Timestamp.now(),
  });
  return { id: ref.id };
};

export const getCompany = async (id: string): Promise<Company> => {
  const snap = await getDoc(doc(db, "companies", id));
  return { id: snap.id, ...snap.data() } as Company;
};

export const listenCompanies = (
  userId: string,
  cb: (companies: Company[]) => void
) => {
  const q = query(col(), where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Company));
    data.sort((a, b) => (a.nom ?? "").localeCompare(b.nom ?? ""));
    cb(data);
  });
};

export const updateCompany = async (
  id: string,
  data: Partial<Omit<Company, "id" | "createdAt">>
): Promise<void> => {
  await updateDoc(doc(db, "companies", id), cleanForFirestore(data as Record<string, unknown>));
};

export const deleteCompany = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "companies", id));
};
