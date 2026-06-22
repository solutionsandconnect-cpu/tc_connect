import type { PilotageDocumentType, ProjetContent, ProjetPlanning, ProjetTache } from '@/types'

// Types projet centralisés dans @/types (réutilisés ici)
export type { ProjetFonction, ProjetPlanning, ProjetTache, ProjetContent } from '@/types'

export function emptyProjetContent(): ProjetContent {
  return {
    contexte: '', fonctionnalites: [], livrables: [], horsPerimetre: [],
    planning: [], taches: [],
  }
}

export function defaultProjetContent(over: Partial<ProjetContent> = {}): ProjetContent {
  const base = emptyProjetContent()
  const merged: ProjetContent = {
    contexte: over.contexte ?? base.contexte,
    fonctionnalites: over.fonctionnalites ?? base.fonctionnalites,
    livrables: over.livrables ?? base.livrables,
    horsPerimetre: over.horsPerimetre ?? base.horsPerimetre,
    planning: over.planning ?? base.planning,
    taches: over.taches ?? base.taches,
  }
  // Migration : anciens tableaux séparés tachesClient/tachesSC → liste unique « taches » (champ pour)
  const legacy = over as { tachesClient?: ProjetTache[]; tachesSC?: ProjetTache[] }
  if ((!over.taches || over.taches.length === 0) && (legacy.tachesClient?.length || legacy.tachesSC?.length)) {
    merged.taches = [
      ...(legacy.tachesClient ?? []).map((t) => ({ ...t, pour: 'client' as const })),
      ...(legacy.tachesSC ?? []).map((t) => ({ ...t, pour: 'sc' as const })),
    ]
  }
  return merged
}

// Quelles sections selon le type de document
export interface ProjetSectionsConfig {
  contexte: boolean; fonctionnalites: boolean; livrables: boolean; horsPerimetre: boolean
  planning: boolean; tachesClient: boolean; tachesSC: boolean
}
export function projetSections(type: PilotageDocumentType): ProjetSectionsConfig {
  if (type === 'cahier_charges')
    return { contexte: true, fonctionnalites: true, livrables: true, horsPerimetre: true, planning: true, tachesClient: false, tachesSC: false }
  if (type === 'besoins_client')
    return { contexte: true, fonctionnalites: false, livrables: false, horsPerimetre: false, planning: false, tachesClient: true, tachesSC: false }
  // bilan
  return { contexte: true, fonctionnalites: true, livrables: true, horsPerimetre: false, planning: true, tachesClient: true, tachesSC: true }
}

// Valeurs par défaut reprises de tes modèles
export const LIVRABLES_DEFAUT = [
  'Application web et mobile fonctionnelle',
  "Documentation utilisateur (guide d'utilisation)",
  "Formation initiale à l'utilisation de l'outil",
]

// Exclusions classiques d'une presta d'app sur-mesure (cases à cocher du « Hors-périmètre »)
export const HORS_PERIMETRE_DEFAUT = [
  'Rédaction des contenus (textes, photos, logos)',
  'Hébergement et nom de domaine (au nom du client)',
  'Comptes de services tiers (envoi d\'e-mails, SMS…) au nom du client',
  'Nouvelles fonctionnalités après la livraison (évolutif)',
  'Reprise / migration des données existantes',
  'Publication sur les stores (App Store / Google Play)',
  'Maintenance au-delà de la période incluse',
]

// Responsables possibles d'une étape de planning (chips)
export const RESPONSABLES_PLANNING = ['Développeur', 'Client', 'Développeur / Client'] as const

// ── Planning en cascade : la date de chaque étape = date précédente + son délai (en jours) ──
// Une étape « ancrée » (date saisie à la main) n'est jamais recalculée ; les suivantes repartent d'elle.
export function addDaysIso(iso: string, days: number): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + (days || 0))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

export function recalcPlanning(items: ProjetPlanning[]): ProjetPlanning[] {
  const out = items.slice()
  for (let i = 1; i < out.length; i++) {
    if (out[i].ancre) continue // date fixée à la main → on n'y touche pas
    const prev = out[i - 1]
    if (prev.date && prev.dureeJours != null)
      out[i] = { ...out[i], date: addDaysIso(prev.date, prev.dureeJours) }
  }
  return out
}
