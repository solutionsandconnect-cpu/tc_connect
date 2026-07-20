import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'

// Liste des contrats rattachés au compte connecté (via Client.linkedUserId / User.linkedClientId).
export async function GET(req: Request) {
  const idToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!idToken) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const auth = getAdminAuth()
  const db = getAdminDb()

  let uid: string
  try {
    uid = (await auth.verifyIdToken(idToken)).uid
  } catch {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
  }

  const userSnap = await db.collection('users').doc(uid).get()
  const user = userSnap.exists ? userSnap.data()! : {}
  let clientId = user.linkedClientId as string | undefined

  // En prod, le lien compte↔client est le plus souvent posé UNIQUEMENT côté client
  // (`Client.linkedUserId`, ex. fiches importées) et jamais côté user — se fier au seul
  // `User.linkedClientId` renvoyait donc une liste vide, et l'espace client restait
  // inaccessible. On retombe sur le lien inverse, puis sur l'email (même règle de
  // rattachement qu'à l'inscription).
  if (!clientId) {
    const byUser = await db.collection('clients').where('linkedUserId', '==', uid).limit(1).get()
    if (!byUser.empty) clientId = byUser.docs[0].id
  }
  if (!clientId && user.email) {
    const byEmail = await db.collection('clients').where('email', '==', user.email).limit(1).get()
    if (!byEmail.empty) clientId = byEmail.docs[0].id
  }

  if (!clientId) return NextResponse.json({ contrats: [] })

  const snap = await db.collection('pilotage_contrats').where('clientId', '==', clientId).get()
  const contrats = snap.docs.map((d) => {
    const c = d.data()
    return {
      id: d.id,
      appNom: c.charte?.nomApp ?? c.charte?.nomProjet ?? c.appNom ?? null,
      clientNom: c.clientNom ?? '',
      statut: c.statut ?? 'actif',
    }
  })

  return NextResponse.json({ contrats })
}
