'use client'

import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'

export interface Activite {
  id: string
  userId: string
  clientId: string
  type_activite: string
  date_activite: Timestamp
  heure_debut: string
  heure_fin: string
  distance_km?: number | null
  calories?: number | null
  notes?: string
  // Liaison avec une inscription Parcours Sportif (pour ajout/suppression auto au planning)
  registrationId?: string
  sessionId?: string
  source?: string
  date_create: Timestamp
}

export function useActivites(isAdmin = false) {
  const { currentUser } = useAuth()
  const [activites, setActivites] = useState<Activite[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    const q = isAdmin
      ? query(collection(db, 'activites_clients'))
      : query(collection(db, 'activites_clients'), where('userId', '==', currentUser.uid))
    const unsub = onSnapshot(q, (snap) => {
      setActivites(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Activite)))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [currentUser?.uid, isAdmin])

  const addActivite = async (data: Omit<Activite, 'id'>) => {
    const clean = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    )
    await addDoc(collection(db, 'activites_clients'), clean)
  }

  const updateActivite = async (
    id: string,
    data: Partial<Omit<Activite, 'id' | 'date_create' | 'userId'>>
  ) => {
    const clean = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    )
    await updateDoc(doc(db, 'activites_clients', id), clean)
  }

  const deleteActivite = async (id: string) => {
    await deleteDoc(doc(db, 'activites_clients', id))
  }

  return { activites, loading, addActivite, updateActivite, deleteActivite }
}
