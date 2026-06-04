import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'

// Lien (anonyme) → rôle de membre (compte TC Connect)
const PERM_MAP: Record<string, string> = {
  view: 'viewer',
  check: 'contributor',
  edit: 'editor',
}

/**
 * Rattache au compte connecté toutes les listes pour lesquelles un lien
 * d'invitation a été créé avec SON adresse email (inviteEmail). Permet à une
 * personne invitée par email avant d'avoir un compte de retrouver ses listes
 * dès qu'elle crée/ouvre son compte avec la même adresse.
 */
export async function POST(req: Request) {
  const { idToken } = await req.json() as { idToken?: string }
  if (!idToken) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })

  const auth = getAdminAuth()
  const db = getAdminDb()

  let uid: string, email: string | undefined
  try {
    const decoded = await auth.verifyIdToken(idToken)
    uid = decoded.uid
    email = decoded.email?.toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
  }
  if (!email) return NextResponse.json({ ok: true, joined: 0 })

  // Profil utilisateur (pour dénormaliser nom/prénom/photo dans le membre)
  const userSnap = await db.collection('users').doc(uid).get()
  const u = userSnap.exists ? userSnap.data()! : {}

  // Tous les liens créés pour cet email
  const linksSnap = await db.collection('inviteLinks').where('inviteEmail', '==', email).get()
  if (linksSnap.empty) return NextResponse.json({ ok: true, joined: 0 })

  let joined = 0
  // Dédoublonne par tripId (plusieurs liens possibles pour la même liste)
  const byTrip = new Map<string, string>() // tripId → permission
  linksSnap.docs.forEach(d => {
    const { tripId, permission } = d.data()
    if (tripId && !byTrip.has(tripId)) byTrip.set(tripId, permission)
  })

  await Promise.allSettled([...byTrip.entries()].map(async ([tripId, permission]) => {
    const tripRef = db.collection('trips').doc(tripId)
    const tripSnap = await tripRef.get()
    if (!tripSnap.exists) return
    const trip = tripSnap.data()!
    const memberIds: string[] = trip.memberIds ?? []
    if (memberIds.includes(uid)) return // déjà membre

    const member: Record<string, unknown> = {
      uid, role: 'member',
      permission: PERM_MAP[permission] ?? 'contributor',
      checkMode: 'all',
      nom: u.nom ?? '', prenom: u.prenom ?? '', email: u.email ?? email,
    }
    if (u.photo_url) member.photoUrl = u.photo_url

    // Remplace le participant « invité sans compte » de même email
    const existingMembers = (trip.members ?? []).filter(
      (m: any) => !(m.isGuest && (m.email ?? '').toLowerCase() === email)
    )

    await tripRef.update({
      memberIds: [...memberIds, uid],
      members: [...existingMembers, member],
      updatedAt: new Date(),
    })
    joined++
  }))

  return NextResponse.json({ ok: true, joined })
}
