import {
  collection, query, where, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { SeanceEquipe } from '@/types'

const COL = 'seances_equipe'

export function listenSeancesEquipe(
  teamId: string,
  cb: (seances: SeanceEquipe[]) => void,
): () => void {
  const q = query(
    collection(db, COL),
    where('teamId', '==', teamId),
    orderBy('date', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SeanceEquipe)))
  })
}

export async function createSeanceEquipe(
  data: Omit<SeanceEquipe, 'id'>,
): Promise<string> {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
  const ref = await addDoc(collection(db, COL), clean)
  return ref.id
}

export async function updateSeanceEquipe(
  id: string,
  data: Partial<Omit<SeanceEquipe, 'id'>>,
): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: Timestamp.now() })
}

export async function deleteSeanceEquipe(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}

export async function submitHooper(
  seanceId: string,
  joueurId: string,
  hooper: {
    sommeil: number
    fatigue: number
    courbatures: number
    stress: number
    indiceHooper: number
  },
): Promise<void> {
  await updateDoc(doc(db, COL, seanceId), {
    [`hoopers.${joueurId}`]: {
      ...hooper,
      submittedAt: Timestamp.now(),
    },
    updatedAt: Timestamp.now(),
  })
}

export async function submitRPE(
  seanceId: string,
  joueurId: string,
  rpe: {
    rpe: number
    dureeMin: number
    charge: number
  },
): Promise<void> {
  await updateDoc(doc(db, COL, seanceId), {
    [`rpes.${joueurId}`]: {
      ...rpe,
      submittedAt: Timestamp.now(),
    },
    updatedAt: Timestamp.now(),
  })
}
