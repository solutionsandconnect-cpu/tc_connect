import { useEffect, useState } from 'react'
import {
  collection, query, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Exercice } from '@/types'

export function useExercices() {
  const [exercices, setExercices] = useState<Exercice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'exercices'), orderBy('nom_exercice', 'asc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExercices(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Exercice[])
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const addExercice = async (data: Omit<Exercice, 'id'>) => {
    return await addDoc(collection(db, 'exercices'), data)
  }

  const updateExercice = async (id: string, data: Partial<Exercice>) => {
    await updateDoc(doc(db, 'exercices', id), data)
  }

  const deleteExercice = async (id: string) => {
    await deleteDoc(doc(db, 'exercices', id))
  }

  return { exercices, loading, addExercice, updateExercice, deleteExercice }
}