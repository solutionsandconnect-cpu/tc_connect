import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Abonnement } from '@/types'

export function useAbonnementsByClientId(clientId?: string) {
  const [abonnements, setAbonnements] = useState<Abonnement[]>([])

  useEffect(() => {
    if (!clientId) { setAbonnements([]); return }
    getDocs(query(collection(db, 'abonnements'), where('clientId', '==', clientId)))
      .then((snap) => {
        setAbonnements(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Abonnement))
            .sort((a, b) => (a.dateDebut?.toMillis?.() ?? 0) - (b.dateDebut?.toMillis?.() ?? 0))
        )
      })
      .catch(() => setAbonnements([]))
  }, [clientId])

  return { abonnements }
}
