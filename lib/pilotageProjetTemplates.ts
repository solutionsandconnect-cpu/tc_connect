import type { PilotageDocumentType, ProjetContent } from '@/types'

// Types projet centralisés dans @/types (réutilisés ici)
export type { ProjetFonction, ProjetPlanning, ProjetTache, ProjetContent } from '@/types'

export function emptyProjetContent(): ProjetContent {
  return {
    contexte: '', fonctionnalites: [], livrables: [],
    planning: [], tachesClient: [], tachesSC: [],
  }
}

export function defaultProjetContent(over: Partial<ProjetContent> = {}): ProjetContent {
  return { ...emptyProjetContent(), ...over }
}

// Quelles sections selon le type de document
export interface ProjetSectionsConfig {
  contexte: boolean; fonctionnalites: boolean; livrables: boolean
  planning: boolean; tachesClient: boolean; tachesSC: boolean
}
export function projetSections(type: PilotageDocumentType): ProjetSectionsConfig {
  if (type === 'cahier_charges')
    return { contexte: true, fonctionnalites: true, livrables: true, planning: true, tachesClient: false, tachesSC: false }
  if (type === 'besoins_client')
    return { contexte: true, fonctionnalites: false, livrables: false, planning: false, tachesClient: true, tachesSC: false }
  // bilan
  return { contexte: true, fonctionnalites: true, livrables: true, planning: true, tachesClient: true, tachesSC: true }
}

// Valeurs par défaut reprises de tes modèles
export const LIVRABLES_DEFAUT = [
  'Application web et mobile fonctionnelle',
  "Documentation utilisateur (guide d'utilisation)",
  "Formation initiale à l'utilisation de l'outil",
]
