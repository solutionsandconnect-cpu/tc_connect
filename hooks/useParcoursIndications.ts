import { useEffect, useState } from 'react'
import {
  collection, query,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ParcoursIndication } from '@/types'

export function useParcoursIndications() {
  const [indications, setIndications] = useState<ParcoursIndication[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'parcours_indications'))
    return onSnapshot(q,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ParcoursIndication[]
        // Tri par ordre manuel (croissant) ; les indications sans ordre passent en dernier,
        // départagées par date de début décroissante.
        arr.sort((a, b) => {
          const ao = a.ordre ?? Number.MAX_SAFE_INTEGER
          const bo = b.ordre ?? Number.MAX_SAFE_INTEGER
          if (ao !== bo) return ao - bo
          return (b.dateDebut?.toMillis() ?? 0) - (a.dateDebut?.toMillis() ?? 0)
        })
        setIndications(arr)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  const addIndication = (data: Omit<ParcoursIndication, 'id'>) =>
    addDoc(collection(db, 'parcours_indications'), data)
  const updateIndication = (id: string, data: Partial<ParcoursIndication>) =>
    updateDoc(doc(db, 'parcours_indications', id), data)
  const deleteIndication = (id: string) =>
    deleteDoc(doc(db, 'parcours_indications', id))
  // Réécrit l'ordre de toutes les indications selon la liste d'ids fournie
  const reorderIndications = async (orderedIds: string[]) => {
    const batch = writeBatch(db)
    orderedIds.forEach((id, idx) => batch.update(doc(db, 'parcours_indications', id), { ordre: idx }))
    await batch.commit()
  }

  return { indications, loading, addIndication, updateIndication, deleteIndication, reorderIndications }
}
