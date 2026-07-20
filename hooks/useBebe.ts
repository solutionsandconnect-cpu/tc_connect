'use client'

import { useEffect, useState } from 'react'
import {
  collection, query, where, onSnapshot, getDocs,
  addDoc, updateDoc, deleteDoc, doc, writeBatch, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Bebe } from '@/types'

export function useBebe(uid: string | undefined) {
  const [babies, setBabies] = useState<Bebe[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    const q = query(collection(db, 'babies'), where('members', 'array-contains', uid))
    const unsub = onSnapshot(q, (snap) => {
      setBabies(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Bebe))
          .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0)),
      )
      setLoading(false)
    })
    return unsub
  }, [uid])

  const addBebe = (data: Omit<Bebe, 'id' | 'createdAt'>) =>
    addDoc(collection(db, 'babies'), { ...data, createdAt: Timestamp.now() })

  const updateBebe = (id: string, data: Partial<Omit<Bebe, 'id'>>) =>
    updateDoc(doc(db, 'babies', id), data)

  /** Supprime le bébé ET ses sous-collections (événements + contacts d'annonce) en cascade */
  const deleteBabeWithEvents = async (id: string) => {
    for (const sub of ['events', 'contacts']) {
      const snap = await getDocs(collection(db, 'babies', id, sub))
      if (snap.docs.length > 0) {
        const batch = writeBatch(db)
        snap.docs.forEach(d => batch.delete(d.ref))
        await batch.commit()
      }
    }
    await deleteDoc(doc(db, 'babies', id))
  }

  return { babies, loading, addBebe, updateBebe, deleteBabeWithEvents }
}
