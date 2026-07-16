import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { signDocForContrat } from '@/lib/espacePortal'

// Signature d'un document légal via accès par LIEN (token).
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 })

  const { docId, signatureDataUrl } = (await req.json()) as { docId?: string; signatureDataUrl?: string }

  const db = getAdminDb()
  const snap = await db.collection('pilotage_contrats').where('portalToken', '==', token).limit(1).get()
  if (snap.empty) {
    return NextResponse.json({ error: 'Ce lien est invalide ou a été révoqué.' }, { status: 404 })
  }

  const { status, body } = await signDocForContrat(
    db, snap.docs[0], docId ?? '', signatureDataUrl ?? '', new URL(req.url).origin,
  )
  return NextResponse.json(body, { status })
}
