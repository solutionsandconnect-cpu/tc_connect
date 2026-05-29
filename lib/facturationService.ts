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
  const docDate = data.date ? (data.date as Timestamp).toDate() : new Date();
  const number = `${prefix}_${String(snap.size + 1).padStart(3, "0")}_${dateSuffix(docDate)}`;

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
    const echeanceCount = devisData.echeances.length

    // One facture per échéance — keeps the original devis items (real lines)
    // + stores an echeanceRef so the page knows which échéance this bill covers
    for (let i = 0; i < echeanceCount; i++) {
      const echeance = devisData.echeances[i]
      const snap = await getDocs(typeQ);
      const echeanceDate = echeance.date ? (echeance.date as Timestamp).toDate() : new Date();
      const number = `FAC_${String(snap.size + 1).padStart(3, "0")}_${dateSuffix(echeanceDate)}`;
      const echeanceLabel = echeance.label || `Règlement ${i + 1}/${echeanceCount}`
      const clean = Object.fromEntries(
        Object.entries({
          ...devisData,
          type: "facture" as const,
          number,
          status: "draft" as const,
          devisRef: id,
          devisNumber: devisData.number,
          // Keep all original devis lines — shown as "what was contracted"
          items: devisData.items,
          // total = this échéance's amount (NOT the sum of all items)
          total: echeance.montant,
          // Echéance metadata — used by the page to render "Facturation actuelle"
          echeanceRef: {
            label: echeanceLabel,
            montant: echeance.montant,
            index: i,
            count: echeanceCount,
          },
          date: echeance.date,
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
    }
  } else {
    // No écheancier — single facture as before
    const snap = await getDocs(typeQ);
    const docDate = devisData.date ? (devisData.date as Timestamp).toDate() : new Date();
    const number = `FAC_${String(snap.size + 1).padStart(3, "0")}_${dateSuffix(docDate)}`;
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
