import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

const CRON_SECRET = process.env.CRON_SECRET

async function runReminders(req: Request) {
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminDb()
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const in5Days = new Date(now); in5Days.setDate(in5Days.getDate() + 5)

  const nowStr = now.toISOString().slice(0, 10)
  const in5Str = in5Days.toISOString().slice(0, 10)

  let notified = 0
  let checked = 0

  const tripsSnap = await db.collection('trips')
    .where('isTemplate', '==', false)
    .get()

  await Promise.allSettled(tripsSnap.docs.map(async (tripDoc) => {
    const trip = tripDoc.data()
    const sections: any[] = trip.sections ?? []
    const ownerId: string = trip.ownerId

    for (const section of sections) {
      for (const item of (section.items ?? [])) {
        checked++
        const due: string | null | undefined = item.dueDate
        if (!due) continue
        if (due < nowStr || due > in5Str) continue  // hors fenêtre 0–5 jours
        const qtyEff = item.qtyNeeded ?? 1
        if ((item.qtyReady ?? 0) >= qtyEff) continue  // déjà fait

        const diffDays = Math.round(
          (new Date(due + 'T00:00:00').getTime() - now.getTime()) / 86400000
        )
        const targetUid: string = item.assigneeId || ownerId
        const label = diffDays === 0 ? "Aujourd'hui !" : `Dans ${diffDays} jour${diffDays > 1 ? 's' : ''}`

        try {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/push/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: targetUid,
              title: `📅 CheckConnect — ${item.name}`,
              body: `${label} — ${trip.name}`,
              url: '/trips',
              persist: true,
              type: 'CHECKLIST_DUE',
            }),
          })
          notified++
        } catch { /* push échoue silencieusement */ }
      }
    }
  }))

  // ── Notifications "date de fin de liste" (J-3 et J-1) ─────────────────────────
  await Promise.allSettled(tripsSnap.docs.map(async (tripDoc) => {
    const trip = tripDoc.data()
    const dateTo = trip.dateTo?._seconds ?? trip.dateTo?.seconds ?? null
    if (!dateTo) return

    const dueDate = new Date(dateTo * 1000); dueDate.setHours(0, 0, 0, 0)
    const diffDays = Math.round((dueDate.getTime() - now.getTime()) / 86400000)
    if (diffDays !== 3 && diffDays !== 1) return

    // Vérifier que la liste n'est pas complète
    const sections: any[] = trip.sections ?? []
    const allItems = sections.flatMap((s: any) => s.items ?? [])
    const total = allItems.length
    if (total === 0) return
    const done = allItems.filter((it: any) => (it.qtyReady ?? 0) >= (it.qtyNeeded ?? 1)).length
    if (done >= total) return  // liste complète, pas de rappel

    const label = diffDays === 1 ? 'demain' : 'dans 3 jours'
    const memberIds: string[] = trip.memberIds ?? [trip.ownerId]

    await Promise.allSettled(memberIds.map(uid =>
      fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/push/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          title: `📋 ${trip.name} — Êtes-vous à jour ?`,
          body: `La liste se termine ${label}. ${done}/${total} tâches faites.`,
          url: '/trips',
          persist: true,
          type: 'CHECKLIST_DEADLINE',
        }),
      }).catch(() => {})
    ))
    notified += memberIds.length
  }))

  return NextResponse.json({ ok: true, checked, notified })
}

export async function GET(req: Request) { return runReminders(req) }
export async function POST(req: Request) { return runReminders(req) }
