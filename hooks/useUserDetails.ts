import { useEffect, useState } from 'react'
import {
  collection, query, where,
  onSnapshot, doc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface UserDetails {
  id: string
  titre_abo: string
  categorie_prestation: string
  type_suivi: string
  etat: string
  refUsers: string
}

export function useUserDetails(userId?: string) {
  const [details, setDetails] = useState<UserDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setDetails([])
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'database_users_details'),
      where('refUsers', '==', doc(db, 'users', userId))
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDetails(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as UserDetails[])
      setLoading(false)
    })

    return unsubscribe
  }, [userId])

  return { details, loading }
}