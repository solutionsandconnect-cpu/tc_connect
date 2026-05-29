import { useEffect, useState } from 'react'
import {
  collection, query, where,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { Seance } from '@/types'

export function useSeances(planningId?: string) {
  const { currentUser, userProfile } = useAuth()
  const [seances, setSeances] = useState<Seance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return

    const isAdmin = userProfile?.role_app === 'Admin'

    let q
    if (planningId) {
      q = query(collection(db, 'seance'), where('ref_planning', '==', doc(db, 'planning_pro', planningId)))
    } else if (isAdmin) {
      // Admins see all seances
      q = query(collection(db, 'seance'))
    } else {
      q = query(collection(db, 'seance'), where('ref_users', '==', doc(db, 'users', currentUser.uid)))
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSeances(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Seance[])
      setLoading(false)
    })
    return unsubscribe
  }, [currentUser, planningId, userProfile])

  const addSeance = async (data: Omit<Seance, 'id'>) => {
    return await addDoc(collection(db, 'seance'), data)
  }

  const updateSeance = async (id: string, data: Partial<Seance>) => {
    await updateDoc(doc(db, 'seance', id), data)
  }

  const deleteSeance = async (id: string) => {
    await deleteDoc(doc(db, 'seance', id))
  }

  return { seances, loading, addSeance, updateSeance, deleteSeance }
}