import { db } from "@/lib/firebase";
import {
  collection, doc, getDoc, onSnapshot, query, setDoc, where, Timestamp, deleteField,
} from "firebase/firestore";
import type { UrssafPeriode } from "@/types";

const col = collection(db, "urssaf_periodes");

const periodeDocId = (userId: string, annee: number, mois: number) =>
  `${userId}_${annee}_${String(mois).padStart(2, "0")}`;

export const listenUrssafPeriodes = (
  userId: string,
  cb: (periodes: UrssafPeriode[]) => void
) => {
  const q = query(col, where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const data = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as UrssafPeriode))
      .sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois);
    cb(data);
  });
};

export const upsertUrssafPeriode = async (
  userId: string,
  annee: number,
  mois: number,
  data: Partial<Omit<UrssafPeriode, "id" | "userId" | "annee" | "mois" | "createdAt">> & {
    dateDeclaration?: Timestamp | null;
    dateReglement?: Timestamp | null;
  }
) => {
  const id = periodeDocId(userId, annee, mois);
  const ref = doc(db, "urssaf_periodes", id);
  const snap = await getDoc(ref);

  // Replace null values with deleteField() to remove Firestore fields
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    cleaned[key] = value === null ? deleteField() : value;
  }

  if (snap.exists()) {
    return setDoc(ref, { ...cleaned, updatedAt: Timestamp.now() }, { merge: true });
  } else {
    return setDoc(ref, {
      userId,
      annee,
      mois,
      taux: 24.2,
      declare: false,
      regle: false,
      ...cleaned,
      createdAt: Timestamp.now(),
    });
  }
};
