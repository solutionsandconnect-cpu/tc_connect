import { db } from '@/lib/firebase'
import {
  collection, addDoc, getDocs, query, where, deleteDoc, doc, Timestamp,
} from 'firebase/firestore'

/** Formate une heure (Timestamp) en "HH:MM". */
function fmtHeure(ts?: Timestamp | null): string {
  if (!ts?.toDate) return ''
  return ts.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

interface SessionLike {
  date: Timestamp
  dateEnd?: Timestamp | null
  durationMinutes?: number
  title?: string
  locationLabel?: string
  location?: string
}

// Verrou en mémoire : empêche les appels concurrents (ex. React Strict Mode) de créer
// deux activités pour le même couple userId+sessionId avant que le premier write Firestore
// ne soit visible. Persiste au niveau module (survit aux remontages de composants).
const _inProgress = new Set<string>()

/**
 * Ajoute (sans doublon) une activité "Parcours Sportif" au planning de l'utilisateur,
 * liée à son inscription. Ne fait rien si l'utilisateur n'a pas de compte (userId vide).
 */
export async function addParcoursActivite(params: {
  userId: string | null | undefined
  registrationId: string
  sessionId: string
  session: SessionLike
}): Promise<void> {
  const { userId, registrationId, sessionId, session } = params
  if (!userId || !registrationId) return

  const key = `${userId}:${sessionId}`
  if (_inProgress.has(key)) return
  _inProgress.add(key)

  try {
    // Anti-doublon Firestore : vérifie par registrationId ET par sessionId+userId
    const [byRegId, bySession] = await Promise.all([
      getDocs(query(collection(db, 'activites_clients'), where('registrationId', '==', registrationId))),
      getDocs(query(collection(db, 'activites_clients'), where('sessionId', '==', sessionId), where('userId', '==', userId))),
    ])
    if (!byRegId.empty || !bySession.empty) return

    const heureDebut = fmtHeure(session.date)
    const heureFin = session.dateEnd
      ? fmtHeure(session.dateEnd)
      : session.durationMinutes
        ? fmtHeure(Timestamp.fromMillis(session.date.toMillis() + session.durationMinutes * 60 * 1000))
        : ''
    const lieu = session.locationLabel || session.location || ''

    await addDoc(collection(db, 'activites_clients'), {
      userId,
      clientId: '',
      type_activite: 'Parcours Sportif',
      date_activite: session.date,
      heure_debut: heureDebut,
      heure_fin: heureFin,
      notes: [session.title, lieu].filter(Boolean).join(' · '),
      registrationId,
      sessionId,
      source: 'parcours_sportif',
      date_create: Timestamp.now(),
    })
  } catch (e) {
    _inProgress.delete(key) // libère le verrou sur erreur pour permettre un retry
    console.error('[addParcoursActivite]', e)
  }
}

/** Supprime l'activité de planning liée à une inscription donnée. */
export async function removeParcoursActivite(registrationId: string): Promise<void> {
  if (!registrationId) return
  try {
    const snap = await getDocs(
      query(collection(db, 'activites_clients'), where('registrationId', '==', registrationId))
    )
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'activites_clients', d.id))))
  } catch (e) {
    console.error('[removeParcoursActivite]', e)
  }
}

/** Supprime toutes les activités de planning liées à une séance (annulation/suppression). */
export async function removeParcoursActivitesForSession(sessionId: string): Promise<void> {
  if (!sessionId) return
  try {
    const snap = await getDocs(
      query(collection(db, 'activites_clients'), where('sessionId', '==', sessionId))
    )
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'activites_clients', d.id))))
  } catch (e) {
    console.error('[removeParcoursActivitesForSession]', e)
  }
}
