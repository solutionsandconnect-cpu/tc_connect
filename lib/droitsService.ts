import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Droits } from '@/types'

export async function updateDroits(userId: string, droits: Droits): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { droits })
}
