import { db } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, doc, getDoc, updateDoc,
  deleteDoc, deleteField, onSnapshot, query, where, Timestamp,
} from "firebase/firestore";
import type { Facture } from "@/types";

const col = collection(db, "factures");

function dateSuffix(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

export const listenFactures = (userId: string, cb: (factures: Facture[]) => void) => {
  const q = query(col, where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const data = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Facture))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    cb(data);
  });
};

export const getFacture = async (id: string): Promise<Facture> => {
  const snap = await getDoc(doc(db, "factures", id));
  return { id: snap.id, ...snap.data() } as Facture;
};

export const createFacture = async (
  data: Omit<Facture, "id" | "number" | "status" | "createdAt" | "updatedAt">
) => {
  const isDevis = data.type === "devis";
  const prefix = isDevis ? "DEV" : "FAC";
  const q = query(col, where("userId", "==", data.userId), where("type", "==", data.type));
  const snap = await getDocs(q);
  const number = `${prefix}_${String(snap.size + 1).padStart(3, "0")}_${dateSuffix()}`;

  // Strip undefined values before writing to Firestore
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );

  return addDoc(col, {
    ...clean,
    number,
    status: "draft" as const,
    createdAt: Timestamp.now(),
  });
};

export const convertDevisToFacture = async (id: string, userId: string): Promise<string[]> => {
  const devisSnap = await getDoc(doc(db, "factures", id));
  const { id: _id, ...devisData } = { id: devisSnap.id, ...devisSnap.data() } as Facture;

  const factureIds: string[] = [];
  const typeQ = query(col, where("userId", "==", userId), where("type", "==", "facture"));

  if (devisData.echeances && devisData.echeances.length > 0) {
    // Option A : on ne crée que la première facture — les suivantes seront émises au fil de l'eau
    const echeanceCount = devisData.echeances.length
    const echeance = devisData.echeances[0]
    const snap = await getDocs(typeQ);
    const number = `FAC_${String(snap.size + 1).padStart(3, "0")}_${dateSuffix()}`;
    const echeanceLabel = echeance.label || `Règlement 1/${echeanceCount}`
    const clean = Object.fromEntries(
      Object.entries({
        ...devisData,
        type: "facture" as const,
        number,
        status: "draft" as const,
        devisRef: id,
        devisNumber: devisData.number,
        items: devisData.items,
        total: echeance.montant,
        echeanceRef: {
          label: echeanceLabel,
          montant: echeance.montant,
          index: 0,
          count: echeanceCount,
          cumulPrecedent: 0,
        },
        date: Timestamp.now(),
        dateEcheance: echeance.date,
        echeances: undefined,
        signed: undefined,
        signedAt: undefined,
        convertedToFactureId: undefined,
        convertedToFactureIds: undefined,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }).filter(([, v]) => v !== undefined)
    );
    const ref = await addDoc(col, clean);
    factureIds.push(ref.id);
  } else {
    // No écheancier — single facture as before
    const snap = await getDocs(typeQ);
    const number = `FAC_${String(snap.size + 1).padStart(3, "0")}_${dateSuffix()}`;
    const clean = Object.fromEntries(
      Object.entries({
        ...devisData,
        type: "facture" as const,
        number,
        status: "draft" as const,
        devisRef: id,
        devisNumber: devisData.number,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        signed: undefined,
        signedAt: undefined,
        convertedToFactureId: undefined,
        convertedToFactureIds: undefined,
      }).filter(([, v]) => v !== undefined)
    );
    const ref = await addDoc(col, clean);
    factureIds.push(ref.id);
  }

  await updateDoc(doc(db, "factures", id), {
    status: "accepted" as const,
    convertedToFactureId: factureIds[0],
    convertedToFactureIds: factureIds,
    updatedAt: Timestamp.now(),
  });

  return factureIds;
};

export const updateFacture = async (id: string, data: Partial<Omit<Facture, "id">>) => {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  return updateDoc(doc(db, "factures", id), {
    ...clean,
    updatedAt: Timestamp.now(),
  });
};

// Émet la prochaine facture d'un devis à échéancier (option A — au fil de l'eau)
export const generateNextEcheanceFacture = async (devisId: string, userId: string): Promise<string | null> => {
  const devisSnap = await getDoc(doc(db, "factures", devisId));
  const devisData = { id: devisSnap.id, ...devisSnap.data() } as Facture;
  if (!devisData.echeances || devisData.echeances.length === 0) return null;

  const already = (devisData.convertedToFactureIds ?? (devisData.convertedToFactureId ? [devisData.convertedToFactureId] : [])).length;
  const nextIndex = already;
  if (nextIndex >= devisData.echeances.length) return null; // toutes déjà émises

  const echeance = devisData.echeances[nextIndex];
  const echeanceCount = devisData.echeances.length;
  // Somme des échéances précédentes (déjà réglées avant celle-ci)
  const cumulPrecedent = devisData.echeances.slice(0, nextIndex).reduce((acc, e) => acc + (e.montant ?? 0), 0);
  const typeQ = query(col, where("userId", "==", userId), where("type", "==", "facture"));
  const snap = await getDocs(typeQ);
  const number = `FAC_${String(snap.size + 1).padStart(3, "0")}_${dateSuffix()}`;
  const echeanceLabel = echeance.label || `Règlement ${nextIndex + 1}/${echeanceCount}`;
  const { id: _id, ...rest } = devisData;
  const clean = Object.fromEntries(
    Object.entries({
      ...rest,
      type: "facture" as const,
      number,
      status: "draft" as const,
      devisRef: devisId,
      devisNumber: devisData.number,
      items: devisData.items,
      total: echeance.montant,
      echeanceRef: { label: echeanceLabel, montant: echeance.montant, index: nextIndex, count: echeanceCount, cumulPrecedent },
      date: Timestamp.now(),
      dateEcheance: echeance.date,
      echeances: undefined,
      signed: undefined,
      signedAt: undefined,
      convertedToFactureId: undefined,
      convertedToFactureIds: undefined,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }).filter(([, v]) => v !== undefined)
  );
  const newRef = await addDoc(col, clean);
  const allIds = [...(devisData.convertedToFactureIds ?? (devisData.convertedToFactureId ? [devisData.convertedToFactureId] : [])), newRef.id];
  await updateDoc(doc(db, "factures", devisId), {
    convertedToFactureId: allIds[0],
    convertedToFactureIds: allIds,
    updatedAt: Timestamp.now(),
  });
  return newRef.id;
};

export const deleteFacture = async (id: string) => {
  // Si cette facture vient d'un devis, nettoyer les refs de conversion sur le devis
  try {
    const snap = await getDoc(doc(db, "factures", id));
    if (snap.exists()) {
      const data = snap.data() as any;
      if (data.devisRef) {
        const devisId: string = typeof data.devisRef === "string" ? data.devisRef : data.devisRef;
        const devisRef = doc(db, "factures", devisId);
        const devisSnap = await getDoc(devisRef);
        if (devisSnap.exists()) {
          const dd = devisSnap.data() as any;
          const existingIds: string[] = dd.convertedToFactureIds ?? (dd.convertedToFactureId ? [dd.convertedToFactureId] : []);
          const remaining = existingIds.filter((fid) => fid !== id);
          if (remaining.length === 0) {
            await updateDoc(devisRef, {
              convertedToFactureId: deleteField(),
              convertedToFactureIds: deleteField(),
              updatedAt: Timestamp.now(),
            });
          } else {
            await updateDoc(devisRef, {
              convertedToFactureId: remaining[0],
              convertedToFactureIds: remaining,
              updatedAt: Timestamp.now(),
            });
          }
        }
      }
    }
  } catch {}
  return deleteDoc(doc(db, "factures", id));
};
