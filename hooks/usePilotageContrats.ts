import { useEffect, useState } from 'react'
import {
  collection, query, orderBy, where, getDocs, getDoc,
  onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { deleteImage } from '@/lib/uploadImage'
import type { PilotageContrat } from '@/types'

export function usePilotageContrats() {
  const [contrats, setContrats] = useState<PilotageContrat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'pilotage_contrats'), orderBy('createdAt', 'desc'))
    return onSnapshot(
      q,
      (snap) => {
        setContrats(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PilotageContrat[])
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [])

  const addContrat = (data: Omit<PilotageContrat, 'id' | 'createdAt'>) =>
    addDoc(collection(db, 'pilotage_contrats'), { ...data, createdAt: Timestamp.now() })

  const updateContrat = (id: string, data: Partial<PilotageContrat>) =>
    updateDoc(doc(db, 'pilotage_contrats', id), { ...data, updatedAt: Timestamp.now() })

  // Supprime le contrat ET ses documents reliés (collection séparée pilotage_documents) + les images de signature (Storage).
  // Le contenu projet (tâches, planning…) et les mentions légales sont des champs du contrat → supprimés avec lui.
  const deleteContrat = async (id: string) => {
    const docsSnap = await getDocs(query(collection(db, 'pilotage_documents'), where('contratId', '==', id)))
    // Signatures + PDF générés dans Storage (deleteImage ignore les erreurs / fichiers déjà absents)
    await Promise.all(docsSnap.docs.flatMap((d) => {
      const data = d.data() as { signatureUrl?: string; pdfUrl?: string }
      return [data.signatureUrl, data.pdfUrl].filter(Boolean).map((u) => deleteImage(u as string))
    }))
    // Logo + autres fichiers de la charte dans Storage
    const contratSnap = await getDoc(doc(db, 'pilotage_contrats', id))
    const charte = (contratSnap.data()?.charte ?? {}) as { logo?: { url?: string }; fichiers?: { url?: string }[] }
    const urls = [charte.logo?.url, ...(charte.fichiers ?? []).map((f) => f.url)].filter(Boolean) as string[]
    await Promise.all(urls.map((u) => deleteImage(u)))
    await Promise.all(docsSnap.docs.map((d) => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'pilotage_contrats', id))
  }

  return { contrats, loading, addContrat, updateContrat, deleteContrat }
}
