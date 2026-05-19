import { useEffect, useState } from 'react'
import {
  collection, query, where, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { RPE } from '@/types'

export function useRPE(joueurId?: string) {
  const [rpeList, setRpeList] = useState<RPE[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const constraints: any[] = joueurId
      ? [
          where('joueurref', '==', doc(db, 'joueurs', joueurId)),
          orderBy('date', 'desc'),
        ]
      : [orderBy('date', 'desc')]

    const q = query(collection(db, 'rpe'), ...constraints)

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRpeList(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as RPE[])
      setLoading(false)
    })
    return unsubscribe
  }, [joueurId])

  const addRPE = async (data: Omit<RPE, 'id'>) => {
    await addDoc(collection(db, 'rpe'), data)
  }

  const updateRPE = async (id: string, data: Partial<RPE>) => {
    await updateDoc(doc(db, 'rpe', id), data)
  }

  const deleteRPE = async (id: string) => {
    await deleteDoc(doc(db, 'rpe', id))
  }

  return { rpeList, loading, addRPE, updateRPE, deleteRPE }
}