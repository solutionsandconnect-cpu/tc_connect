import { useEffect, useState } from 'react'
import {
  collection, query, where,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc
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
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() })) as ProgrammeSeance[]
      items.sort((a, b) => (a.num_exercice ?? 0) - (b.num_exercice ?? 0))
      setProgramme(items)
      setLoading(false)
    })
    return unsubscribe
  }, [seanceId])

  const addExerciceToSeance = async (data: Omit<ProgrammeSeance, 'id'>) => {
    const ref = await addDoc(collection(db, 'programme_seance'), data)
    // Maintain nb_exercice on the seance
    if (seanceId && data.num_exercice != null) {
      await updateDoc(doc(db, 'seance', seanceId), { nb_exercice: data.num_exercice })
    }
    return ref
  }

  const updateExerciceSeance = async (id: string, data: Partial<ProgrammeSeance>) => {
    await updateDoc(doc(db, 'programme_seance', id), data)
  }

  const removeExerciceFromSeance = async (id: string, newNbExercice: number) => {
    await deleteDoc(doc(db, 'programme_seance', id))
    if (seanceId) {
      await updateDoc(doc(db, 'seance', seanceId), { nb_exercice: newNbExercice })
    }
  }

  return { programme, loading, addExerciceToSeance, updateExerciceSeance, removeExerciceFromSeance }
}