import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Abonnement } from '@/types'

// Charge les abonnements depuis la collection "abonnements" pour un utilisateur donné
// via le chemin : userUid → clients.linkedUserId → clients.id → abonnements.clientId
export function useAbonnementsForUser(userUid?: string) {
  const [abonnements, setAbonnements] = useState<Abonnement[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userUid) { setAbonnements([]); return }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const clientsSnap = await getDocs(
          query(collection(db, 'clients'), where('linkedUserId', '==', userUid))
        )
        if (cancelled || clientsSnap.empty) { setAbonnements([]); return }
        const clientId = clientsSnap.docs[0].id
        const abosSnap = await getDocs(
          query(collection(db, 'abonnements'), where('clientId', '==', clientId))
        )
        if (!cancelled) {
          const abos = abosSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Abonnement))
            .sort((a, b) => (a.dateDebut?.toMillis?.() ?? 0) - (b.dateDebut?.toMillis?.() ?? 0))
          setAbonnements(abos)
        }
      } catch {
        if (!cancelled) setAbonnements([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [userUid])

  return { abonnements, loading }
}
