import { useEffect, useState } from 'react'
import {
  collection, query, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { PilotageCatalogueItem } from '@/types'

export function usePilotageCatalogue() {
  const [items, setItems] = useState<PilotageCatalogueItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'pilotage_catalogue'), orderBy('createdAt', 'asc'))
    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PilotageCatalogueItem[])
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [])

  const addItem = (data: Omit<PilotageCatalogueItem, 'id' | 'createdAt'>) =>
    addDoc(collection(db, 'pilotage_catalogue'), { ...data, createdAt: Timestamp.now() })

  const updateItem = (id: string, data: Partial<PilotageCatalogueItem>) =>
    updateDoc(doc(db, 'pilotage_catalogue', id), data)

  const deleteItem = (id: string) =>
    deleteDoc(doc(db, 'pilotage_catalogue', id))

  return { items, loading, addItem, updateItem, deleteItem }
}
