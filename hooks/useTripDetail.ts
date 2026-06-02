'use client'

import { useEffect, useState, useCallback } from 'react'
import { listenTrip, updateTrip, genId, nbJoursOf, qtyEffective } from '@/lib/tripsService'
import type { Trip, TripSection, TripItem } from '@/types'

/**
 * Détail d'un voyage + mutations sections/items.
 * Les mutations s'appuient sur la latency-compensation de Firestore :
 * l'écriture déclenche un snapshot local immédiat (optimistic), et en cas
 * d'échec serveur Firestore révoque automatiquement le changement (rollback).
 */
export function useTripDetail(tripId: string | null) {
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId) { setTrip(null); setLoading(false); return }
    setLoading(true)
    const unsub = listenTrip(tripId, (t) => {
      setTrip(t)
      setLoading(false)
    })
    return unsub
  }, [tripId])

  // Applique un transformateur sur les sections puis persiste
  const commit = useCallback((sections: TripSection[]) => {
    if (!tripId) return Promise.reject(new Error('no trip'))
    return updateTrip(tripId, { sections })
  }, [tripId])

  const mutate = useCallback((fn: (sections: TripSection[]) => TripSection[]) => {
    if (!trip) return Promise.reject(new Error('no trip'))
    return commit(fn(trip.sections))
  }, [trip, commit])

  // ── Sections ──────────────────────────────────────────────────────────────
  const addSection = (title: string) =>
    mutate(secs => [...secs, { id: genId(), title: title.trim() || 'Nouvelle section', position: secs.length, items: [] }])

  const renameSection = (sectionId: string, title: string) =>
    mutate(secs => secs.map(s => s.id === sectionId ? { ...s, title } : s))

  const deleteSection = (sectionId: string) =>
    mutate(secs => secs.filter(s => s.id !== sectionId).map((s, i) => ({ ...s, position: i })))

  const moveSection = (sectionId: string, dir: 'up' | 'down') =>
    mutate(secs => {
      const sorted = [...secs].sort((a, b) => a.position - b.position)
      const idx = sorted.findIndex(s => s.id === sectionId)
      const swap = dir === 'up' ? idx - 1 : idx + 1
      if (idx < 0 || swap < 0 || swap >= sorted.length) return secs
      ;[sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]]
      return sorted.map((s, i) => ({ ...s, position: i }))
    })

  // ── Items ─────────────────────────────────────────────────────────────────
  const addItem = (sectionId: string, name: string) =>
    mutate(secs => secs.map(s => s.id === sectionId
      ? { ...s, items: [...s.items, {
          id: genId(), name: name.trim(), qtyNeeded: 1, qtyReady: 0,
          multiplier: 0, note: '', assigneeId: null, position: s.items.length,
        }] }
      : s))

  const updateItem = (sectionId: string, itemId: string, patch: Partial<TripItem>) =>
    mutate(secs => secs.map(s => s.id === sectionId
      ? { ...s, items: s.items.map(it => it.id === itemId ? { ...it, ...patch } : it) }
      : s))

  const deleteItem = (sectionId: string, itemId: string) =>
    mutate(secs => secs.map(s => s.id === sectionId
      ? { ...s, items: s.items.filter(it => it.id !== itemId).map((it, i) => ({ ...it, position: i })) }
      : s))

  const moveItem = (sectionId: string, itemId: string, dir: 'up' | 'down') =>
    mutate(secs => secs.map(s => {
      if (s.id !== sectionId) return s
      const sorted = [...s.items].sort((a, b) => a.position - b.position)
      const idx = sorted.findIndex(it => it.id === itemId)
      const swap = dir === 'up' ? idx - 1 : idx + 1
      if (idx < 0 || swap < 0 || swap >= sorted.length) return s
      ;[sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]]
      return { ...s, items: sorted.map((it, i) => ({ ...it, position: i })) }
    }))

  /** Checkbox rapide : bascule qtyReady entre 0 et qtyEffective */
  const toggleItem = (sectionId: string, itemId: string) => {
    const nbJours = trip ? nbJoursOf(trip) : null
    return mutate(secs => secs.map(s => s.id === sectionId
      ? { ...s, items: s.items.map(it => {
          if (it.id !== itemId) return it
          const eff = qtyEffective(it, nbJours)
          return { ...it, qtyReady: it.qtyReady >= eff ? 0 : eff }
        }) }
      : s))
  }

  /** Définit qtyReady (borné à [0, qtyEffective]) */
  const setReady = (sectionId: string, itemId: string, qty: number) => {
    const nbJours = trip ? nbJoursOf(trip) : null
    return mutate(secs => secs.map(s => s.id === sectionId
      ? { ...s, items: s.items.map(it => {
          if (it.id !== itemId) return it
          const eff = qtyEffective(it, nbJours)
          return { ...it, qtyReady: Math.max(0, Math.min(eff, qty)) }
        }) }
      : s))
  }

  return {
    trip, loading,
    addSection, renameSection, deleteSection, moveSection,
    addItem, updateItem, deleteItem, moveItem, toggleItem, setReady,
  }
}
