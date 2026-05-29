/**
 * Supprime les champs undefined et string vides d'un objet avant écriture Firestore.
 * Firestore rejette les valeurs undefined avec une erreur.
 */
export function cleanForFirestore<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== "")
  ) as Partial<T>;
}
