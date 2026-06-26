import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { buildPortalPayload } from '@/lib/espacePortal'

// Portail complet d'un contrat — accès par COMPTE (vérifie que le contrat appartient
// bien à la fiche client rattachée au compte connecté).
export async function GET(req: Request, { params }: { params: Promise<{ contratId: string }> }) {
  const { contratId } = await params
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
  const clientId = userSnap.exists ? (userSnap.data()!.linkedClientId as string | undefined) : undefined
  if (!clientId) return NextResponse.json({ error: 'Aucun espace rattaché à ce compte.' }, { status: 403 })

  const cdoc = await db.collection('pilotage_contrats').doc(contratId).get()
  if (!cdoc.exists || cdoc.data()!.clientId !== clientId) {
    return NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 })
  }

  const payload = await buildPortalPayload(db, cdoc)
  return NextResponse.json(payload)
}
