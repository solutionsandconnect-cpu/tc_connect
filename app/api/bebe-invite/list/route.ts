import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { INVITES, requireMember, uidFromIdToken } from '@/lib/bebeInvite'

/** POST — membres actuels + liens d'invitation en attente d'un bébé. */
export async function POST(req: Request) {
  const { idToken, babyId } = await req.json() as { idToken?: string; babyId?: string }
  const uid = await uidFromIdToken(idToken)
  if (!uid) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
  if (!babyId) return NextResponse.json({ error: 'Bébé manquant.' }, { status: 400 })

  const access = await requireMember(uid, babyId)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })

  const db = getAdminDb()
  const createdBy = access.data.createdBy ?? ''

  // Profils des membres (whitelist stricte : on n'expose que l'identité)
  const members = await Promise.all(access.members.map(async (memberUid) => {
    const snap = await db.collection('users').doc(memberUid).get()
    const u = snap.exists ? snap.data()! : {}
    return {
      uid: memberUid,
      nom: u.nom ?? '',
      prenom: u.prenom ?? '',
      email: u.email ?? '',
      isCreator: memberUid === createdBy,
    }
  }))

  // Liens encore valides (non utilisés, non expirés)
  const nowMs = Date.now()
  const invitesSnap = await db.collection(INVITES).where('babyId', '==', babyId).get()
  const invites = invitesSnap.docs
    .map(d => ({ token: d.id, ...d.data() } as Record<string, any>))
    .filter(i => !i.usedAt && (i.expiresAt?.toMillis?.() ?? 0) > nowMs)
    .map(i => ({
      token: i.token as string,
      createdByName: (i.createdByName ?? '') as string,
      expiresAt: i.expiresAt?.toMillis?.() ?? 0,
    }))

  return NextResponse.json({ members, invites, createdBy, isCreator: uid === createdBy })
}
