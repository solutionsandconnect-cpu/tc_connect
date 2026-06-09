import { db } from '@/lib/firebase'
import {
  collection, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc,
  onSnapshot, query, where, Timestamp,
} from 'firebase/firestore'
import type { Trip, TripSection, TripItem, TripMember, TripType, TripPermission, TripMemberPermission, InviteLink, User } from '@/types'

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

/** Progression en quantités : somme des qtyReady (plafonnée à l'effectif) sur somme des qtyEffective */
export function tripQtyProgress(trip: Trip): { readyQty: number; totalQty: number } {
  const nbJours = nbJoursOf(trip)
  let readyQty = 0, totalQty = 0
  trip.sections.forEach(s => s.items.forEach(it => {
    const eff = qtyEffective(it, nbJours)
    totalQty += eff
    readyQty += Math.min(it.qtyReady, eff)
  }))
  return { readyQty, totalQty }
}

/** Construit un membre depuis un profil utilisateur (sans champ undefined) */
export function memberFromUser(u: Pick<User, 'uid' | 'nom' | 'prenom' | 'email' | 'photo_url'>, role: TripMember['role']): TripMember {
  const m: TripMember = {
    uid: u.uid, role,
    checkMode: 'all',
    nom: u.nom ?? '', prenom: u.prenom ?? '', email: u.email ?? '',
  }
  if (role !== 'owner') m.permission = 'contributor'
  if (u.photo_url) m.photoUrl = u.photo_url
  return m
}

/** Bascule le favori pour un utilisateur */
export const toggleFavorite = (trip: Trip, uid: string) => {
  const favs = trip.favoritedBy ?? []
  const isFav = favs.includes(uid)
  return updateTrip(trip.id, {
    favoritedBy: isFav ? favs.filter(id => id !== uid) : [...favs, uid],
  })
}

/** Archive ou désarchive une liste */
export const archiveTrip = (tripId: string, archived: boolean) =>
  updateTrip(tripId, { archived })

/** Peut-il faire cette action ? (logique de permissions centralisée) */
export function memberCan(
  member: TripMember | null | undefined,
  isOwner: boolean,
  action: 'addSections' | 'addItems' | 'share' | 'manageMembers' | 'editSections'
): boolean {
  if (isOwner) return true
  const perm = member?.permission ?? 'contributor'
  if (perm === 'admin') return true
  switch (action) {
    case 'addSections':
    case 'editSections':  return perm === 'editor'
    case 'addItems':      return perm === 'editor' || perm === 'contributor'
    case 'share':         return perm === 'editor'
    case 'manageMembers': return false
  }
}

/** Peut-il cocher cet item ? */
export function memberCanToggle(
  member: TripMember | null | undefined,
  isOwner: boolean,
  itemAssigneeId: string | null | undefined,
  currentUid: string
): boolean {
  if (isOwner) return true
  const perm = member?.permission ?? 'contributor'
  if (perm === 'viewer') return false
  if (member?.checkMode === 'assigned') return itemAssigneeId === currentUid
  return true
}

/** Met à jour les permissions d'un membre */
export const updateMemberPermission = (
  trip: Trip,
  uid: string,
  permission: TripMemberPermission,
  checkMode?: 'all' | 'assigned'
) => updateTrip(trip.id, {
  members: trip.members.map(m =>
    m.uid !== uid || m.role === 'owner' ? m : {
      ...m, permission,
      checkMode: checkMode ?? m.checkMode ?? 'all',
    }
  ),
})

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

/** Mappe un droit de lien (anonyme) vers un rôle de membre */
export function linkPermToMemberPerm(p: TripPermission): TripMemberPermission {
  return p === 'view' ? 'viewer' : p === 'edit' ? 'editor' : 'contributor'
}

/** Ajoute un participant invité par email mais SANS compte (affiché dans les
 *  membres, assignable dans « Qui s'en occupe »). Stocké dans members seulement
 *  (pas dans memberIds : l'accès se fait via le lien, pas via une requête). */
export const addGuestParticipant = (
  trip: Trip,
  guest: { id: string; nom?: string; prenom?: string; email?: string; permission: TripPermission }
) => {
  if (trip.members.some(m => m.uid === guest.id)) return Promise.resolve()
  const member: TripMember = {
    uid: guest.id,
    role: 'member',
    permission: linkPermToMemberPerm(guest.permission),
    checkMode: 'all',
    isGuest: true,
    nom: guest.nom ?? '',
    prenom: guest.prenom ?? '',
    email: guest.email ?? '',
  }
  return updateTrip(trip.id, { members: [...trip.members, member] })
}

/** Retire un membre (owner uniquement, jamais l'owner lui-même) */
export const removeMember = (trip: Trip, uid: string) => {
  if (uid === trip.ownerId) return Promise.resolve()
  return updateTrip(trip.id, {
    memberIds: trip.memberIds.filter(id => id !== uid),
    members: trip.members.filter(m => m.uid !== uid),
  })
}

// ─── Liens de partage (inviteLinks) ─────────────────────────────────────────────

const inviteLinksCol = collection(db, 'inviteLinks')

/** Génère un token court (20 caractères hex) */
function genToken(): string {
  const arr = new Uint8Array(10)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Crée un lien de partage pour une liste (owner uniquement) */
export const createInviteLink = async (
  tripId: string,
  permission: TripPermission,
  ownerUid: string,
  label?: string,
  inviteEmail?: string,
  nom?: string,
  prenom?: string,
): Promise<string> => {
  const token = genToken()
  await setDoc(doc(db, 'inviteLinks', token), {
    tripId,
    permission,
    label: label ?? '',
    inviteEmail: inviteEmail ?? '',
    nom: nom ?? '',
    prenom: prenom ?? '',
    createdAt: Timestamp.now(),
    createdBy: ownerUid,
  })
  return token
}

/** Modifie les droits d'un lien existant */
export const updateInviteLink = (token: string, permission: TripPermission) =>
  updateDoc(doc(db, 'inviteLinks', token), { permission })

/** Révoque (supprime) un lien de partage */
export const revokeInviteLink = (token: string) => deleteDoc(doc(db, 'inviteLinks', token))

/** Écoute les liens de partage d'une liste (owner uniquement) */
export const listenInviteLinks = (tripId: string, cb: (links: InviteLink[]) => void) =>
  onSnapshot(
    query(inviteLinksCol, where('tripId', '==', tripId)),
    (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as InviteLink)))
  )
