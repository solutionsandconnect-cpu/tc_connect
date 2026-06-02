import type { RoundInput, Score, BeloteGame, BeloteRound } from './types'

/** Total des points d'un tour de belote (dont 10 pour le dernier pli) */
export const BELOTE_TOTAL = 162

/** Valeur d'un capot (tous les plis) */
export const BELOTE_CAPOT = 252

/** Seuil de contrat : l'équipe preneuse doit faire au moins la moitié */
export const BELOTE_CONTRAT = 82

/** Bonus belote & rebelote */
export const BELOTE_BONUS = 20

/** Arrondi à la dizaine la plus proche (5 arrondi au-dessus) */
export function roundToNearestTen(n: number): number {
  return Math.round(n / 10) * 10
}

/**
 * Vérifie que la somme des points bruts vaut 162.
 * (Utilisé hors capot / dedans où la saisie brute n'a pas lieu d'être.)
 */
export function validateRoundPoints(nous: number, eux: number): boolean {
  return nous + eux === BELOTE_TOTAL
}

/**
 * Calcule le score final d'un tour en appliquant toutes les règles :
 * capot, dedans, belote/rebelote, puis arrondi à la dizaine.
 * Fonction pure, sans dépendance Firebase.
 */
export function calculateRoundScore(round: RoundInput): Score {
  // Par défaut on conserve les points exacts saisis (pas d'arrondi)
  const rounding = round.rounding ?? false
  let team1 = 0
  let team2 = 0

  if (round.capot && round.capotTeam) {
    // Capot : l'équipe qui fait tous les plis marque 252, l'autre 0
    if (round.capotTeam === 'team1') { team1 = BELOTE_CAPOT; team2 = 0 }
    else { team1 = 0; team2 = BELOTE_CAPOT }
  } else if (round.dedans) {
    // Dedans : l'équipe preneuse rate son contrat → 0, l'adversaire prend 162
    if (round.teamTaker === 'team1') { team1 = 0; team2 = BELOTE_TOTAL }
    else { team1 = BELOTE_TOTAL; team2 = 0 }
  } else {
    // Cas normal : points bruts saisis
    team1 = round.rawScoreNous || 0
    team2 = round.rawScoreEux || 0
  }

  // Belote & rebelote : +20 à l'équipe qui la détient (s'ajoute au score final)
  if (round.beloteRebelote && round.beloteRebeloteTeam) {
    if (round.beloteRebeloteTeam === 'team1') team1 += BELOTE_BONUS
    else team2 += BELOTE_BONUS
  }

  if (rounding) {
    team1 = roundToNearestTen(team1)
    team2 = roundToNearestTen(team2)
  }

  return { team1, team2 }
}

/** Cumule les scores finaux d'une liste de tours */
export function sumRounds(rounds: Pick<BeloteRound, 'finalScore'>[]): Score {
  return rounds.reduce<Score>(
    (acc, r) => ({
      team1: acc.team1 + (r.finalScore?.team1 ?? 0),
      team2: acc.team2 + (r.finalScore?.team2 ?? 0),
    }),
    { team1: 0, team2: 0 },
  )
}

/**
 * Détermine si la partie est terminée et qui gagne.
 * - 'rounds' : terminée après endValue tours
 * - 'score'  : terminée dès qu'une équipe atteint endValue
 */
export function checkGameEnd(
  game: Pick<BeloteGame, 'endCondition' | 'endValue' | 'team1Id' | 'team2Id'>,
  rounds: Pick<BeloteRound, 'finalScore'>[],
): { finished: boolean; winnerId: string | null } {
  const totals = sumRounds(rounds)

  const winner = (): string | null => {
    if (totals.team1 === totals.team2) return null
    return totals.team1 > totals.team2 ? game.team1Id : game.team2Id
  }

  if (game.endCondition === 'rounds') {
    if (rounds.length >= game.endValue) return { finished: true, winnerId: winner() }
    return { finished: false, winnerId: null }
  }

  // endCondition === 'score'
  if (totals.team1 >= game.endValue || totals.team2 >= game.endValue) {
    return { finished: true, winnerId: winner() }
  }
  return { finished: false, winnerId: null }
}
