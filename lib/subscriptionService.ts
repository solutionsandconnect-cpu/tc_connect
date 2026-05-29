import { db } from "@/lib/firebase";
import {
  collection, addDoc, doc, updateDoc, deleteDoc, Timestamp,
} from "firebase/firestore";
import type { DatabaseUsersDetails } from "@/types";

type SubData = Omit<DatabaseUsersDetails, "id" | "refUsers">;

export const createSubscription = async (
  userId: string,
  data: Partial<SubData>
): Promise<{ id: string }> => {
  const ref = await addDoc(collection(db, "database_users_details"), {
    ...data,
    refUsers: doc(db, "users", userId),
  });
  return { id: ref.id };
};

export const updateSubscription = async (
  id: string,
  data: Partial<SubData>
): Promise<void> => {
  await updateDoc(doc(db, "database_users_details", id), data as Record<string, unknown>);
};

export const deleteSubscription = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "database_users_details", id));
};
