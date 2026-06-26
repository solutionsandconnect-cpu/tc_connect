import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'

// Rattache le compte connecté (idToken) à la fiche client du contrat ciblé par le token.
// Le token (secret) prouve que la personne est bien le destinataire légitime.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { idToken } = (await req.json()) as { idToken?: string }
  if (!token) return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 })
  if (!idToken) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const auth = getAdminAuth()
  const db = getAdminDb()

  let uid: string
  try {
    uid = (await auth.verifyIdToken(idToken)).uid
  } catch {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
  }

  const snap = await db.collection('pilotage_contrats').where('portalToken', '==', token).limit(1).get()
  if (snap.empty) {
    return NextResponse.json({ error: 'Ce lien est invalide ou a été révoqué.' }, { status: 404 })
  }
  const clientId = snap.docs[0].data().clientId as string | undefined | null
  if (!clientId) {
    return NextResponse.json({ error: "Ce projet n'est pas relié à une fiche client." }, { status: 400 })
  }

  const clientRef = db.collection('clients').doc(clientId)
  const clientSnap = await clientRef.get()
  if (!clientSnap.exists) {
    return NextResponse.json({ error: 'Fiche client introuvable.' }, { status: 404 })
  }
  const existing = clientSnap.data()!.linkedUserId as string | undefined
  if (existing && existing !== uid) {
    return NextResponse.json({ error: 'Ce projet est déjà rattaché à un autre compte.' }, { status: 409 })
  }

  await Promise.all([
    clientRef.update({ linkedUserId: uid }),
    db.collection('users').doc(uid).set({ linkedClientId: clientId }, { merge: true }),
  ])

  return NextResponse.json({ ok: true, clientId })
}
