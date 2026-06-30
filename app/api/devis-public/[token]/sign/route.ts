import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { signFactureDevis } from '@/lib/devisPublic'

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 })

  const { signatureDataUrl } = (await req.json()) as { signatureDataUrl?: string }

  const db = getAdminDb()
  const snap = await db.collection('factures').where('signToken', '==', token).limit(1).get()
  if (snap.empty) {
    return NextResponse.json({ error: 'Ce lien est invalide ou a été révoqué.' }, { status: 404 })
  }

  const { status, body } = await signFactureDevis(
    db, snap.docs[0], signatureDataUrl ?? '', new URL(req.url).origin,
  )
  return NextResponse.json(body, { status })
}
