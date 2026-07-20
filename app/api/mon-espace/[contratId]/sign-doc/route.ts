import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { resolveClientId } from '@/lib/monEspace'
import { signDocForContrat } from '@/lib/espacePortal'

// Signature d'un document légal via accès par COMPTE.
export async function POST(req: Request, { params }: { params: Promise<{ contratId: string }> }) {
  const { contratId } = await params
  const { idToken, docId, signatureDataUrl } = (await req.json()) as {
    idToken?: string; docId?: string; signatureDataUrl?: string
  }
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
  if (!clientId) return NextResponse.json({ error: 'Aucun espace rattaché à ce compte.' }, { status: 403 })

  const cdoc = await db.collection('pilotage_contrats').doc(contratId).get()
  if (!cdoc.exists || cdoc.data()!.clientId !== clientId) {
    return NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 })
  }

  const { status, body } = await signDocForContrat(
    db, cdoc, docId ?? '', signatureDataUrl ?? '', new URL(req.url).origin,
  )
  return NextResponse.json(body, { status })
}
