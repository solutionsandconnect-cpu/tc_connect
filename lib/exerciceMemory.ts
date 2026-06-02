import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'

/**
 * Mémoire par client + exercice : retient la dernière intensité et alerte
 * saisies pour un exercice donné chez un client donné, afin de les
 * pré-remplir automatiquement la prochaine fois que cet exercice est ajouté.
 *
 * Collection Firestore : exercice_memory/{clientId}_{exerciceId}
 */

export interface ExerciceMemory {
  intensite_exercice?: string
  alerte_exercice?: string
  raison_alerte_exercice?: string
}

const memoryDocId = (clientId: string, exerciceId: string) => `${clientId}_${exerciceId}`

export async function loadExerciceMemory(
  clientId: string | null | undefined,
  exerciceId: string | null | undefined,
): Promise<ExerciceMemory | null> {
  if (!clientId || !exerciceId) return null
  try {
    const snap = await getDoc(doc(db, 'exercice_memory', memoryDocId(clientId, exerciceId)))
    return snap.exists() ? (snap.data() as ExerciceMemory) : null
  } catch {
    return null
  }
}

export async function saveExerciceMemory(
  clientId: string | null | undefined,
  exerciceId: string | null | undefined,
  data: ExerciceMemory,
): Promise<void> {
  if (!clientId || !exerciceId) return
  try {
    await setDoc(
      doc(db, 'exercice_memory', memoryDocId(clientId, exerciceId)),
      {
        clientId,
        exerciceId,
        intensite_exercice: data.intensite_exercice ?? '',
        alerte_exercice: data.alerte_exercice ?? '',
        raison_alerte_exercice: data.raison_alerte_exercice ?? '',
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    )
  } catch {
    // Silencieux : la mémoire est un confort, pas un blocage
  }
}
