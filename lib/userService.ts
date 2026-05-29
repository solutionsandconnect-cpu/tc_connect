import { db } from "@/lib/firebase";
import {
  collection, addDoc, doc, updateDoc, Timestamp,
} from "firebase/firestore";
import type { User } from "@/types";

export const createUser = async (
  data: Pick<User, "nom" | "prenom" | "email" | "phone_number">
): Promise<{ id: string }> => {
  const ref = await addDoc(collection(db, "users"), {
    nom: data.nom,
    prenom: data.prenom,
    email: data.email,
    phone_number: data.phone_number || "",
    display_name: `${data.prenom} ${data.nom}`,
    uid: "",
    photo_url: "",
    actif: true,
    role_app: "Utilisateur",
    created_time: Timestamp.now(),
  });
  // Store the doc ID as uid so references are consistent
  await updateDoc(ref, { uid: ref.id });
  return { id: ref.id };
};

export const updateUser = async (
  id: string,
  data: Record<string, unknown>
): Promise<void> => {
  // Firestore rejects undefined values — strip them out
  const updates: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updates[k] = v
  }
  if (data.nom !== undefined || data.prenom !== undefined) {
    updates.display_name = `${data.prenom ?? ""} ${data.nom ?? ""}`.trim();
  }
  await updateDoc(doc(db, "users", id), updates);
};
