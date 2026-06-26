import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { signDevisForContrat } from '@/lib/espacePortal'

// Signature d'un devis via accès par COMPTE.
export async function POST(req: Request, { params }: { params: Promise<{ contratId: string }> }) {
  const { contratId } = await params
  const { idToken, devisId, signatureDataUrl } = (await req.json()) as {
    idToken?: string; devisId?: string; signatureDataUrl?: string
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

  const userSnap = await db.collection('users').doc(uid).get()
  const clientId = userSnap.exists ? (userSnap.data()!.linkedClientId as string | undefined) : undefined
  if (!clientId) return NextResponse.json({ error: 'Aucun espace rattaché à ce compte.' }, { status: 403 })

  const cdoc = await db.collection('pilotage_contrats').doc(contratId).get()
  if (!cdoc.exists || cdoc.data()!.clientId !== clientId) {
    return NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 })
  }

  const { status, body } = await signDevisForContrat(
    db, cdoc, devisId ?? '', signatureDataUrl ?? '', new URL(req.url).origin,
  )
  return NextResponse.json(body, { status })
}
