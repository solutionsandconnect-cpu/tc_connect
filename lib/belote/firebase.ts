import { db } from '@/lib/firebase'
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, getDocs, writeBatch, Timestamp,
} from 'firebase/firestore'
import type { BeloteTeam, BeloteGame, BeloteRound, BelotePlayer } from './types'

const teamsCol = collection(db, 'belote_teams')
const gamesCol = collection(db, 'belote_games')
const roundsCol = collection(db, 'belote_rounds')

/** Nom d'équipe auto-généré depuis les prénoms : "Marie & Pierre" */
export function teamNameFromPlayers(players: BelotePlayer[]): string {
  return players.map(p => p.firstName.trim()).filter(Boolean).join(' & ') || 'Équipe'
}

// ─── Équipes ────────────────────────────────────────────────────────────────────

// Données privées à chaque utilisateur : on filtre par createdBy (tri côté client → pas d'index composite).
export const listenBeloteTeams = (userUid: string, cb: (teams: BeloteTeam[]) => void) =>
  onSnapshot(query(teamsCol, where('createdBy', '==', userUid)), (snap) => {
    cb(snap.docs
      .map(d => ({ id: d.id, ...d.data() } as BeloteTeam))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)))
  })

export const createBeloteTeam = (players: BelotePlayer[], userUid: string) =>
  addDoc(teamsCol, {
    name: teamNameFromPlayers(players),
    players,
    createdBy: userUid,
    createdAt: Timestamp.now(),
  })

// ─── Parties ────────────────────────────────────────────────────────────────────

export const listenBeloteGames = (userUid: string, cb: (games: BeloteGame[]) => void) =>
  onSnapshot(query(gamesCol, where('createdBy', '==', userUid)), (snap) => {
    cb(snap.docs
      .map(d => ({ id: d.id, ...d.data() } as BeloteGame))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)))
  })

export const listenBeloteGame = (gameId: string, cb: (game: BeloteGame | null) => void) =>
  onSnapshot(doc(db, 'belote_games', gameId), (s) => {
    cb(s.exists() ? ({ id: s.id, ...s.data() } as BeloteGame) : null)
  })

export const createBeloteGame = (data: Omit<BeloteGame, 'id' | 'createdAt'>) =>
  addDoc(gamesCol, { ...data, createdAt: Timestamp.now() })

export const updateBeloteGame = (gameId: string, data: Partial<BeloteGame>) =>
  updateDoc(doc(db, 'belote_games', gameId), data)

/** Supprime une partie ET tous ses tours (cascade) */
export const deleteBeloteGame = async (gameId: string) => {
  const snap = await getDocs(query(roundsCol, where('gameId', '==', gameId)))
  if (snap.docs.length > 0) {
    const batch = writeBatch(db)
    snap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
  }
  await deleteDoc(doc(db, 'belote_games', gameId))
}

// ─── Tours (temps réel) ──────────────────────────────────────────────────────────

/** Listener temps réel des tours d'une partie (tri côté client → pas d'index composite) */
export const listenBeloteRounds = (gameId: string, cb: (rounds: BeloteRound[]) => void) =>
  onSnapshot(query(roundsCol, where('gameId', '==', gameId)), (snap) => {
    const rounds = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as BeloteRound))
      .sort((a, b) => a.roundNumber - b.roundNumber)
    cb(rounds)
  })

export const createBeloteRound = (data: Omit<BeloteRound, 'id' | 'createdAt'>) =>
  addDoc(roundsCol, { ...data, createdAt: Timestamp.now() })

export const updateBeloteRound = (roundId: string, data: Partial<BeloteRound>) =>
  updateDoc(doc(db, 'belote_rounds', roundId), data)

export const deleteBeloteRound = (roundId: string) =>
  deleteDoc(doc(db, 'belote_rounds', roundId))
