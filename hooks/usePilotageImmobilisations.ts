import { useEffect, useState } from 'react'
import {
  collection, query, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { PilotageImmobilisation } from '@/types'

export function usePilotageImmobilisations() {
  const [items, setItems] = useState<PilotageImmobilisation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'pilotage_immobilisations'), orderBy('createdAt', 'desc'))
    return onSnapshot(q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PilotageImmobilisation[])
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  const addItem = (data: Omit<PilotageImmobilisation, 'id'>) =>
    addDoc(collection(db, 'pilotage_immobilisations'), data)
  const updateItem = (id: string, data: Partial<PilotageImmobilisation>) =>
    updateDoc(doc(db, 'pilotage_immobilisations', id), data)
  const deleteItem = (id: string) =>
    deleteDoc(doc(db, 'pilotage_immobilisations', id))

  return { items, loading, addItem, updateItem, deleteItem }
}
