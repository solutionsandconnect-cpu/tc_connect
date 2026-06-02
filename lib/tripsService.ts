import { db } from '@/lib/firebase'
import {
  collection, addDoc, doc, updateDoc, deleteDoc, getDoc,
  onSnapshot, query, where, Timestamp,
} from 'firebase/firestore'
import type { Trip, TripSection, TripItem, TripMember, TripType, User } from '@/types'

const tripsCol = collection(db, 'trips')

// ─── Helpers purs (logique métier) ──────────────────────────────────────────────

/** Identifiant local pour sections/items embarqués */
export const genId = (): string =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** Nombre de jours du voyage (inclusif). null si dates manquantes */
export function nbJoursOf(trip: Pick<Trip, 'dateFrom' | 'dateTo'>): number | null {
  const from = trip.dateFrom?.toMillis?.()
  const to = trip.dateTo?.toMillis?.()
  if (!from || !to) return null
  const days = Math.floor((to - from) / 86_400_000) + 1
  return Math.max(1, days)
}

/** Quantité réellement nécessaire : multiplier prioritaire si > 0 et dates connues */
export function qtyEffective(item: TripItem, nbJours: number | null): number {
  if (item.multiplier > 0 && nbJours) return Math.ceil(item.multiplier * nbJours)
  return item.qtyNeeded
}

/** Un item est validé quand qtyReady >= qtyEffective */
export function isItemDone(item: TripItem, nbJours: number | null): boolean {
  return item.qtyReady >= qtyEffective(item, nbJours)
}

/** Progression globale d'un voyage : { done, total, pct } */
export function tripProgress(trip: Trip): { done: number; total: number; pct: number } {
  const nbJours = nbJoursOf(trip)
  let done = 0, total = 0
  trip.sections.forEach(s => s.items.forEach(it => {
    total++
    if (isItemDone(it, nbJours)) done++
  }))
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/** Construit un membre depuis un profil utilisateur */
export function memberFromUser(u: Pick<User, 'uid' | 'nom' | 'prenom' | 'email'>, role: TripMember['role']): TripMember {
  return { uid: u.uid, role, nom: u.nom ?? '', prenom: u.prenom ?? '', email: u.email ?? '' }
}

/** Clone profond des sections en réinitialisant les qtyReady (pour modèle / reset / duplication) */
function cloneSectionsReset(sections: TripSection[]): TripSection[] {
  return (sections ?? []).map(s => ({
    id: genId(),
    title: s.title,
    position: s.position,
    items: (s.items ?? []).map(it => ({ ...it, id: genId(), qtyReady: 0 })),
  }))
}

// ─── Lecture temps réel ─────────────────────────────────────────────────────────

/** Écoute tous les voyages dont l'utilisateur est membre (owned + shared + ses modèles) */
export const listenTrips = (uid: string, cb: (trips: Trip[]) => void) => {
  const q = query(tripsCol, where('memberIds', 'array-contains', uid))
  return onSnapshot(q, (snap) => {
    const trips = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Trip))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
    cb(trips)
  })
}

/** Écoute un voyage précis */
export const listenTrip = (tripId: string, cb: (trip: Trip | null) => void) => {
  return onSnapshot(doc(db, 'trips', tripId), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Trip) : null)
  })
}

// ─── Création ─────────────────────────────────────────────────────────────────

interface CreateTripInput {
  name: string
  type: TripType
  icon: string
  color: string
  dateFrom?: Timestamp | null
  dateTo?: Timestamp | null
  isTemplate?: boolean
}

export const createTrip = (owner: User, input: CreateTripInput) =>
  addDoc(tripsCol, {
    name: input.name,
    type: input.type,
    icon: input.icon,
    color: input.color,
    dateFrom: input.dateFrom ?? null,
    dateTo: input.dateTo ?? null,
    isTemplate: input.isTemplate ?? false,
    ownerId: owner.uid,
    memberIds: [owner.uid],
    members: [memberFromUser(owner, 'owner')],
    sections: [],
    createdAt: Timestamp.now(),
  })

/** Crée un voyage en copiant les sections/items d'un modèle (qtyReady remis à 0) */
export const createTripFromTemplate = async (owner: User, templateId: string, input: CreateTripInput) => {
  const tplSnap = await getDoc(doc(db, 'trips', templateId))
  const tpl = tplSnap.exists() ? (tplSnap.data() as Trip) : null
  return addDoc(tripsCol, {
    name: input.name,
    type: input.type,
    icon: input.icon,
    color: input.color,
    dateFrom: input.dateFrom ?? null,
    dateTo: input.dateTo ?? null,
    isTemplate: false,
    ownerId: owner.uid,
    memberIds: [owner.uid],
    members: [memberFromUser(owner, 'owner')],
    sections: tpl ? cloneSectionsReset(tpl.sections) : [],
    createdAt: Timestamp.now(),
  })
}

// ─── Mutations voyage ───────────────────────────────────────────────────────────

export const updateTrip = (id: string, data: Partial<Trip>) =>
  updateDoc(doc(db, 'trips', id), { ...data, updatedAt: Timestamp.now() })

export const deleteTrip = (id: string) => deleteDoc(doc(db, 'trips', id))

/** Sauvegarde le voyage en tant que modèle réutilisable (nouveau doc, qtyReady = 0) */
export const saveAsTemplate = (owner: User, trip: Trip) =>
  addDoc(tripsCol, {
    name: `${trip.name} (modèle)`,
    type: trip.type,
    icon: trip.icon,
    color: trip.color,
    dateFrom: null,
    dateTo: null,
    isTemplate: true,
    ownerId: owner.uid,
    memberIds: [owner.uid],
    members: [memberFromUser(owner, 'owner')],
    sections: cloneSectionsReset(trip.sections),
    createdAt: Timestamp.now(),
  })

/** Remet tous les qtyReady à 0 (réutiliser la liste) */
export const resetTripReady = (trip: Trip) =>
  updateTrip(trip.id, {
    sections: trip.sections.map(s => ({ ...s, items: s.items.map(it => ({ ...it, qtyReady: 0 })) })),
  })

// ─── Partage ──────────────────────────────────────────────────────────────────

/** Ajoute un membre (owner uniquement). Pas de doublon. */
export const shareTrip = (trip: Trip, user: User) => {
  if (trip.memberIds.includes(user.uid)) return Promise.resolve()
  return updateTrip(trip.id, {
    memberIds: [...trip.memberIds, user.uid],
    members: [...trip.members, memberFromUser(user, 'member')],
  })
  // TODO: envoyer un email/notification d'invitation au membre ajouté
}

/** Retire un membre (owner uniquement, jamais l'owner lui-même) */
export const removeMember = (trip: Trip, uid: string) => {
  if (uid === trip.ownerId) return Promise.resolve()
  return updateTrip(trip.id, {
    memberIds: trip.memberIds.filter(id => id !== uid),
    members: trip.members.filter(m => m.uid !== uid),
  })
}
