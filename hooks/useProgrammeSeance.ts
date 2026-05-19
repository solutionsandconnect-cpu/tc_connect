import { useEffect, useState } from 'react'
import {
  collection, query, where,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ProgrammeSeance } from '@/types'

export function useProgrammeSeance(seanceId?: string) {
  const [programme, setProgramme] = useState<ProgrammeSeance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!seanceId) {
      setProgramme([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, 'programme_seance'),
      where('ref_seance', '==', doc(db, 'seance', seanceId))
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProgramme(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ProgrammeSeance[])
      setLoading(false)
    })
    return unsubscribe
  }, [seanceId])

  const addExerciceToSeance = async (data: Omit<ProgrammeSeance, 'id'>) => {
    await addDoc(collection(db, 'programme_seance'), data)
  }

  const updateExerciceSeance = async (id: string, data: Partial<ProgrammeSeance>) => {
    await updateDoc(doc(db, 'programme_seance', id), data)
  }

  const removeExerciceFromSeance = async (id: string) => {
    await deleteDoc(doc(db, 'programme_seance', id))
  }

  return { programme, loading, addExerciceToSeance, updateExerciceSeance, removeExerciceFromSeance }
}