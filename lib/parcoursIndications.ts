import { Timestamp } from 'firebase/firestore'
import type { ParcoursIndication, ParcoursIndicationNiveau } from '@/types'

// Styles par niveau (cohérents avec le reste de l'app)
export const NIVEAU_INDICATION: Record<ParcoursIndicationNiveau, {
  label: string; wrap: string; icon: string; chip: string
}> = {
  info:          { label: 'Information',   wrap: 'bg-blue-50 border-blue-200 text-blue-800',    icon: 'text-blue-500',  chip: 'bg-blue-100 text-blue-700' },
  avertissement: { label: 'Avertissement', wrap: 'bg-amber-50 border-amber-200 text-amber-900', icon: 'text-amber-500', chip: 'bg-amber-100 text-amber-700' },
  urgent:        { label: 'Urgent',        wrap: 'bg-red-50 border-red-200 text-red-800',       icon: 'text-red-500',   chip: 'bg-red-100 text-red-700' },
}

// ── Conversion <input type="date"> ⇄ Timestamp ──
export function toDateInput(ts?: Timestamp | null): string {
  if (!ts) return ''
  const d = ts.toDate()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export function fromDateInput(s: string, endOfDay = false): Timestamp {
  const [y, m, d] = s.split('-').map(Number)
  return Timestamp.fromDate(
    new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0),
  )
}

// Affichage lisible d'une plage de dates
export function fmtPlage(deb?: Timestamp | null, fin?: Timestamp | null): string {
  const f = (ts?: Timestamp | null) =>
    ts ? ts.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  return `${f(deb)} → ${f(fin)}`
}

// Statut d'une indication par rapport à maintenant
export function statutIndication(i: ParcoursIndication, nowMs = Date.now()): 'active' | 'à venir' | 'expirée' {
  if (i.dateFin.toMillis() < nowMs) return 'expirée'
  if (i.dateDebut.toMillis() > nowMs) return 'à venir'
  return 'active'
}

// Indication active à un instant T (fenêtre d'affichage contient nowMs)
function activeAt(i: ParcoursIndication, ms: number): boolean {
  return i.dateDebut.toMillis() <= ms && ms <= i.dateFin.toMillis()
}

// Bandeau global haut de page : indications globales actives maintenant
export function indicationsForHeader(all: ParcoursIndication[], nowMs = Date.now()): ParcoursIndication[] {
  return all.filter((i) => i.portee === 'global' && activeAt(i, nowMs))
}

// Indications à afficher pour une séance (carte + modal d'inscription) :
//  - portée session : ciblée sur cette séance ET active maintenant
//  - portée globale : la DATE de la séance tombe dans la fenêtre d'affichage
export function indicationsForSession(
  all: ParcoursIndication[], sessionId: string, sessionDateMs: number, nowMs = Date.now(),
): ParcoursIndication[] {
  return all.filter((i) =>
    i.portee === 'session'
      ? i.sessionId === sessionId && activeAt(i, nowMs)
      : i.surSeances !== false
        && sessionDateMs >= i.dateDebut.toMillis() && sessionDateMs <= i.dateFin.toMillis(),
  )
}
