import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { INVITES, uidFromIdToken } from '@/lib/bebeInvite'

/**
 * POST — accepte l'invitation : ajoute l'utilisateur connecté aux `members` du bébé.
 * Passe par l'Admin SDK car un non-membre n'a aucun droit sur le document.
 * Lien à usage unique : consommé dès qu'il a servi.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { idToken } = await req.json() as { idToken?: string }
  const uid = await uidFromIdToken(idToken)
  if (!uid) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })

  const db = getAdminDb()
  const inviteRef = db.collection(INVITES).doc(token)
  const inviteSnap = await inviteRef.get()
  if (!inviteSnap.exists) return NextResponse.json({ error: 'Lien invalide.' }, { status: 404 })

  const inv = inviteSnap.data()!
  const babyRef = db.collection('babies').doc(inv.babyId)
  const babySnap = await babyRef.get()
  if (!babySnap.exists) return NextResponse.json({ error: 'Bébé introuvable.' }, { status: 404 })

  const members: string[] = babySnap.data()!.members ?? []

  // Déjà membre → succès, sans reconsommer le lien
  if (members.includes(uid)) {
    return NextResponse.json({ ok: true, alreadyMember: true, babyName: inv.babyName ?? '' })
  }

  if (inv.usedAt) return NextResponse.json({ error: 'Ce lien a déjà été utilisé.' }, { status: 410 })
  if ((inv.expiresAt?.toMillis?.() ?? 0) < Date.now()) {
    return NextResponse.json({ error: 'Ce lien a expiré. Demandez-en un nouveau.' }, { status: 410 })
  }

  await babyRef.update({ members: FieldValue.arrayUnion(uid) })
  await inviteRef.update({ usedAt: new Date(), usedBy: uid })

  return NextResponse.json({ ok: true, joined: true, babyName: inv.babyName ?? '' })
}
