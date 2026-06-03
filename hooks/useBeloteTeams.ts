'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { listenBeloteTeams, createBeloteTeam } from '@/lib/belote/firebase'
import type { BeloteTeam, BelotePlayer } from '@/lib/belote/types'

/** Liste des équipes de belote (temps réel) + création */
export function useBeloteTeams() {
  const { currentUser } = useAuth()
  const [teams, setTeams] = useState<BeloteTeam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) { setLoading(false); return }
    const unsub = listenBeloteTeams(currentUser.uid, (t) => {
      setTeams(t)
      setLoading(false)
    })
    return unsub
  }, [currentUser])

  const createTeam = (players: BelotePlayer[]) => {
    if (!currentUser) throw new Error('Non authentifié')
    return createBeloteTeam(players, currentUser.uid)
  }

  return { teams, loading, createTeam }
}
