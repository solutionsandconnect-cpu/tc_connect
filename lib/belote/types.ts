import { Timestamp } from 'firebase/firestore'

// ─── Types génériques (réutilisables pour d'autres jeux à terme) ────────────────

export type TeamSlot = 'team1' | 'team2'
export type BeloteEndCondition = 'rounds' | 'score'
export type BeloteGameStatus = 'in_progress' | 'finished'

export interface Score {
  team1: number
  team2: number
}

// ─── Belote ─────────────────────────────────────────────────────────────────────

export interface BelotePlayer {
  firstName: string
  lastName: string
}

/** Collection : belote_teams */
export interface BeloteTeam {
  id: string
  name: string                 // auto-généré depuis les prénoms : "Marie & Pierre"
  players: BelotePlayer[]      // 2 joueurs
  createdBy?: string           // UID du créateur (données privées à chaque utilisateur)
  createdAt: Timestamp
}

/** Collection : belote_games */
export interface BeloteGame {
  id: string
  team1Id: string
  team2Id: string
  team1Name: string            // dénormalisé pour affichage rapide
  team2Name: string
  endCondition: BeloteEndCondition
  endValue: number             // nombre de tours OU score cible
  status: BeloteGameStatus
  winnerId: string | null
  totalScore: Score
  createdBy?: string           // UID du créateur (pour nettoyage des données à l'archivage)
  createdAt: Timestamp
  finishedAt: Timestamp | null
}

/** Collection : belote_rounds */
export interface BeloteRound {
  id: string
  gameId: string
  roundNumber: number
  dealer: string               // distributeur (nom complet)
  trumpTaker: string           // preneur d'atout (nom complet)
  teamTaker: TeamSlot          // équipe qui a pris l'atout

  // Saisie brute (Nous = team1, Eux = team2)
  rawScoreNous: number
  rawScoreEux: number

  // Événements spéciaux
  capot: boolean
  capotTeam: TeamSlot | null
  dedans: boolean
  beloteRebelote: boolean
  beloteRebeloteTeam: TeamSlot | null

  // Scores calculés après application des règles
  finalScore: Score
  createdAt: Timestamp
}

/**
 * Données pures nécessaires au calcul d'un tour (sans champs Firestore).
 * Convention : Nous = team1, Eux = team2.
 */
export interface RoundInput {
  teamTaker: TeamSlot
  rawScoreNous: number
  rawScoreEux: number
  capot: boolean
  capotTeam: TeamSlot | null
  dedans: boolean
  beloteRebelote: boolean
  beloteRebeloteTeam: TeamSlot | null
  rounding?: boolean           // arrondi à la dizaine (défaut : true)
}
