import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { NoteHistorique } from '@/types'

export function useClientNotes(clientId: string | undefined, linkedUserId: string | undefined) {
  const [cn, setCn] = useState<NoteHistorique[]>([])
  const [un, setUn] = useState<NoteHistorique[]>([])
  const [cnReady, setCnReady] = useState(false)
  const [unReady, setUnReady] = useState(!linkedUserId)

  useEffect(() => {
    if (!clientId) { setCn([]); setCnReady(true); return }
    return onSnapshot(
      query(collection(db, 'notes_historique'), where('ref_client', '==', clientId)),
      (snap) => {
        setCn(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NoteHistorique)))
        setCnReady(true)
      }
    )
  }, [clientId])

  useEffect(() => {
    if (!linkedUserId) { setUn([]); setUnReady(true); return }
    const userRef = doc(db, 'users', linkedUserId)
    return onSnapshot(
      query(collection(db, 'notes_historique'), where('ref_users', '==', userRef)),
      (snap) => {
        setUn(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NoteHistorique)))
        setUnReady(true)
      }
    )
  }, [linkedUserId])

  const loading = !cnReady || !unReady

  const notes: NoteHistorique[] = loading ? [] : (() => {
    const seen = new Set<string>()
    return [...cn, ...un]
      .filter((n) => { if (seen.has(n.id)) return false; seen.add(n.id); return true })
      .sort((a, b) => ((b.date_create as any)?.toMillis?.() ?? 0) - ((a.date_create as any)?.toMillis?.() ?? 0))
  })()

  const addNote = (data: Omit<NoteHistorique, 'id'>) => addDoc(collection(db, 'notes_historique'), data)
  const updateNote = (id: string, data: Partial<NoteHistorique>) => updateDoc(doc(db, 'notes_historique', id), data)
  const deleteNote = (id: string) => deleteDoc(doc(db, 'notes_historique', id))

  return { notes, loading, addNote, updateNote, deleteNote }
}
