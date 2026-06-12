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

  const pushUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const sendPush = (payload: object) =>
    fetch(`${pushUrl}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})

  let notified = 0
  let checked = 0

  const tripsSnap = await db.collection('trips')
    .where('isTemplate', '==', false)
    .get()

  await Promise.allSettled(tripsSnap.docs.map(async (tripDoc) => {
    const trip = tripDoc.data()
    const sections: any[] = trip.sections ?? []
    const ownerId: string = trip.ownerId
    const memberIds: string[] = trip.memberIds ?? [ownerId]

    // ── 1. Rappels items assignés — J-2 et J-0 seulement ──────────────────────
    for (const section of sections) {
      for (const item of (section.items ?? [])) {
        checked++
        const due: string | null | undefined = item.dueDate
        if (!due) continue
        if ((item.qtyReady ?? 0) >= (item.qtyNeeded ?? 1)) continue  // déjà fait

        const diffDays = Math.round(
          (new Date(due + 'T00:00:00').getTime() - now.getTime()) / 86400000
        )
        if (diffDays !== 2 && diffDays !== 0) continue

        const targetUid: string = item.assigneeId || ownerId
        const label = diffDays === 0 ? "Aujourd'hui !" : 'Dans 2 jours'

        await sendPush({
          userId: targetUid,
          title: `📅 CheckConnect — ${item.name}`,
          body: `${label} — ${trip.name}`,
          url: '/trips',
          persist: true,
          type: 'CHECKLIST_DUE',
        })
        notified++
      }
    }

    // ── 2. Rappel date de début — J-1 de dateFrom ─────────────────────────────
    const dateFromSec = trip.dateFrom?._seconds ?? trip.dateFrom?.seconds ?? null
    if (dateFromSec) {
      const dateFrom = new Date(dateFromSec * 1000); dateFrom.setHours(0, 0, 0, 0)
      const diffFrom = Math.round((dateFrom.getTime() - now.getTime()) / 86400000)
      if (diffFrom === 1) {
        const allItems = sections.flatMap((s: any) => s.items ?? [])
        const total = allItems.length
        const done = allItems.filter((it: any) => (it.qtyReady ?? 0) >= (it.qtyNeeded ?? 1)).length
        const progress = total > 0 ? ` ${done}/${total} tâches faites.` : ''

        await Promise.allSettled(memberIds.map(uid =>
          sendPush({
            userId: uid,
            title: `✅ ${trip.name} — Tout est prêt ?`,
            body: `Votre CheckConnect commence demain.${progress}`,
            url: '/trips',
            persist: true,
            type: 'CHECKLIST_START',
          })
        ))
        notified += memberIds.length
      }
    }

    // ── 3. Rappels date de fin — J-3 et J-1 de dateTo ────────────────────────
    const dateToSec = trip.dateTo?._seconds ?? trip.dateTo?.seconds ?? null
    if (dateToSec) {
      const dateTo = new Date(dateToSec * 1000); dateTo.setHours(0, 0, 0, 0)
      const diffTo = Math.round((dateTo.getTime() - now.getTime()) / 86400000)
      if (diffTo === 3 || diffTo === 1) {
        const allItems = sections.flatMap((s: any) => s.items ?? [])
        const total = allItems.length
        if (total === 0) return
        const done = allItems.filter((it: any) => (it.qtyReady ?? 0) >= (it.qtyNeeded ?? 1)).length
        if (done >= total) return  // liste complète, pas de rappel

        const label = diffTo === 1 ? 'demain' : 'dans 3 jours'

        await Promise.allSettled(memberIds.map(uid =>
          sendPush({
            userId: uid,
            title: `📋 ${trip.name} — Êtes-vous à jour ?`,
            body: `La liste se termine ${label}. ${done}/${total} tâches faites.`,
            url: '/trips',
            persist: true,
            type: 'CHECKLIST_DEADLINE',
          })
        ))
        notified += memberIds.length
      }
    }
  }))

  return NextResponse.json({ ok: true, checked, notified })
}

export async function GET(req: Request) { return runReminders(req) }
export async function POST(req: Request) { return runReminders(req) }
