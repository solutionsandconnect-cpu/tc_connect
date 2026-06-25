import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

const CRON_SECRET = process.env.CRON_SECRET

// ── Rappels « suivi des contrats » pour l'admin (Pilotage) ──────────────────────
// Pendant que le tableau « À suivre » (in-app) est toujours visible, ce cron pousse
// une notification (push + section Notifications) UNIQUEMENT sur des seuils précis,
// pour éviter le spam quotidien. Calqué sur /api/factures/echeance-reminders.
//
//  • Devis en attente : expire dans 7 / 3 / 1 / 0 j, et « expiré hier » (une fois).
//  • Préavis / reconduction : fenêtre de préavis dans 30 / 7 / 1 / 0 j.
//  • Jalon « maquette validée » : le jour J (périmètre gelé).
//  • Étape de planning à venir : dans 3 / 1 / 0 j.
//  • Tâches à facturer / en retard : digest hebdomadaire (lundi) — pas de date propre.

const DAY = 86_400_000
const DEVIS_TRAITE = new Set(['accepted', 'rejected', 'cancelled', 'paid'])

const dOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parseYmd = (s: string): Date | null => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null }
const daysBetween = (from: Date, to: Date) => Math.round((dOnly(to).getTime() - dOnly(from).getTime()) / DAY)
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
const fmtFr = (d: Date) => d.toLocaleDateString('fr-FR')

// Extrait les millisecondes d'un Timestamp Firestore (admin = _seconds, client = seconds).
const tsToMs = (ts: any): number | null =>
  ts?._seconds != null ? ts._seconds * 1000 : (ts?.seconds != null ? ts.seconds * 1000 : null)

async function runReminders(req: Request) {
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminDb()
  const now = new Date()
  const today = dOnly(now)
  const todayStr = toYmd(today)
  const isMonday = now.getDay() === 1

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  let checked = 0
  let notified = 0

  const push = async (title: string, body: string, contratId: string, tab: string) => {
    try {
      await fetch(`${base}/api/push/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAdmins: true,
          title,
          body,
          url: `/pilotage/contrat/${contratId}?tab=${tab}`,
          persist: true,
          type: 'PILOTAGE_SUIVI',
        }),
      })
      notified++
    } catch { /* push silencieux */ }
  }

  const [contratsSnap, devisSnap] = await Promise.all([
    db.collection('pilotage_contrats').get(),
    db.collection('factures').where('type', '==', 'devis').get(),
  ])

  // Index des devis par contrat relié.
  const devisByContrat = new Map<string, any[]>()
  for (const d of devisSnap.docs) {
    const f: any = { id: d.id, ...d.data() }
    if (!f.contratId) continue
    const arr = devisByContrat.get(f.contratId) ?? []
    arr.push(f)
    devisByContrat.set(f.contratId, arr)
  }

  await Promise.allSettled(contratsSnap.docs.map(async (doc) => {
    const c: any = { id: doc.id, ...doc.data() }
    if (c.statut === 'termine') return
    const cid: string = c.id
    const nom: string = c.clientNom || 'un client'
    checked++

    // 1) Devis en attente — expiration de la validité.
    for (const d of devisByContrat.get(cid) ?? []) {
      if (DEVIS_TRAITE.has(d.status) || d.status === 'draft') continue
      const ms = tsToMs(d.date) ?? tsToMs(d.createdAt)
      if (ms === null) continue
      const valJours = d.validiteJours ?? 30
      const expiry = new Date(ms); expiry.setDate(expiry.getDate() + valJours)
      const toExpiry = daysBetween(today, expiry)
      if ([7, 3, 1, 0].includes(toExpiry)) {
        const when = toExpiry === 0 ? "aujourd'hui" : `dans ${toExpiry} j`
        await push('🧾 Devis à relancer', `${nom} · le devis ${d.number} expire ${when} — relancer le client.`, cid, 'documents')
      } else if (toExpiry === -1) {
        await push('🧾 Devis expiré', `${nom} · le devis ${d.number} a dépassé sa validité (${valJours} j) — relancer ou re-proposer.`, cid, 'documents')
      }
    }

    // 2) Jalon « maquette validée » — le jour J : périmètre gelé.
    if (c.maquetteValideeLe) {
      const mv = parseYmd(c.maquetteValideeLe)
      if (mv && daysBetween(mv, today) === 0) {
        await push('🎨 Maquette validée', `${nom} · périmètre gelé — passe les nouvelles demandes en « à facturer ».`, cid, 'taches')
      }
    }

    // 3) Prochaine étape de planning (à venir, seuils 3 / 1 / 0 j).
    for (const p of (c.projet?.planning ?? [])) {
      if (!p?.etape?.trim() || !p.date || p.date < todayStr) continue
      const pd = parseYmd(p.date)
      if (!pd) continue
      const days = daysBetween(today, pd)
      if ([3, 1, 0].includes(days)) {
        const when = days === 0 ? "aujourd'hui" : days === 1 ? 'demain' : 'dans 3 jours'
        await push('📅 Étape de planning', `${nom} · « ${p.etape} » ${when} (${fmtFr(pd)}).`, cid, 'planning')
      }
    }

    // 4) Préavis / reconduction (contrat actif avec abonnement + date de début).
    if (c.statut === 'actif' && (c.abonnementMensuel ?? 0) > 0) {
      const startMs = tsToMs(c.dateDebut)
      if (startMs !== null) {
        const engagementMois = c.dureeEngagementMois && c.dureeEngagementMois > 0 ? c.dureeEngagementMois : 12
        const preavisMois = c.preavisMois && c.preavisMois > 0 ? c.preavisMois : 2
        let fin = addMonths(dOnly(new Date(startMs)), engagementMois)
        let guard = 0
        while (fin < today && guard++ < 120) fin = addMonths(fin, engagementMois)
        const preavis = addMonths(fin, -preavisMois)
        const toPreavis = daysBetween(today, preavis)
        if ([30, 7, 1, 0].includes(toPreavis)) {
          const when = toPreavis === 0 ? "aujourd'hui — la fenêtre s'ouvre" : `dans ${toPreavis} j`
          await push('🔁 Préavis de reconduction', `${nom} · préavis de non-reconduction ${when} (reconduction le ${fmtFr(fin)}).`, cid, 'documents')
        }
      }
    }

    // 5) Phase 2 — suivis périodiques & client dormant (contrats actifs uniquement).
    if (c.statut === 'actif') {
      const anchor = dOnly(new Date(tsToMs(c.dateDebut) ?? tsToMs(c.createdAt) ?? today.getTime()))

      // 5a) Suivis récurrents : échéance dans 7 / 1 / 0 j. En retard → rappel hebdomadaire (lundi).
      for (const s of (c.suivisPeriodiques ?? [])) {
        if (!s?.label?.trim() || !(s.intervalleMois > 0)) continue
        const baseMs = s.dernierFait ? (parseYmd(s.dernierFait)?.getTime() ?? anchor.getTime()) : anchor.getTime()
        const prochain = addMonths(dOnly(new Date(baseMs)), s.intervalleMois)
        const to = daysBetween(today, prochain)
        if ([7, 1, 0].includes(to)) {
          const when = to === 0 ? "aujourd'hui" : `dans ${to} j`
          await push('🔔 Suivi récurrent', `${nom} · « ${s.label} » à faire ${when}.`, cid, 'suivi')
        } else if (to < 0 && isMonday) {
          await push('🔔 Suivi en retard', `${nom} · « ${s.label} » en retard de ${-to} j.`, cid, 'suivi')
        }
      }

      // 5b) Client dormant : aucune activité (tâche / planning / devis / suivi) depuis 3 mois → rappel hebdo (lundi).
      if (isMonday) {
        let lastMs = anchor.getTime()
        const bump = (ms: number | null) => { if (ms !== null) lastMs = Math.max(lastMs, ms) }
        if (c.maquetteValideeLe) bump(parseYmd(c.maquetteValideeLe)?.getTime() ?? null)
        for (const t of (c.projet?.taches ?? [])) if (t.date) bump(parseYmd(t.date)?.getTime() ?? null)
        for (const p of (c.projet?.planning ?? [])) if (p.date) bump(parseYmd(p.date)?.getTime() ?? null)
        for (const s of (c.suivisPeriodiques ?? [])) if (s.dernierFait) bump(parseYmd(s.dernierFait)?.getTime() ?? null)
        for (const d of devisByContrat.get(cid) ?? []) bump(tsToMs(d.date) ?? tsToMs(d.createdAt))
        if (lastMs < addMonths(today, -3).getTime()) {
          const moisInactif = Math.floor(daysBetween(new Date(lastMs), today) / 30)
          await push('💤 Client dormant', `${nom} · aucune activité depuis ~${moisInactif} mois — prends des nouvelles.`, cid, 'documents')
        }
      }
    }

    // 6) Tâches à facturer / en retard — digest hebdomadaire (lundi).
    if (isMonday) {
      const taches: any[] = c.projet?.taches ?? []
      const nFac = taches.filter((t) => t.facturation === 'facturer' && !t.facturee).length
      if (nFac > 0) await push('💶 Évolutions à facturer', `${nom} · ${nFac} évolution${nFac > 1 ? 's' : ''} en attente de facturation.`, cid, 'taches')
      const nRet = taches.filter((t) => t.date && t.date < todayStr && !t.fait).length
      if (nRet > 0) await push('⏰ Tâches en retard', `${nom} · ${nRet} tâche${nRet > 1 ? 's' : ''} en retard.`, cid, 'taches')
    }
  }))

  return NextResponse.json({ ok: true, checked, notified })
}

export async function GET(req: Request) { return runReminders(req) }
export async function POST(req: Request) { return runReminders(req) }
