import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { signDevisForContrat } from '@/lib/espacePortal'

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 })

  const { devisId, signatureDataUrl } = (await req.json()) as { devisId?: string; signatureDataUrl?: string }

  const db = getAdminDb()
  const snap = await db.collection('pilotage_contrats').where('portalToken', '==', token).limit(1).get()
  if (snap.empty) {
    return NextResponse.json({ error: 'Ce lien est invalide ou a été révoqué.' }, { status: 404 })
  }

  const { status, body } = await signDevisForContrat(
    db, snap.docs[0], devisId ?? '', signatureDataUrl ?? '', new URL(req.url).origin,
  )
  return NextResponse.json(body, { status })
}
