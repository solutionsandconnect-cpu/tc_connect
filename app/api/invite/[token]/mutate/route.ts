import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

const genId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)

type Op =
  | { op: 'addItem'; sectionId: string; name: string }
  | { op: 'addSection'; title: string }
  | { op: 'renameItem'; sectionId: string; itemId: string; name: string }
  | { op: 'renameSection'; sectionId: string; title: string }
  | { op: 'updateItem'; sectionId: string; itemId: string; patch: { dueDate?: string | null; note?: string; qtyNeeded?: number } }
  | { op: 'deleteItem'; sectionId: string; itemId: string }
  | { op: 'deleteSection'; sectionId: string }

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = getAdminDb()

  const linkSnap = await db.collection('inviteLinks').doc(token).get()
  if (!linkSnap.exists) {
    return NextResponse.json({ error: 'Lien invalide.' }, { status: 403 })
  }
  const { tripId, permission } = linkSnap.data()!
  if (permission !== 'edit') {
    return NextResponse.json({ error: 'Modification non autorisée.' }, { status: 403 })
  }

  const body = await req.json() as Op

  const tripRef = db.collection('trips').doc(tripId)
  const tripSnap = await tripRef.get()
  if (!tripSnap.exists) {
    return NextResponse.json({ error: 'Liste introuvable.' }, { status: 404 })
  }

  let sections: any[] = tripSnap.data()!.sections ?? []

  switch (body.op) {
    case 'addItem':
      sections = sections.map(s => s.id !== body.sectionId ? s : {
        ...s,
        items: [...(s.items ?? []), {
          id: genId(), name: (body.name || '').trim() || 'Nouvel élément',
          qtyNeeded: 1, qtyReady: 0, multiplier: 0, note: '', assigneeId: null,
          position: (s.items ?? []).length,
        }],
      })
      break
    case 'addSection':
      sections = [...sections, {
        id: genId(), title: (body.title || '').trim() || 'Nouvelle section',
        position: sections.length, items: [],
      }]
      break
    case 'renameItem':
      sections = sections.map(s => s.id !== body.sectionId ? s : {
        ...s,
        items: (s.items ?? []).map((it: any) => it.id === body.itemId ? { ...it, name: (body.name || '').trim() || it.name } : it),
      })
      break
    case 'renameSection':
      sections = sections.map(s => s.id === body.sectionId ? { ...s, title: (body.title || '').trim() || s.title } : s)
      break
    case 'updateItem': {
      const patch: any = {}
      if ('dueDate' in body.patch) patch.dueDate = body.patch.dueDate || null
      if ('note' in body.patch) patch.note = body.patch.note ?? ''
      if (typeof body.patch.qtyNeeded === 'number') patch.qtyNeeded = Math.max(1, Math.round(body.patch.qtyNeeded))
      sections = sections.map(s => s.id !== body.sectionId ? s : {
        ...s,
        items: (s.items ?? []).map((it: any) => it.id === body.itemId ? { ...it, ...patch } : it),
      })
      break
    }
    case 'deleteItem':
      sections = sections.map(s => s.id !== body.sectionId ? s : {
        ...s,
        items: (s.items ?? []).filter((it: any) => it.id !== body.itemId).map((it: any, i: number) => ({ ...it, position: i })),
      })
      break
    case 'deleteSection':
      sections = sections.filter(s => s.id !== body.sectionId).map((s, i) => ({ ...s, position: i }))
      break
    default:
      return NextResponse.json({ error: 'Opération inconnue.' }, { status: 400 })
  }

  await tripRef.update({ sections, updatedAt: new Date() })
  return NextResponse.json({ ok: true, sections })
}
