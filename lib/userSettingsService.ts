import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

export interface UserPrestationSettings {
  customLabels: string[];
  priceMap: Record<string, number>;
}

export const getUserPrestationSettings = async (
  userId: string
): Promise<UserPrestationSettings> => {
  const snap = await getDoc(doc(db, "user_prestations", userId));
  if (!snap.exists()) return { customLabels: [], priceMap: {} };
  const data = snap.data();
  return {
    customLabels: Array.isArray(data.customLabels) ? data.customLabels : [],
    priceMap: data.priceMap && typeof data.priceMap === "object" ? data.priceMap : {},
  };
};

export const saveUserPrestationSettings = async (
  userId: string,
  settings: UserPrestationSettings
): Promise<void> => {
  await setDoc(
    doc(db, "user_prestations", userId),
    { ...settings, updatedAt: Timestamp.now() },
    { merge: true }
  );
};
