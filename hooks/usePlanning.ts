import { useEffect, useState } from 'react'
import {
  collection, query, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { PlanningPro } from '@/types'

export function usePlanning() {
  const { currentUser, userProfile } = useAuth()
  const [plannings, setPlannings] = useState<PlanningPro[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return

    const q = query(
      collection(db, 'planning_pro'),
      orderBy('date_planning', 'asc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // LOG TEMPORAIRE
      snapshot.docs.forEach((d) => {
        const data = d.data()
        console.log('DOC:', d.id)
        console.log('  ref_users path:', data.ref_users?.path)
        console.log('  ref_client path:', data.ref_client?.path)
      })

      const all = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as PlanningPro[]

      const filtered = userProfile?.role_app === 'Admin'
        ? all
        : all.filter((p) => {
            const refPath: string = (p.ref_users as any)?.path || ''
            return refPath.includes(currentUser.uid)
          })

      setPlannings(filtered)
      setLoading(false)
    })

    return unsubscribe
  }, [currentUser, userProfile])

  const addPlanning = async (data: Omit<PlanningPro, 'id'>) => {
    await addDoc(collection(db, 'planning_pro'), data)
  }

  const updatePlanning = async (id: string, data: Partial<PlanningPro>) => {
    await updateDoc(doc(db, 'planning_pro', id), data)
  }

  const deletePlanning = async (id: string) => {
    await deleteDoc(doc(db, 'planning_pro', id))
  }

  return { plannings, loading, addPlanning, updatePlanning, deletePlanning }
}