import { useEffect, useState } from 'react'
import {
  collection, query, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { PilotageContrat } from '@/types'

export function usePilotageContrats() {
  const [contrats, setContrats] = useState<PilotageContrat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'pilotage_contrats'), orderBy('createdAt', 'desc'))
    return onSnapshot(
      q,
      (snap) => {
        setContrats(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PilotageContrat[])
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [])

  const addContrat = (data: Omit<PilotageContrat, 'id' | 'createdAt'>) =>
    addDoc(collection(db, 'pilotage_contrats'), { ...data, createdAt: Timestamp.now() })

  const updateContrat = (id: string, data: Partial<PilotageContrat>) =>
    updateDoc(doc(db, 'pilotage_contrats', id), { ...data, updatedAt: Timestamp.now() })

  const deleteContrat = (id: string) =>
    deleteDoc(doc(db, 'pilotage_contrats', id))

  return { contrats, loading, addContrat, updateContrat, deleteContrat }
}
