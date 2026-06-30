import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { buildDevisPayload } from '@/lib/devisPublic'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 })

  const db = getAdminDb()
  const snap = await db.collection('factures').where('signToken', '==', token).limit(1).get()
  if (snap.empty) {
    return NextResponse.json({ error: 'Ce lien est invalide ou a été révoqué.' }, { status: 404 })
  }

  const payload = await buildDevisPayload(db, snap.docs[0])
  return NextResponse.json(payload)
}
