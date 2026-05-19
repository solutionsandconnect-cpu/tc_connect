// src/lib/firebase.ts
// Configuration Firebase - remplace les valeurs par celles de ta console Firebase
// ou utilise les variables d'environnement dans .env.local

import { Timestamp } from 'firebase/firestore'

export function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function formatHeure(ts: Timestamp | undefined): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateCourt(ts: Timestamp | undefined): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function getEtatBadge(etat: string): {
  label: string
  variant: 'success' | 'warning' | 'danger' | 'info' | 'gray'
} {
  switch (etat) {
    case 'Confirmé':
      return { label: 'Confirmé', variant: 'success' }
    case 'En attente':
      return { label: 'En attente', variant: 'warning' }
    case 'Annulé':
      return { label: 'Annulé', variant: 'danger' }
    case 'Effectué':
      return { label: 'Effectué', variant: 'info' }
    default:
      return { label: etat || '—', variant: 'gray' }
  }
}

export function isSameDay(ts: Timestamp, date: Date): boolean {
  const d = ts.toDate()
  return (
    d.getDate() === date.getDate() &&
    d.getMonth() === date.getMonth() &&
    d.getFullYear() === date.getFullYear()
  )
}