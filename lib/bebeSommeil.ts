/**
 * Prédiction du prochain endormissement (app Suivi Bébé).
 *
 * Aucune IA là-dedans : la « prédiction » des apps du marché repose sur la
 * FENÊTRE D'ÉVEIL — le temps qu'un bébé tient éveillé avant d'avoir besoin de
 * dormir. Elle s'allonge avec l'âge, et varie d'un enfant à l'autre. On combine
 * donc deux sources :
 *   1. un repère par ÂGE (valeurs pédiatriques d'usage courant) ;
 *   2. les fenêtres RÉELLEMENT observées chez cet enfant, dès qu'on en a assez.
 *
 * ⚠️ C'est une indication de confort, pas un avis médical, et sa justesse dépend
 * entièrement de la complétude de la saisie : une sieste non notée fausse la
 * fenêtre suivante. L'interface doit toujours montrer sur quoi le calcul s'appuie.
 */

/** Un sommeil déjà terminé */
export interface SommeilTermine {
  debut: Date
  fin: Date
}

/** Repères d'âge : fenêtre d'éveil typique (minutes) jusqu'à `jusquaMois` mois révolus */
const FENETRES_AGE: { jusquaMois: number; minutes: number }[] = [
  { jusquaMois: 1,   minutes: 50  },
  { jusquaMois: 2,   minutes: 75  },
  { jusquaMois: 3,   minutes: 90  },
  { jusquaMois: 4,   minutes: 105 },
  { jusquaMois: 6,   minutes: 135 },
  { jusquaMois: 9,   minutes: 165 },
  { jusquaMois: 12,  minutes: 210 },
  { jusquaMois: 18,  minutes: 240 },
  { jusquaMois: 999, minutes: 300 },
]

/** Au-delà, on considère qu'un sommeil n'a pas été noté plutôt qu'un éveil réel */
const FENETRE_MAX_MIN = 6 * 60
/** En deçà, c'est un micro-réveil ou une saisie en double, pas une fenêtre d'éveil */
const FENETRE_MIN_MIN = 20
/** Nombre de fenêtres récentes prises en compte */
const ECHANTILLON = 5
/** En dessous, l'historique personnel n'est pas assez parlant : on s'en tient à l'âge */
const MIN_MESURES_PERSO = 3

export function ageEnMois(naissance: Date, maintenant: Date): number {
  return (maintenant.getTime() - naissance.getTime()) / (30.44 * 86_400_000)
}

/** Fenêtre d'éveil de référence pour l'âge (minutes) */
export function fenetreEveilAge(ageMois: number): number {
  return (FENETRES_AGE.find(f => ageMois < f.jusquaMois) ?? FENETRES_AGE[FENETRES_AGE.length - 1]).minutes
}

/**
 * Fenêtres d'éveil observées : écart entre la fin d'un sommeil et le début du
 * suivant. Les valeurs aberrantes sont écartées (sommeil oublié, doublon).
 * `sommeils` doit être trié du plus RÉCENT au plus ancien.
 */
export function fenetresObservees(sommeils: SommeilTermine[], max = ECHANTILLON): number[] {
  const out: number[] = []
  for (let i = 0; i < sommeils.length - 1 && out.length < max; i++) {
    const finPrecedent = sommeils[i + 1].fin   // le sommeil d'AVANT dans le temps
    const debutSuivant = sommeils[i].debut
    const min = (debutSuivant.getTime() - finPrecedent.getTime()) / 60_000
    if (min >= FENETRE_MIN_MIN && min <= FENETRE_MAX_MIN) out.push(Math.round(min))
  }
  return out
}

export interface Fenetre {
  minutes: number
  /** D'où vient la valeur — à afficher, pour que l'utilisateur juge sa fiabilité */
  source: 'age' | 'mixte'
  /** Nombre de fenêtres réelles utilisées */
  nbMesures: number
  /** Repère d'âge seul, pour comparaison */
  minutesAge: number
}

/**
 * Fenêtre retenue : repère d'âge seul tant qu'on a moins de 3 mesures, sinon
 * moyenne pondérée 70 % observé / 30 % âge — l'âge sert de garde-fou quand
 * quelques saisies manquent.
 */
export function fenetreRetenue(ageMois: number, observees: number[]): Fenetre {
  const minutesAge = fenetreEveilAge(ageMois)
  if (observees.length < MIN_MESURES_PERSO) {
    return { minutes: minutesAge, source: 'age', nbMesures: observees.length, minutesAge }
  }
  const moyenne = observees.reduce((s, v) => s + v, 0) / observees.length
  return {
    minutes: Math.round(moyenne * 0.7 + minutesAge * 0.3),
    source: 'mixte',
    nbMesures: observees.length,
    minutesAge,
  }
}

export interface PredictionSommeil {
  /** Heure estimée du prochain endormissement */
  prevuA: Date
  /** Minutes restantes (négatif = fenêtre déjà dépassée) */
  dansMin: number
  /** Fin du dernier sommeil = début de la fenêtre d'éveil en cours */
  dernierReveil: Date
  fenetre: Fenetre
}

/**
 * Prochain endormissement estimé. Renvoie null s'il n'y a aucun sommeil terminé
 * (rien sur quoi s'appuyer) — mieux vaut ne rien afficher qu'inventer.
 */
export function predireProchainSommeil(
  sommeils: SommeilTermine[],
  naissance: Date | null,
  maintenant: Date,
): PredictionSommeil | null {
  if (!sommeils.length) return null
  const dernierReveil = sommeils[0].fin
  const ageMois = naissance ? ageEnMois(naissance, maintenant) : 3 // repli prudent
  const fenetre = fenetreRetenue(ageMois, fenetresObservees(sommeils))
  const prevuA = new Date(dernierReveil.getTime() + fenetre.minutes * 60_000)
  return {
    prevuA,
    dansMin: Math.round((prevuA.getTime() - maintenant.getTime()) / 60_000),
    dernierReveil,
    fenetre,
  }
}
