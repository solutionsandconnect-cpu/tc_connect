import type { PilotageContrat, Facture, SuiviPeriodique } from '@/types'

// ── « À suivre » : dérive des items d'alerte/relance depuis les contrats + leurs devis ──
// Phase 1 : devis en attente, tâches à facturer / en retard, prochaine étape du planning,
// jalon « maquette validée » (rappel transitoire ≤ 14 j), fenêtre de préavis/reconduction
// (durée d'engagement & préavis configurables par contrat, défauts 12 mois / 2 mois).

export type SuiviTone = 'danger' | 'warn' | 'info'
export interface SuiviItem {
  key: string
  contratId: string
  clientNom: string
  tone: SuiviTone
  text: string
  sort: number       // jours jusqu'à l'échéance (négatif = en retard / urgent) → tri croissant
  tab?: string        // onglet à ouvrir sur la page contrat
}

const DAY = 86_400_000
const dOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parseYmd = (s: string): Date | null => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null }
const daysBetween = (from: Date, to: Date) => Math.round((dOnly(to).getTime() - dOnly(from).getTime()) / DAY)
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
const fmtFr = (d: Date) => d.toLocaleDateString('fr-FR')

const DEVIS_TRAITE = new Set(['accepted', 'rejected', 'cancelled', 'paid'])

// Au-delà de ce délai sans aucune activité (tâche / planning / devis), un contrat actif est « dormant ».
export const DORMANT_MOIS = 3

// Timestamp Firestore (client `seconds` ou admin `_seconds`) → Date, ou null.
const tsToDate = (ts: any): Date | null => {
  const s = ts?.seconds ?? ts?._seconds
  return s != null ? new Date(s * 1000) : null
}

// Suivis récurrents pré-remplis pour un nouveau contrat (modifiables / supprimables ensuite).
export function defaultSuivisPeriodiques(): SuiviPeriodique[] {
  return [
    { id: 'quota', label: "Relevé du quota d'utilisateurs", intervalleMois: 3 },
    { id: 'revision', label: 'Révision tarifaire annuelle', intervalleMois: 12 },
  ]
}

// Prochaine échéance d'un suivi récurrent : (dernierFait ou ancre du contrat) + intervalle.
export function prochainSuivi(s: SuiviPeriodique, anchor: Date): Date {
  const base = s.dernierFait ? (parseYmd(s.dernierFait) ?? anchor) : anchor
  return addMonths(base, Math.max(1, s.intervalleMois || 1))
}

export function buildSuiviItems(contrats: PilotageContrat[], invoices: Facture[], now = new Date()): SuiviItem[] {
  const today = dOnly(now)
  const todayStr = toYmd(today)
  const out: SuiviItem[] = []

  for (const c of contrats) {
    if (c.statut === 'termine') continue
    const cid = c.id
    const nom = c.clientNom

    // 1) Devis en attente (envoyé / en attente, non encore traité) + expiration de la validité.
    for (const d of invoices) {
      if (d.type !== 'devis' || d.contratId !== cid) continue
      if (DEVIS_TRAITE.has(d.status) || d.status === 'draft') continue   // brouillon = pas encore envoyé
      const ts = d.date ?? d.createdAt
      const dd = ts?.seconds ? new Date(ts.seconds * 1000) : null
      const valJours = d.validiteJours ?? 30
      if (!dd) { out.push({ key: `dev-${d.id}`, contratId: cid, clientNom: nom, tone: 'info', text: `Devis ${d.number} en attente`, sort: 900, tab: 'documents' }); continue }
      const expiry = new Date(dd); expiry.setDate(expiry.getDate() + valJours)
      const toExpiry = daysBetween(today, expiry)
      const age = Math.max(0, daysBetween(dd, today))
      if (toExpiry < 0) out.push({ key: `dev-${d.id}`, contratId: cid, clientNom: nom, tone: 'danger', text: `Devis ${d.number} expiré (validité ${valJours} j dépassée) — relancer ou re-proposer`, sort: toExpiry, tab: 'documents' })
      else if (toExpiry <= 7) out.push({ key: `dev-${d.id}`, contratId: cid, clientNom: nom, tone: 'warn', text: `Devis ${d.number} expire dans ${toExpiry} j — relancer le client`, sort: toExpiry, tab: 'documents' })
      else out.push({ key: `dev-${d.id}`, contratId: cid, clientNom: nom, tone: 'info', text: `Devis ${d.number} en attente (envoyé il y a ${age} j)`, sort: toExpiry, tab: 'documents' })
    }

    // 2) Tâches : à facturer (évolutions payantes) + en retard.
    const taches = c.projet?.taches ?? []
    const nFac = taches.filter((t) => t.facturation === 'facturer' && !t.facturee).length
    if (nFac > 0) out.push({ key: `fac-${cid}`, contratId: cid, clientNom: nom, tone: 'warn', text: `${nFac} évolution${nFac > 1 ? 's' : ''} à facturer`, sort: -5, tab: 'taches' })
    const nRet = taches.filter((t) => t.date && t.date < todayStr && !t.fait).length
    if (nRet > 0) out.push({ key: `ret-${cid}`, contratId: cid, clientNom: nom, tone: 'warn', text: `${nRet} tâche${nRet > 1 ? 's' : ''} en retard`, sort: -4, tab: 'taches' })

    // 3) Prochaine étape du planning (à venir, dans ≤ 14 j).
    const next = (c.projet?.planning ?? [])
      .filter((p) => p.date && p.date >= todayStr && p.etape?.trim())
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    if (next) {
      const nd = parseYmd(next.date)
      if (nd) { const days = daysBetween(today, nd); if (days <= 14) out.push({ key: `step-${cid}`, contratId: cid, clientNom: nom, tone: days <= 3 ? 'warn' : 'info', text: `Étape « ${next.etape} » ${days === 0 ? "aujourd'hui" : `dans ${days} j`} (${fmtFr(nd)})`, sort: days, tab: 'planning' }) }
    }

    // 3b) Jalon « maquette validée » : rappel transitoire (≤ 14 j après la validation) que le
    // périmètre est gelé → les nouvelles demandes passent en « à facturer ». S'efface ensuite.
    if (c.maquetteValideeLe) {
      const mv = parseYmd(c.maquetteValideeLe)
      if (mv) {
        const since = daysBetween(mv, today)
        if (since >= 0 && since <= 14) out.push({ key: `maq-${cid}`, contratId: cid, clientNom: nom, tone: 'warn', text: `Maquette validée le ${fmtFr(mv)} — périmètre gelé : passe les nouvelles demandes en « à facturer »`, sort: since - 14, tab: 'taches' })
      }
    }

    // 4) Préavis / reconduction (contrat actif avec abonnement + date de début).
    // Durée d'engagement et préavis configurables par contrat (défauts 12 mois / 2 mois).
    if (c.statut === 'actif' && (c.abonnementMensuel ?? 0) > 0 && c.dateDebut) {
      const engagementMois = c.dureeEngagementMois && c.dureeEngagementMois > 0 ? c.dureeEngagementMois : 12
      const preavisMois = c.preavisMois && c.preavisMois > 0 ? c.preavisMois : 2
      const start = dOnly(c.dateDebut.toDate())
      let fin = addMonths(start, engagementMois)
      let guard = 0
      while (fin < today && guard++ < 120) fin = addMonths(fin, engagementMois)   // prochaine échéance d'engagement ≥ aujourd'hui
      const preavis = addMonths(fin, -preavisMois)
      const toPreavis = daysBetween(today, preavis)
      const toFin = daysBetween(today, fin)
      if (today >= preavis && today <= fin) out.push({ key: `rec-${cid}`, contratId: cid, clientNom: nom, tone: 'warn', text: `Fenêtre de préavis ouverte — reconduction le ${fmtFr(fin)} (préavis ${preavisMois} mois)`, sort: toFin, tab: 'documents' })
      else if (toPreavis > 0 && toPreavis <= 30) out.push({ key: `rec-${cid}`, contratId: cid, clientNom: nom, tone: 'info', text: `Préavis de reconduction dans ${toPreavis} j (reconduction le ${fmtFr(fin)}, préavis ${preavisMois} mois)`, sort: toPreavis, tab: 'documents' })
    }

    // ── Phase 2 — suivis périodiques & client dormant (contrats actifs uniquement) ──
    if (c.statut === 'actif') {
      const anchor = dOnly(tsToDate(c.dateDebut) ?? tsToDate(c.createdAt) ?? now)

      // 5) Suivis récurrents (relevé quota, révision tarifaire…) arrivant à échéance (≤ 7 j ou en retard).
      for (const s of c.suivisPeriodiques ?? []) {
        if (!s?.label?.trim() || !(s.intervalleMois > 0)) continue
        const prochain = prochainSuivi(s, anchor)
        const to = daysBetween(today, prochain)
        if (to > 7) continue
        if (to < 0) out.push({ key: `per-${cid}-${s.id}`, contratId: cid, clientNom: nom, tone: 'warn', text: `${s.label} — en retard de ${-to} j (à refaire tous les ${s.intervalleMois} mois)`, sort: to, tab: 'suivi' })
        else out.push({ key: `per-${cid}-${s.id}`, contratId: cid, clientNom: nom, tone: 'info', text: `${s.label} ${to === 0 ? "à faire aujourd'hui" : `à faire dans ${to} j`} (tous les ${s.intervalleMois} mois)`, sort: to, tab: 'suivi' })
      }

      // 6) Client dormant : aucune activité (tâche / planning / devis / suivi) depuis DORMANT_MOIS.
      let lastMs = anchor.getTime()
      const bump = (d: Date | null) => { if (d) lastMs = Math.max(lastMs, dOnly(d).getTime()) }
      bump(c.maquetteValideeLe ? parseYmd(c.maquetteValideeLe) : null)
      for (const t of c.projet?.taches ?? []) bump(t.date ? parseYmd(t.date) : null)
      for (const p of c.projet?.planning ?? []) bump(p.date ? parseYmd(p.date) : null)
      for (const s of c.suivisPeriodiques ?? []) bump(s.dernierFait ? parseYmd(s.dernierFait) : null)
      for (const d of invoices) { if (d.contratId === cid) bump(tsToDate(d.date) ?? tsToDate(d.createdAt)) }
      const seuilDormant = addMonths(today, -DORMANT_MOIS)
      if (lastMs < dOnly(seuilDormant).getTime()) {
        const moisInactif = Math.floor(daysBetween(new Date(lastMs), today) / 30)
        out.push({ key: `dorm-${cid}`, contratId: cid, clientNom: nom, tone: 'info', text: `Client dormant — aucune activité depuis ~${moisInactif} mois, prends des nouvelles`, sort: 500, tab: 'documents' })
      }
    }
  }

  return out.sort((a, b) => a.sort - b.sort)
}
