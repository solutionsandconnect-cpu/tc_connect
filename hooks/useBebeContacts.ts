'use client'

import { useEffect, useState } from 'react'
import {
  collection, query, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { BebeContact } from '@/types'

export function useBebeContacts(babyId: string | null) {
  const [contacts, setContacts] = useState<BebeContact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!babyId) { setContacts([]); setLoading(false); return }
    const q = query(
      collection(db, 'babies', babyId, 'contacts'),
      orderBy('createdAt', 'asc'),
    )
    const unsub = onSnapshot(q, (snap) => {
      setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BebeContact)))
      setLoading(false)
    })
    return unsub
  }, [babyId])

  const addContact = (data: Omit<BebeContact, 'id' | 'createdAt'>) => {
    if (!babyId) return Promise.reject(new Error('Aucun bébé sélectionné'))
    return addDoc(collection(db, 'babies', babyId, 'contacts'), { ...data, createdAt: Timestamp.now() })
  }

  const updateContact = (contactId: string, data: Partial<Omit<BebeContact, 'id'>>) => {
    if (!babyId) return Promise.reject(new Error('Aucun bébé sélectionné'))
    return updateDoc(doc(db, 'babies', babyId, 'contacts', contactId), data)
  }

  const deleteContact = (contactId: string) => {
    if (!babyId) return Promise.reject(new Error('Aucun bébé sélectionné'))
    return deleteDoc(doc(db, 'babies', babyId, 'contacts', contactId))
  }

  return { contacts, loading, addContact, updateContact, deleteContact }
}
