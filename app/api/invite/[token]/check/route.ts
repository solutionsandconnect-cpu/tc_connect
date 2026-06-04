import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = getAdminDb()

  const linkSnap = await db.collection('inviteLinks').doc(token).get()
  if (!linkSnap.exists) {
    return NextResponse.json({ error: 'Lien invalide.' }, { status: 403 })
  }
  const { tripId, permission } = linkSnap.data()!
  if (permission === 'view') {
    return NextResponse.json({ error: 'Accès en lecture seule.' }, { status: 403 })
  }

  const { sectionId, itemId, action, value } = await req.json() as {
    sectionId: string
    itemId: string
    action: 'toggle' | 'set'
    value?: number
  }

  const tripRef = db.collection('trips').doc(tripId)
  const tripSnap = await tripRef.get()
  if (!tripSnap.exists) {
    return NextResponse.json({ error: 'Liste introuvable.' }, { status: 404 })
  }

  const sections: any[] = tripSnap.data()!.sections ?? []
  const updated = sections.map((s: any) => {
    if (s.id !== sectionId) return s
    return {
      ...s,
      items: (s.items ?? []).map((it: any) => {
        if (it.id !== itemId) return it
        const eff = it.qtyNeeded
        if (action === 'toggle') {
          const done = it.qtyReady >= eff
          return { ...it, qtyReady: done ? 0 : eff }
        }
        if (action === 'set') {
          return { ...it, qtyReady: Math.max(0, Math.min(eff, value ?? 0)) }
        }
        return it
      }),
    }
  })

  await tripRef.update({ sections: updated, updatedAt: new Date() })
  return NextResponse.json({ ok: true })
}
