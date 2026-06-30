import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Rappels « facture à émettre » pour les admins.
 * Pour chaque échéance d'un devis accepté non encore facturée, envoie une
 * notification (push + section Notifications) à J-3, J-1 et le jour J (J-0).
 * Diffusé à tous les admins (toAdmins) — même ciblage robuste que les crons
 * pilotage/espace ; le ciblage par userId du propriétaire ratait le push si
 * l'abonnement n'était pas exactement rangé sous cet uid.
 */
async function runReminders(req: Request) {
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminDb()
  const now = new Date(); now.setHours(0, 0, 0, 0)

  let checked = 0
  let notified = 0

  const snap = await db.collection('factures')
    .where('type', '==', 'devis')
    .where('status', '==', 'accepted')
    .get()

  await Promise.allSettled(snap.docs.map(async (d) => {
    const devis: any = { id: d.id, ...d.data() }
    const echeances: any[] = devis.echeances ?? []
    if (echeances.length === 0) return

    const ownerId: string = devis.userId
    if (!ownerId) return

    // Nombre d'échéances déjà converties en factures
    const already = (devis.convertedToFactureIds
      ?? (devis.convertedToFactureId ? [devis.convertedToFactureId] : [])).length

    for (let i = already; i < echeances.length; i++) {
      const ech = echeances[i]
      const ms = ech?.date?._seconds != null
        ? ech.date._seconds * 1000
        : (ech?.date?.seconds != null ? ech.date.seconds * 1000 : null)
      if (ms === null) continue
      checked++

      const echDate = new Date(ms); echDate.setHours(0, 0, 0, 0)
      const diffDays = Math.round((echDate.getTime() - now.getTime()) / 86400000)
      if (diffDays !== 3 && diffDays !== 1 && diffDays !== 0) continue  // J-3, J-1 et J-0

      const label = ech.label || `Règlement ${i + 1}/${echeances.length}`
      const when = diffDays === 0 ? "aujourd'hui" : diffDays === 1 ? 'demain' : 'dans 3 jours'
      const client = devis.clientName || 'un client'
      const montant = typeof ech.montant === 'number' ? ` (${ech.montant.toLocaleString('fr-FR')} €)` : ''

      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toAdmins: true,
            title: '🧾 Facture à émettre',
            body: `${client} · ${label}${montant} — échéance ${when}.`,
            url: '/facturation?tab=devis',
            persist: true,
            type: 'FACTURE_ECHEANCE',
          }),
        })
        notified++
      } catch { /* push silencieux */ }
    }
  }))

  return NextResponse.json({ ok: true, checked, notified })
}

export async function GET(req: Request) { return runReminders(req) }
export async function POST(req: Request) { return runReminders(req) }
