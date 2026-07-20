import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { INVITES, INVITE_TTL_DAYS, displayName, genInviteToken, requireMember, uidFromIdToken } from '@/lib/bebeInvite'

/** POST — génère un lien d'invitation pour un bébé (réservé à ses membres). */
export async function POST(req: Request) {
  const { idToken, babyId } = await req.json() as { idToken?: string; babyId?: string }
  const uid = await uidFromIdToken(idToken)
  if (!uid) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
  if (!babyId) return NextResponse.json({ error: 'Bébé manquant.' }, { status: 400 })

  const access = await requireMember(uid, babyId)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })

  const token = genInviteToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

  await getAdminDb().collection(INVITES).doc(token).set({
    babyId,
    babyName: access.data.name ?? '',
    createdBy: uid,
    createdByName: await displayName(uid),
    createdAt: now,
    expiresAt,
  })

  return NextResponse.json({ token, expiresAt: expiresAt.getTime() })
}
