import { useEffect, useState } from 'react'
import { listenSeancesEquipe } from '@/lib/seanceEquipeService'
import type { SeanceEquipe } from '@/types'

export function useSeancesEquipe(teamId: string) {
  const [seances, setSeances] = useState<SeanceEquipe[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) {
      setSeances([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = listenSeancesEquipe(teamId, (data) => {
      setSeances(data)
      setLoading(false)
    })
    return unsub
  }, [teamId])

  return { seances, loading }
}
