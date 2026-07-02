import { useEffect, useState } from 'react'
import {
  collection, query, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface MesApp {
  id: string
  nom: string
  url: string
  client?: string
  description?: string
  tags?: string[]
  actif?: boolean
  ordre?: number
  date_create?: any
}

export function useMesApps() {
  const [apps, setApps] = useState<MesApp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'mes_apps'), orderBy('ordre', 'asc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setApps(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as MesApp[])
        setLoading(false)
      },
      // Fallback si le champ `ordre` manque sur d'anciens docs : on débloque quand même.
      () => setLoading(false)
    )
    return unsubscribe
  }, [])

  const addApp = async (data: Omit<MesApp, 'id'>) => {
    await addDoc(collection(db, 'mes_apps'), data)
  }

  const updateApp = async (id: string, data: Partial<MesApp>) => {
    await updateDoc(doc(db, 'mes_apps', id), data)
  }

  const deleteApp = async (id: string) => {
    await deleteDoc(doc(db, 'mes_apps', id))
  }

  return { apps, loading, addApp, updateApp, deleteApp }
}
