'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { listenTrips } from '@/lib/tripsService'
import type { Trip } from '@/types'

/** Liste des voyages de l'utilisateur (owned + shared) et ses modèles */
export function useTrips() {
  const { currentUser } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) { setLoading(false); return }
    const unsub = listenTrips(currentUser.uid, (t) => {
      setTrips(t)
      setLoading(false)
    })
    return unsub
  }, [currentUser])

  const nonTemplates = trips.filter(t => !t.isTemplate)
  return {
    trips,
    voyages: nonTemplates.filter(t => !t.archived),
    archived: nonTemplates.filter(t => t.archived),
    templates: trips.filter(t => t.isTemplate),
    loading,
  }
}
