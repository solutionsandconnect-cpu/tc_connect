import { useEffect, useState } from 'react'
import {
  collection, query, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ParcoursNote } from '@/types'

export function useParcoursNotes() {
  const [notes, setNotes] = useState<ParcoursNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'parcours_notes'), orderBy('date_create', 'desc'))
    return onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ParcoursNote[])
      setLoading(false)
    })
  }, [])

  const addNote = (data: Omit<ParcoursNote, 'id'>) =>
    addDoc(collection(db, 'parcours_notes'), data)
  const updateNote = (id: string, data: Partial<ParcoursNote>) =>
    updateDoc(doc(db, 'parcours_notes', id), data)
  const deleteNote = (id: string) =>
    deleteDoc(doc(db, 'parcours_notes', id))

  return { notes, loading, addNote, updateNote, deleteNote }
}
