import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { INVITES, requireMember, uidFromIdToken } from '@/lib/bebeInvite'

/** POST — révoque (supprime) un lien d'invitation. */
export async function POST(req: Request) {
  const { idToken, token } = await req.json() as { idToken?: string; token?: string }
  const uid = await uidFromIdToken(idToken)
  if (!uid) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
  if (!token) return NextResponse.json({ error: 'Lien manquant.' }, { status: 400 })

  const db = getAdminDb()
  const snap = await db.collection(INVITES).doc(token).get()
  if (!snap.exists) return NextResponse.json({ ok: true })

  // Seul un membre du bébé concerné peut révoquer le lien
  const access = await requireMember(uid, snap.data()!.babyId)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })

  await snap.ref.delete()
  return NextResponse.json({ ok: true })
}
