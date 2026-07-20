import { randomBytes } from 'crypto'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'

/**
 * Partage d'un bébé entre co-parents (app Suivi Bébé).
 *
 * Modèle : `babies/{id}.members` est déjà un tableau d'UID, et les règles Firestore
 * accordent lecture/écriture sur le bébé + ses sous-collections à tout UID présent
 * dedans. Inviter quelqu'un = ajouter son UID dans `members`.
 *
 * L'ajout passe OBLIGATOIREMENT par l'Admin SDK (ces routes) : côté client, un
 * non-membre n'a par définition aucun droit sur le document, il ne peut donc pas
 * s'auto-ajouter. Aucune modification des règles n'est nécessaire.
 */

export const INVITES = 'bebe_invites'
/** Durée de validité d'un lien d'invitation. */
export const INVITE_TTL_DAYS = 7

export function genInviteToken(): string {
  return randomBytes(16).toString('hex')
}

/** Vérifie l'idToken Firebase et renvoie l'uid, ou null si la session est invalide. */
export async function uidFromIdToken(idToken?: string): Promise<string | null> {
  if (!idToken) return null
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    return decoded.uid
  } catch {
    return null
  }
}

/** Nom lisible d'un utilisateur (pour l'affichage sur la page d'invitation). */
export async function displayName(uid: string): Promise<string> {
  const snap = await getAdminDb().collection('users').doc(uid).get()
  const u = snap.exists ? snap.data()! : {}
  const full = [u.prenom, u.nom].filter(Boolean).join(' ').trim()
  return full || u.email || 'Un parent'
}

/**
 * Charge le bébé et vérifie que `uid` en est membre.
 * Renvoie `{ error, status }` prêt à être renvoyé en réponse si l'accès est refusé.
 */
export async function requireMember(uid: string, babyId: string) {
  const ref = getAdminDb().collection('babies').doc(babyId)
  const snap = await ref.get()
  if (!snap.exists) return { error: 'Bébé introuvable.', status: 404 as const }
  const data = snap.data()!
  const members: string[] = data.members ?? []
  if (!members.includes(uid)) return { error: "Vous n'avez pas accès à ce bébé.", status: 403 as const }
  return { ref, data, members }
}
