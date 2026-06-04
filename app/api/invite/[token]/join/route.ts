import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'

// Lien (anonyme) → rôle de membre (compte TC Connect)
const PERM_MAP: Record<string, string> = {
  view: 'viewer',
  check: 'contributor',
  edit: 'editor',
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { idToken } = await req.json() as { idToken?: string }
  if (!idToken) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })

  const auth = getAdminAuth()
  const db = getAdminDb()

  // Vérifie l'identité de l'utilisateur connecté
  let uid: string
  try {
    const decoded = await auth.verifyIdToken(idToken)
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
  }

  const linkSnap = await db.collection('inviteLinks').doc(token).get()
  if (!linkSnap.exists) return NextResponse.json({ error: 'Lien invalide.' }, { status: 404 })
  const { tripId, permission } = linkSnap.data()!

  const tripRef = db.collection('trips').doc(tripId)
  const tripSnap = await tripRef.get()
  if (!tripSnap.exists) return NextResponse.json({ error: 'Liste introuvable.' }, { status: 404 })

  const trip = tripSnap.data()!
  const memberIds: string[] = trip.memberIds ?? []

  // Déjà membre → rien à faire, on renvoie juste l'id de la liste
  if (memberIds.includes(uid)) {
    return NextResponse.json({ ok: true, tripId, alreadyMember: true })
  }

  // Profil de l'utilisateur (pour dénormaliser nom/prénom/email/photo)
  const userSnap = await db.collection('users').doc(uid).get()
  const u = userSnap.exists ? userSnap.data()! : {}
  const myEmail = (u.email ?? '').toLowerCase()

  const member: Record<string, unknown> = {
    uid,
    role: 'member',
    permission: PERM_MAP[permission] ?? 'contributor',
    checkMode: 'all',
    nom: u.nom ?? '',
    prenom: u.prenom ?? '',
    email: u.email ?? '',
  }
  if (u.photo_url) member.photoUrl = u.photo_url

  // Remplace un éventuel participant « invité sans compte » de même email
  const existingMembers = (trip.members ?? []).filter(
    (m: any) => !(m.isGuest && (m.email ?? '').toLowerCase() === myEmail)
  )

  await tripRef.update({
    memberIds: [...memberIds, uid],
    members: [...existingMembers, member],
    updatedAt: new Date(),
  })

  return NextResponse.json({ ok: true, tripId, joined: true })
}
