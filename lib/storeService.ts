import { db } from "@/lib/firebase";
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, Timestamp, getDocs, arrayUnion,
} from "firebase/firestore";
import type { StoreApp, StoreSubscription, StoreReview, StoreSubEventType } from "@/types";

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

/** Référence de commande unique (à indiquer en référence du virement). Basée sur l'ID du document. */
export const orderRef = (id: string) => `CMD-${id}`;

/** Un abonnement actif est expiré si sa date de fin est dépassée. */
export const isSubExpired = (sub: Pick<StoreSubscription, "statut" | "dateFin">): boolean =>
  sub.statut === "active" && !!sub.dateFin && (sub.dateFin.toMillis?.() ?? 0) < Date.now();

/**
 * Bascule en "suspended" les abonnements actifs dont la date de fin est dépassée.
 * Réservé aux contextes admin (les règles Firestore n'autorisent que l'admin à écrire).
 */
export const suspendExpiredSubscriptions = async (subs: StoreSubscription[]): Promise<void> => {
  const expired = subs.filter(isSubExpired);
  if (expired.length === 0) return;
  await Promise.allSettled(
    expired.map((s) =>
      updateDoc(doc(db, "store_subscriptions", s.id), {
        statut: "suspended",
        events: arrayUnion({ type: "suspended", date: Timestamp.now(), note: "Échéance dépassée" }),
        updatedAt: Timestamp.now(),
      })
    )
  );
};

/** Calcule la date de fin d'accès selon la périodicité de l'app (null = pas de fin / illimité). */
export const computeDateFin = (fromMs: number, periodicite: string): number | null => {
  if (periodicite === "mensuel") return fromMs + 31 * 24 * 60 * 60 * 1000;
  if (periodicite === "annuel") {
    const d = new Date(fromMs);
    d.setFullYear(d.getFullYear() + 1);
    return d.getTime();
  }
  return null; // paiement unique → pas de date de fin
};

export const updateStoreSubscription = (id: string, data: Partial<StoreSubscription>) =>
  updateDoc(doc(db, "store_subscriptions", id), { ...data, updatedAt: Timestamp.now() });

export const deleteStoreSubscription = (id: string) =>
  deleteDoc(doc(db, "store_subscriptions", id));

/** Libellés lisibles des événements de l'historique d'un abonnement. */
export const SUB_EVENT_LABELS: Record<StoreSubEventType, string> = {
  created: "Demande de souscription",
  activated: "Accès validé",
  renewed: "Paiement validé / renouvelé",
  reminder: "Relance envoyée",
  suspended: "Suspendu (échéance dépassée)",
  cancelled: "Abonnement arrêté",
  unsubscribed: "Désabonnement (par l'utilisateur)",
  archived: "Archivé",
  cleaned: "Données purgées",
};

/** Ajoute un événement à l'historique d'un abonnement (et met à jour updatedAt). */
export const appendSubEvent = (id: string, type: StoreSubEventType, note?: string) =>
  updateDoc(doc(db, "store_subscriptions", id), {
    events: arrayUnion({ type, date: Timestamp.now(), ...(note ? { note } : {}) }),
    updatedAt: Timestamp.now(),
  });

/** Met à jour un abonnement ET ajoute un événement à son historique, de façon atomique. */
export const updateSubWithEvent = (
  id: string,
  data: Partial<StoreSubscription>,
  type: StoreSubEventType,
  note?: string,
) =>
  updateDoc(doc(db, "store_subscriptions", id), {
    ...data,
    events: arrayUnion({ type, date: Timestamp.now(), ...(note ? { note } : {}) }),
    updatedAt: Timestamp.now(),
  });

// ── Reviews ───────────────────────────────────────────────────────────────────

const reviewsCol = collection(db, "store_reviews");

export const listenAppReviews = (appId: string, cb: (reviews: StoreReview[]) => void) => {
  const q = query(reviewsCol, where("appId", "==", appId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreReview)));
  });
};

export const upsertReview = async (
  data: Omit<StoreReview, "id" | "createdAt" | "updatedAt">
): Promise<void> => {
  const q = query(reviewsCol, where("appId", "==", data.appId), where("userUid", "==", data.userUid));
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { ...data, updatedAt: Timestamp.now() });
  } else {
    await addDoc(reviewsCol, { ...data, createdAt: Timestamp.now() });
  }
};

export const deleteReview = (id: string) => deleteDoc(doc(db, "store_reviews", id));

// ── Notifications admin (collection Notifications, lue par la page Notifications) ──

/** Crée une notification in-app pour chaque administrateur */
export const notifyAdmins = async (type: string, message: string) => {
  try {
    const snap = await getDocs(query(collection(db, "users"), where("role_app", "==", "Admin")));
    await Promise.all(snap.docs.map((d) =>
      addDoc(collection(db, "Notifications"), {
        refUsers: doc(db, "users", d.id),
        type_notification: type,
        notification: message,
        etat_notification: "Non lu",
        date_create: Timestamp.now(),
      })
    ));
  } catch {
    // silencieux : la notification ne doit pas bloquer l'action principale
  }
};
