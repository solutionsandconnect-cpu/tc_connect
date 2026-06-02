'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { listenBeloteGames } from '@/lib/belote/firebase'
import type { BeloteGame } from '@/lib/belote/types'

/** Liste de toutes les parties (temps réel), séparées en cours / terminées */
export function useBeloteGames() {
  const { currentUser } = useAuth()
  const [games, setGames] = useState<BeloteGame[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) { setLoading(false); return }
    const unsub = listenBeloteGames((g) => {
      setGames(g)
      setLoading(false)
    })
    return unsub
  }, [currentUser])

  return {
    games,
    inProgress: games.filter(g => g.status === 'in_progress'),
    finished: games.filter(g => g.status === 'finished'),
    loading,
  }
}
