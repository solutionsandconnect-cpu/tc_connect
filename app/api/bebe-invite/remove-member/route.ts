import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { requireMember, uidFromIdToken } from '@/lib/bebeInvite'

/**
 * POST — retire un membre du bébé.
 * Le créateur peut retirer n'importe qui ; tout membre peut se retirer lui-même
 * (« quitter le partage »). Le créateur ne peut pas se retirer (il supprime le bébé).
 */
export async function POST(req: Request) {
  const { idToken, babyId, uid: targetUid } = await req.json() as
    { idToken?: string; babyId?: string; uid?: string }
  const uid = await uidFromIdToken(idToken)
  if (!uid) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
  if (!babyId || !targetUid) return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 })

  const access = await requireMember(uid, babyId)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })

  const createdBy = access.data.createdBy ?? ''
  const isCreator = uid === createdBy
  if (targetUid !== uid && !isCreator) {
    return NextResponse.json({ error: 'Seul le parent principal peut retirer un accès.' }, { status: 403 })
  }
  if (targetUid === createdBy) {
    return NextResponse.json(
      { error: "Le parent principal ne peut pas être retiré : supprimez le bébé à la place." },
      { status: 400 },
    )
  }

  await access.ref.update({ members: FieldValue.arrayRemove(targetUid) })
  return NextResponse.json({ ok: true })
}
