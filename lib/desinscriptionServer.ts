import { getAdminDb } from '@/lib/firebaseAdmin'
import { normalizeEmail } from '@/lib/mailingModel'

// Lecture serveur de la désinscription publique — partagée entre le rendu SSR
// de la page (`app/desinscription/[token]/page.tsx`) et la route API (`route.ts`).
// Tout passe par l'Admin SDK : la page est publique, il n'y a jamais de session.

export type InfosDesinscription = { societe: string; emailMasque: string; dejaOppose: boolean }

/** Masque l'adresse : le jeton peut circuler, l'email n'a pas à être réaffiché en clair. */
export function masquerEmail(email: string): string {
  const [local, domaine] = normalizeEmail(email).split('@')
  if (!domaine) return '•••'
  const debut = local.slice(0, 2)
  return `${debut}${'•'.repeat(Math.max(1, local.length - 2))}@${domaine}`
}

/** Retrouve le prospect porteur de ce jeton d'opposition, ou null. */
export async function trouverProspectParToken(token: string) {
  const db = getAdminDb()
  const snap = await db.collection('prospects').where('optoutToken', '==', token).limit(1).get()
  return snap.empty ? null : snap.docs[0]
}

/** Infos publiques affichables pour ce jeton, ou null si le lien est invalide. */
export async function infosDesinscription(token: string): Promise<InfosDesinscription | null> {
  const doc = await trouverProspectParToken(token)
  if (!doc) return null
  const p = doc.data()
  return {
    societe: p.societe ?? '',
    emailMasque: masquerEmail(p.email ?? ''),
    dejaOppose: p.statut === 'oppose',
  }
}
