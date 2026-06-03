import { useEffect, useState } from 'react'
import {
  collection, query, where,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Joueur } from '@/types'

export function useJoueurs(teamId?: string) {
  const [joueurs, setJoueurs] = useState<Joueur[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) {
      setJoueurs([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, 'joueurs'),
      where('equiperef', '==', doc(db, 'team', teamId))
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setJoueurs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Joueur[])
      setLoading(false)
    })
    return unsubscribe
  }, [teamId])

  // Firestore refuse les valeurs `undefined` → on les retire avant écriture
  const stripUndefined = (data: Record<string, any>) =>
    Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))

  const addJoueur = async (data: Omit<Joueur, 'id'>) => {
    await addDoc(collection(db, 'joueurs'), stripUndefined(data as any))
  }

  const updateJoueur = async (id: string, data: Partial<Joueur>) => {
    await updateDoc(doc(db, 'joueurs', id), stripUndefined(data as any))
  }

  const deleteJoueur = async (id: string) => {
    await deleteDoc(doc(db, 'joueurs', id))
  }

  return { joueurs, loading, addJoueur, updateJoueur, deleteJoueur }
}