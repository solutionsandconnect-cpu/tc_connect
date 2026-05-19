import { useEffect, useState } from 'react'
import {
  collection, query, where, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { Team } from '@/types'

export function useTeams() {
  const { currentUser } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    const q = query(
      collection(db, 'team'),
      where('userref', '==', doc(db, 'users', currentUser.uid)),
      orderBy('nom_equipe', 'asc')
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTeams(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Team[])
      setLoading(false)
    })
    return unsubscribe
  }, [currentUser])

  const addTeam = async (data: Omit<Team, 'id'>) => {
    await addDoc(collection(db, 'team'), data)
  }

  const updateTeam = async (id: string, data: Partial<Team>) => {
    await updateDoc(doc(db, 'team', id), data)
  }

  const deleteTeam = async (id: string) => {
    await deleteDoc(doc(db, 'team', id))
  }

  return { teams, loading, addTeam, updateTeam, deleteTeam }
}