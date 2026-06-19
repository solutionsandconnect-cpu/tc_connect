import type { ParcoursNote } from '@/types'

// Notes participant — type "Paiement anticipé" en tête (Option B avec montant)
export const PAYMENT_NOTE_TYPE = 'Paiement anticipé'
export const PARCOURS_NOTE_TYPES = [PAYMENT_NOTE_TYPE, 'Observation', 'Alerte', 'Rappel', 'Autre']

export function getParcoursNoteStyle(type: string) {
  switch (type) {
    case PAYMENT_NOTE_TYPE: return { card: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' }
    case 'Alerte':          return { card: 'bg-red-50 border-red-200',         badge: 'bg-red-100 text-red-700' }
    case 'Rappel':          return { card: 'bg-sky-50 border-sky-200',         badge: 'bg-sky-100 text-sky-700' }
    case 'Observation':     return { card: 'bg-orange-50 border-orange-200',   badge: 'bg-orange-100 text-orange-700' }
    default:                return { card: 'bg-gray-50 border-gray-200',        badge: 'bg-gray-100 text-gray-500' }
  }
}

export const isNoteExpired = (n: ParcoursNote) =>
  !!n.date_max_note_active && n.date_max_note_active.toDate() < new Date()

// Solde restant d'une avance = montant initial − montant déjà appliqué (Option C)
export const noteRemaining = (n: ParcoursNote) => (n.montant ?? 0) - (n.montantConsomme ?? 0)

// Une avance est "disponible" si c'est un paiement anticipé non expiré avec un solde > 0
export const isAdvanceAvailable = (n: ParcoursNote) =>
  n.type_note === PAYMENT_NOTE_TYPE && !isNoteExpired(n) && noteRemaining(n) > 0

// Clé d'un participant : email (sinon NOM|prénom), en minuscules.
// Identique à pKey() de la page Participants pour que les notes correspondent.
export const participantKey = (p: { email?: string; firstName?: string; lastName?: string }) =>
  (p.email?.trim() || `${p.lastName ?? ''}|${p.firstName ?? ''}`).toLowerCase()
