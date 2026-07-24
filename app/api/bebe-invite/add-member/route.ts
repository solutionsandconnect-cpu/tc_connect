import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { requireMember, uidFromIdToken } from '@/lib/bebeInvite'

/**
 * POST — rattache DIRECTEMENT un compte existant à un bébé, sans lien d'invitation.
 *
 * ⚠️ RÉSERVÉ À L'ADMINISTRATEUR (`users/{uid}.role_app === 'Admin'`), vérifié ICI,
 * côté serveur : le contrôle affiché dans l'interface n'est qu'un confort, il ne
 * protège rien. Un parent ordinaire n'a que le lien d'invitation
 * (`/api/bebe-invite/create`), qui exige l'accord du destinataire.
 *
 * L'admin doit en plus être membre du bébé concerné : le geste existe pour gérer
 * SES bébés depuis l'écran de partage, pas pour ouvrir ceux des autres foyers.
 */
export async function POST(req: Request) {
  const { idToken, babyId, uid: targetUid } = await req.json() as
    { idToken?: string; babyId?: string; uid?: string }

  const uid = await uidFromIdToken(idToken)
  if (!uid) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
  if (!babyId || !targetUid) return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 })

  const db = getAdminDb()

  // 1. Le demandeur est-il administrateur ?
  const meSnap = await db.collection('users').doc(uid).get()
  if (!meSnap.exists || meSnap.data()?.role_app !== 'Admin') {
    return NextResponse.json({ error: 'Action réservée à l\'administrateur.' }, { status: 403 })
  }

  // 2. …et membre du bébé ?
  const access = await requireMember(uid, babyId)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })

  // 3. Le compte visé existe-t-il vraiment ? (un UID inventé créerait un membre fantôme)
  const targetSnap = await db.collection('users').doc(targetUid).get()
  if (!targetSnap.exists) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 })

  if (access.members.includes(targetUid)) {
    return NextResponse.json({ ok: true, dejaMembre: true })
  }

  await access.ref.update({ members: FieldValue.arrayUnion(targetUid) })
  return NextResponse.json({ ok: true })
}
