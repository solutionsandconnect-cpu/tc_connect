import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { buildPortalPayload } from '@/lib/espacePortal'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 })

  const db = getAdminDb()
  const snap = await db.collection('pilotage_contrats').where('portalToken', '==', token).limit(1).get()
  if (snap.empty) {
    return NextResponse.json({ error: 'Ce lien est invalide ou a été révoqué.' }, { status: 404 })
  }

  const payload = await buildPortalPayload(db, snap.docs[0])
  return NextResponse.json(payload)
}
