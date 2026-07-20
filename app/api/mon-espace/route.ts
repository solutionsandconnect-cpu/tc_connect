import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { resolveClientId } from '@/lib/monEspace'

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

  const clientId = await resolveClientId(uid)
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
