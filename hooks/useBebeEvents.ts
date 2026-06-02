'use client'

import { useEffect, useState } from 'react'
import {
  collection, query, orderBy, limit,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { BebeEvent } from '@/types'

// Couvre ~3 semaines pour un bébé actif (~18 événements/jour)
const EVENTS_LIMIT = 400

export function useBebeEvents(babyId: string | null) {
  const [events, setEvents] = useState<BebeEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!babyId) { setEvents([]); setLoading(false); return }
    const q = query(
      collection(db, 'babies', babyId, 'events'),
      orderBy('timestamp', 'desc'),
      limit(EVENTS_LIMIT),
    )
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as BebeEvent)))
      setLoading(false)
    })
    return unsub
  }, [babyId])

  const addEvent = (data: Omit<BebeEvent, 'id'>) => {
    if (!babyId) return Promise.reject(new Error('Aucun bébé sélectionné'))
    return addDoc(collection(db, 'babies', babyId, 'events'), data)
  }

  const updateEvent = (eventId: string, data: Partial<Omit<BebeEvent, 'id'>>) => {
    if (!babyId) return Promise.reject(new Error('Aucun bébé sélectionné'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return updateDoc(doc(db, 'babies', babyId, 'events', eventId), data as any)
  }

  const deleteEvent = (eventId: string) => {
    if (!babyId) return Promise.reject(new Error('Aucun bébé sélectionné'))
    return deleteDoc(doc(db, 'babies', babyId, 'events', eventId))
  }

  return { events, loading, addEvent, updateEvent, deleteEvent }
}
