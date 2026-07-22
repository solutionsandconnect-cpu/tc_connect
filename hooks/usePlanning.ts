import { useEffect, useState } from 'react'
import {
  collection, query, orderBy, where,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { rdvVisiblePourClient } from '@/lib/planningAccess'
import type { PlanningPro } from '@/types'

export function usePlanning() {
  const { currentUser, userProfile } = useAuth()
  const [plannings, setPlannings] = useState<PlanningPro[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return

    const isAdmin = userProfile?.role_app === 'Admin'

    const q = isAdmin
      ? query(collection(db, 'planning_pro'), orderBy('date_planning', 'asc'))
      : query(
          collection(db, 'planning_pro'),
          where('ref_users', '==', doc(db, 'users', currentUser.uid)),
          orderBy('date_planning', 'asc')
        )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PlanningPro[]
      // Filtré ici plutôt que dans la requête : Firestore exigerait un index
      // composite, et un champ absent ne remonterait pas du tout — ce qui
      // masquerait les anciens RDV au lieu des seuls « Non calé ».
      setPlannings(isAdmin ? rows : rows.filter(rdvVisiblePourClient))
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
    // Supprimer les séances liées à ce RDV
    const planningRef = doc(db, 'planning_pro', id)
    const seancesSnap = await getDocs(query(collection(db, 'seance'), where('ref_planning', '==', planningRef)))
    await Promise.all(seancesSnap.docs.map((d) => deleteDoc(d.ref)))
    await deleteDoc(planningRef)
  }

  return { plannings, loading, addPlanning, updatePlanning, deletePlanning }
}