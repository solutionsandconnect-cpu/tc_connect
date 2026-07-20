import { db } from '@/lib/firebase'
import {
  collection, query, where, getDocs, doc, deleteDoc, updateDoc, writeBatch, Timestamp, arrayUnion,
} from 'firebase/firestore'
import type { StoreApp, StoreSubscription } from '@/types'

/** Délai (en jours) après archivage avant suppression des données de l'utilisateur. */
export const ARCHIVE_CLEANUP_DAYS = 90

// ─── Configuration du nettoyage par app ─────────────────────────────────────────
//
// Pour brancher une app : ajouter une entrée { route → CleanupSpec }.
// La plupart des apps stockent leurs données dans UNE collection top-level avec un
// champ qui contient l'UID du propriétaire → il suffit de déclarer les deux ci-dessous.
// Les cas particuliers (ex. belote, dont les tours sont une collection séparée liée
// par un id de partie) passent par CUSTOM_CLEANUP.

interface CleanupSpec {
  /** Collection top-level contenant les documents de l'utilisateur. */
  collectionName: string
  /** Champ du document contenant l'UID du propriétaire (ex. 'createdBy', 'ownerId'). */
  ownerField: string
  /** Sous-collections à supprimer en cascade pour chaque document (optionnel). */
  subcollections?: string[]
}

/**
 * Registre déclaratif : route de l'app → quelles données supprimer.
 * Ajouter une nouvelle app = une seule ligne ici (aucune autre modification nécessaire).
 */
const CLEANUP_SPECS: Record<string, CleanupSpec> = {
  '/trips': { collectionName: 'trips', ownerField: 'ownerId' },
  // '/monitoring': { collectionName: '???', ownerField: '???' }, // à compléter (collection inconnue)
}

/** Cas particuliers ne rentrant pas dans le schéma déclaratif (données réparties sur plusieurs collections). */
const CUSTOM_CLEANUP: Record<string, (userUid: string) => Promise<void>> = {
  '/belote': cleanupBelote,
  '/equipes': cleanupEquipes,
  '/bebe': cleanupBebe,
}

// ─── Runner générique ───────────────────────────────────────────────────────────

/** Supprime tous les documents (et leurs sous-collections) appartenant à l'utilisateur. */
async function runCleanupSpec(spec: CleanupSpec, userUid: string): Promise<void> {
  const snap = await getDocs(query(collection(db, spec.collectionName), where(spec.ownerField, '==', userUid)))
  for (const d of snap.docs) {
    // Supprimer d'abord les sous-collections en cascade
    for (const subName of spec.subcollections ?? []) {
      const subSnap = await getDocs(collection(db, spec.collectionName, d.id, subName))
      if (subSnap.docs.length > 0) {
        const batch = writeBatch(db)
        subSnap.docs.forEach((s) => batch.delete(s.ref))
        await batch.commit()
      }
    }
    await deleteDoc(d.ref)
  }
}

/**
 * Nettoyage de l'app Bébé.
 *
 * Le bébé appartient à son PARENT PRINCIPAL (`createdBy`), qui en est l'administrateur :
 * quand son abonnement est purgé, le bébé et tout son historique sont supprimés, y compris
 * pour les co-parents invités (leur accès dépend de cet abonnement).
 * Si l'utilisateur purgé n'était lui-même qu'un co-parent invité sur le bébé d'un autre,
 * on retire seulement son accès — les données de l'autre parent ne sont pas touchées.
 */
async function cleanupBebe(userUid: string): Promise<void> {
  const snap = await getDocs(query(collection(db, 'babies'), where('members', 'array-contains', userUid)))
  for (const d of snap.docs) {
    const data = d.data() as { members?: string[]; createdBy?: string }

    // Bébé de quelqu'un d'autre → on retire juste cet accès
    if (data.createdBy && data.createdBy !== userUid) {
      await updateDoc(d.ref, { members: (data.members ?? []).filter((uid) => uid !== userUid) })
      continue
    }

    // Son bébé → suppression complète (events ET contacts)
    for (const subName of ['events', 'contacts']) {
      const subSnap = await getDocs(collection(db, 'babies', d.id, subName))
      if (subSnap.docs.length > 0) {
        const batch = writeBatch(db)
        subSnap.docs.forEach((s) => batch.delete(s.ref))
        await batch.commit()
      }
    }
    await deleteDoc(d.ref)
  }
}

/** Supprime les parties de belote créées par l'utilisateur, et leurs tours (collection séparée). */
async function cleanupBelote(userUid: string): Promise<void> {
  const gamesSnap = await getDocs(query(collection(db, 'belote_games'), where('createdBy', '==', userUid)))
  for (const g of gamesSnap.docs) {
    const roundsSnap = await getDocs(query(collection(db, 'belote_rounds'), where('gameId', '==', g.id)))
    const batch = writeBatch(db)
    roundsSnap.docs.forEach((r) => batch.delete(r.ref))
    batch.delete(g.ref)
    await batch.commit()
  }
}

/**
 * Supprime les données de l'app Équipe créées par l'utilisateur, en cascade :
 * team (userref) → joueurs (equiperef) → rpe (joueurref), + seances_equipe (teamId).
 */
async function cleanupEquipes(userUid: string): Promise<void> {
  const teamsSnap = await getDocs(query(collection(db, 'team'), where('userref', '==', doc(db, 'users', userUid))))
  for (const t of teamsSnap.docs) {
    // Joueurs de l'équipe + leurs RPE
    const joueursSnap = await getDocs(query(collection(db, 'joueurs'), where('equiperef', '==', doc(db, 'team', t.id))))
    for (const j of joueursSnap.docs) {
      const rpeSnap = await getDocs(query(collection(db, 'rpe'), where('joueurref', '==', doc(db, 'joueurs', j.id))))
      if (rpeSnap.docs.length > 0) {
        const rpeBatch = writeBatch(db)
        rpeSnap.docs.forEach((r) => rpeBatch.delete(r.ref))
        await rpeBatch.commit()
      }
    }
    // Séances d'équipe rattachées
    const seancesSnap = await getDocs(query(collection(db, 'seances_equipe'), where('teamId', '==', t.id)))
    const batch = writeBatch(db)
    joueursSnap.docs.forEach((j) => batch.delete(j.ref))
    seancesSnap.docs.forEach((s) => batch.delete(s.ref))
    batch.delete(t.ref)
    await batch.commit()
  }
}

/** Exécute le nettoyage adapté à une route d'app (spec déclaratif ou fonction custom). */
async function cleanupForRoute(route: string, userUid: string): Promise<void> {
  const custom = CUSTOM_CLEANUP[route]
  if (custom) return custom(userUid)
  const spec = CLEANUP_SPECS[route]
  if (spec) return runCleanupSpec(spec, userUid)
  // Pas de nettoyage défini pour cette app → rien à supprimer (on marquera quand même comme purgé).
}

// ─── Runner principal ───────────────────────────────────────────────────────────

/**
 * Supprime les données des abonnements archivés depuis plus de ARCHIVE_CLEANUP_DAYS jours
 * (puis marque l'abonnement comme purgé). Réservé aux contextes admin.
 */
export async function cleanupArchivedSubscriptions(
  subs: StoreSubscription[],
  apps: StoreApp[],
): Promise<void> {
  const cutoff = Date.now() - ARCHIVE_CLEANUP_DAYS * 24 * 60 * 60 * 1000
  // Normalise la route (tolère 'bebe' comme '/bebe')
  const routeOfApp = (appId: string): string | undefined => {
    const r = apps.find((a) => a.id === appId)?.route
    if (!r) return undefined
    return r.startsWith('/') ? r : `/${r}`
  }

  const toClean = subs.filter((s) =>
    s.statut === 'cancelled' &&
    !!s.userUid &&
    !s.dataCleanedAt &&
    !!s.archivedAt && ((s.archivedAt as any).toMillis?.() ?? 0) < cutoff
  )

  for (const s of toClean) {
    try {
      const route = routeOfApp(s.appId)
      if (route && s.userUid) await cleanupForRoute(route, s.userUid)
      // Marquer comme purgé (même si pas de nettoyage défini pour cette app → évite de re-tenter)
      await updateDoc(doc(db, 'store_subscriptions', s.id), {
        dataCleanedAt: Timestamp.now(),
        events: arrayUnion({ type: 'cleaned', date: Timestamp.now() }),
      })
    } catch (e) {
      console.error('[cleanupArchivedSubscriptions]', s.id, e)
    }
  }
}
