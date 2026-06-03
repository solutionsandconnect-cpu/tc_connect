import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'

/**
 * Nombre de bons de commande (souscriptions à des apps payantes) créés depuis
 * la dernière consultation de la page "Documents". Sert à afficher une pastille.
 */
export function useUnseenDocuments(): number {
  const { currentUser, userProfile } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!currentUser) { setCount(0); return }
    const seenAt = (userProfile as any)?.documentsSeenAt?.toMillis?.() ?? 0
    const q = query(collection(db, 'store_subscriptions'), where('userUid', '==', currentUser.uid))
    return onSnapshot(
      q,
      (snap) => {
        const n = snap.docs.filter((d) => {
          const data = d.data() as any
          return (data.prix ?? 0) > 0 && (data.createdAt?.toMillis?.() ?? 0) > seenAt
        }).length
        setCount(n)
      },
      () => setCount(0)
    )
  }, [currentUser, userProfile])

  return count
}
