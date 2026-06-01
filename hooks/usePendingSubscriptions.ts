import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'

export function usePendingSubscriptions(): number {
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isAdmin) { setCount(0); return }
    const q = query(collection(db, 'store_subscriptions'), where('statut', '==', 'pending'))
    const unsub = onSnapshot(q, (snap) => setCount(snap.size), () => setCount(0))
    return unsub
  }, [isAdmin])

  return count
}
