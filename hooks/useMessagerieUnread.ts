import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'

export function useMessagerieUnread(): number {
  const { currentUser } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!currentUser) {
      setCount(0)
      return
    }

    const uid = currentUser.uid
    const userRef = doc(db, 'usersapp', uid)

    // Tracks counts from 3 listeners
    const counts = { groupe: 0, expediteur: 0, destinataire: 0 }

    const update = () => {
      setCount(counts.groupe + counts.expediteur + counts.destinataire)
    }

    // Nouveau format : non_lus_ids array-contains uid
    const qGroupe = query(
      collection(db, 'messagerie'),
      where('non_lus_ids', 'array-contains', uid)
    )
    const unsubGroupe = onSnapshot(qGroupe, (snap) => {
      counts.groupe = snap.size
      update()
    }, () => {
      counts.groupe = 0
      update()
    })

    // Ancien format créateur non lu
    const qExpediteur = query(
      collection(db, 'messagerie'),
      where('user_create', '==', userRef),
      where('etat_message_expediteur', '==', false)
    )
    const unsubExpediteur = onSnapshot(qExpediteur, (snap) => {
      counts.expediteur = snap.size
      update()
    }, () => {
      counts.expediteur = 0
      update()
    })

    // Ancien format destinataire non lu
    const qDestinataire = query(
      collection(db, 'messagerie'),
      where('user_destinataire', '==', userRef),
      where('etat_message_destinataire', '==', false)
    )
    const unsubDestinataire = onSnapshot(qDestinataire, (snap) => {
      counts.destinataire = snap.size
      update()
    }, () => {
      counts.destinataire = 0
      update()
    })

    return () => {
      unsubGroupe()
      unsubExpediteur()
      unsubDestinataire()
    }
  }, [currentUser])

  return count
}
