import { getAdminDb } from '@/lib/firebaseAdmin'

/**
 * Retrouve la fiche client rattachée à un compte (espace client Enezo).
 *
 * ⚠️ Ne PAS se fier au seul `User.linkedClientId` : en prod ce champ est vide sur la
 * quasi-totalité des comptes, le lien n'existant que côté fiche client
 * (`Client.linkedUserId`, posé à l'import ou depuis la page Clients). S'en tenir au
 * champ côté user rendait l'espace client inaccessible (liste vide / « Aucun espace
 * rattaché à ce compte »).
 *
 * Ordre de résolution : User.linkedClientId → Client.linkedUserId.
 *
 * ⚠️ PAS de repli sur l'email : Firebase ne vérifie pas les adresses à l'inscription,
 * donc un compte créé avec l'email d'un client lui donnerait accès à son espace (devis,
 * factures, documents, signature). Seuls les liens posés explicitement depuis la fiche
 * client font foi. Vérifié en prod (2026-07-20) : 109 fiches clients sur 111 portent
 * déjà `linkedUserId`, ce repli ne servait donc aucun cas réel.
 */
export async function resolveClientId(uid: string): Promise<string | null> {
  const db = getAdminDb()

  const userSnap = await db.collection('users').doc(uid).get()
  const user = userSnap.exists ? userSnap.data()! : {}
  if (user.linkedClientId) return user.linkedClientId as string

  const byUser = await db.collection('clients').where('linkedUserId', '==', uid).limit(1).get()
  if (!byUser.empty) return byUser.docs[0].id

  return null
}
