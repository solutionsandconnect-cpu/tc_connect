import { useEffect, useState } from 'react'
import {
  collection, query, where,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { PilotageDocument } from '@/types'

export function usePilotageDocuments(contratId?: string) {
  const [documents, setDocuments] = useState<PilotageDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!contratId) { setDocuments([]); setLoading(false); return }
    setLoading(true)
    // Filtre par contrat ; tri côté client (évite un index composite)
    const q = query(collection(db, 'pilotage_documents'), where('contratId', '==', contratId))
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PilotageDocument[]
        list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
        setDocuments(list)
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [contratId])

  const addDocument = (data: Omit<PilotageDocument, 'id' | 'createdAt'>) =>
    addDoc(collection(db, 'pilotage_documents'), { ...data, createdAt: Timestamp.now() })

  const updateDocument = (id: string, data: Partial<PilotageDocument>) =>
    updateDoc(doc(db, 'pilotage_documents', id), { ...data, updatedAt: Timestamp.now() })

  const deleteDocument = (id: string) =>
    deleteDoc(doc(db, 'pilotage_documents', id))

  return { documents, loading, addDocument, updateDocument, deleteDocument }
}
