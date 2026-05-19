import { useEffect, useState } from 'react'
import {
  collection, query, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { NoteHistorique } from '@/types'

export function useNotes() {
  const [notes, setNotes] = useState<NoteHistorique[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'notes_historique'),
      orderBy('date_create', 'desc')
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as NoteHistorique[])
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const addNote = async (data: Omit<NoteHistorique, 'id'>) => {
    await addDoc(collection(db, 'notes_historique'), data)
  }

  const updateNote = async (id: string, data: Partial<NoteHistorique>) => {
    await updateDoc(doc(db, 'notes_historique', id), data)
  }

  const deleteNote = async (id: string) => {
    await deleteDoc(doc(db, 'notes_historique', id))
  }

  return { notes, loading, addNote, updateNote, deleteNote }
}