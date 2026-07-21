// Mailing — accès Firestore côté client.
// Collections : prospects, mailing_metiers, mailing_envois, mailing_optout.

import { db } from '@/lib/firebase'
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDocs,
  onSnapshot, query, where, writeBatch, Timestamp,
} from 'firebase/firestore'
import { cleanForFirestore } from '@/lib/firebaseUtils'
import { emailDomain, makeToken, normalizeEmail, safeId } from '@/lib/mailingModel'
import type { InfoEntreprise } from '@/lib/sirene'
import type {
  Client, MailingEnvoi, MailingEvenement, MailingLogiciel, MailingMetier, MailingOptout,
  Prospect, ProspectStatut,
} from '@/types'

const prospectsCol = () => collection(db, 'prospects')
const metiersCol = () => collection(db, 'mailing_metiers')
const envoisCol = () => collection(db, 'mailing_envois')
const optoutCol = () => collection(db, 'mailing_optout')
const evenementsCol = () => collection(db, 'mailing_evenements')

/* ------------------------------------------------------------------ */
/* Kits métier                                                         */
/* ------------------------------------------------------------------ */

export const listenMetiers = (userId: string, cb: (m: MailingMetier[]) => void) => {
  const q = query(metiersCol(), where('userId', '==', userId))
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MailingMetier))
    data.sort((a, b) => (a.metier ?? '').localeCompare(b.metier ?? ''))
    cb(data)
  })
}

export const createMetier = async (
  data: Omit<MailingMetier, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<{ id: string }> => {
  const ref = await addDoc(metiersCol(), {
    ...cleanForFirestore(data as unknown as Record<string, unknown>),
    // Posés hors de cleanForFirestore, qui retire les chaînes vides : un kit
    // neuf doit exister avec des champs vides plutôt qu'absents, sinon les
    // inputs de l'éditeur démarrent non contrôlés.
    objet: data.objet ?? '',
    problematiques: data.problematiques ?? '',
    sections: data.sections ?? [],
    createdAt: Timestamp.now(),
  })
  return { id: ref.id }
}

export const updateMetier = async (id: string, data: Partial<MailingMetier>): Promise<void> => {
  const payload: Record<string, unknown> = {
    ...cleanForFirestore(data as unknown as Record<string, unknown>),
    updatedAt: Timestamp.now(),
  }
  // cleanForFirestore retire les chaînes vides : sans ce rattrapage, vider un
  // champ dans l'éditeur ne l'effacerait pas en base — l'ancienne valeur
  // resterait. On réinjecte donc tout ce que l'appelant a explicitement fourni.
  if (data.sections !== undefined) payload.sections = data.sections
  if (data.objet !== undefined) payload.objet = data.objet
  if (data.problematiques !== undefined) payload.problematiques = data.problematiques
  if (data.codesNaf !== undefined) payload.codesNaf = data.codesNaf
  await updateDoc(doc(db, 'mailing_metiers', id), payload)
}

export const deleteMetier = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'mailing_metiers', id))
}

/* ------------------------------------------------------------------ */
/* Prospects                                                           */
/* ------------------------------------------------------------------ */

export const listenProspects = (userId: string, cb: (p: Prospect[]) => void) => {
  const q = query(prospectsCol(), where('userId', '==', userId))
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Prospect))
    data.sort((a, b) => (a.societe ?? '').localeCompare(b.societe ?? ''))
    cb(data)
  })
}

export type NouveauProspect = Omit<
  Prospect,
  'id' | 'createdAt' | 'updatedAt' | 'emailNormalise' | 'domaine' | 'optoutToken' | 'statut'
  | 'dernierEnvoiAt' | 'nbEnvois'
> & {
  statut?: ProspectStatut
  /** Dates reprises d'un import, pour conserver l'historique existant. */
  dateCreation?: Date
  dateDernierEnvoi?: Date
}

/**
 * Construit le document Firestore d'un prospect.
 * Les deux dates d'import sont retirées de la charge utile : ce sont des
 * paramètres de construction, pas des champs de `Prospect`.
 */
function docProspect(data: NouveauProspect): Record<string, unknown> {
  const { dateCreation, dateDernierEnvoi, ...champs } = data
  const envoye = !!dateDernierEnvoi
  return {
    ...cleanForFirestore(champs as unknown as Record<string, unknown>),
    emailNormalise: normalizeEmail(data.email),
    domaine: emailDomain(data.email),
    optoutToken: makeToken(),
    // Un prospect importé avec une date d'envoi est déjà contacté : le laisser
    // « à contacter » le ferait ressortir comme neuf dans le composeur et
    // remettrait le délai de relance à zéro.
    statut: data.statut ?? (envoye ? 'envoye' : 'a_contacter'),
    nbEnvois: envoye ? 1 : 0,
    ...(dateDernierEnvoi ? { dernierEnvoiAt: Timestamp.fromDate(dateDernierEnvoi) } : {}),
    createdAt: dateCreation ? Timestamp.fromDate(dateCreation) : Timestamp.now(),
  }
}

export const createProspect = async (data: NouveauProspect): Promise<{ id: string }> => {
  const ref = await addDoc(prospectsCol(), docProspect(data))
  return { id: ref.id }
}

/** Import de liste : écriture par lots de 400 (limite Firestore : 500 opérations). */
export const createProspectsBatch = async (items: NouveauProspect[]): Promise<number> => {
  let total = 0
  for (let i = 0; i < items.length; i += 400) {
    const lot = items.slice(i, i + 400)
    const batch = writeBatch(db)
    for (const item of lot) batch.set(doc(prospectsCol()), docProspect(item))
    await batch.commit()
    total += lot.length
  }
  return total
}

export const updateProspect = async (id: string, data: Partial<Prospect>): Promise<void> => {
  const payload: Record<string, unknown> = {
    ...cleanForFirestore(data as unknown as Record<string, unknown>),
    updatedAt: Timestamp.now(),
  }
  // cleanForFirestore retire les chaînes vides : sans ce rattrapage, vider un
  // champ dans le formulaire ne l'effacerait pas — l'ancienne valeur resterait
  // en base. On réinjecte donc tout ce que l'appelant a explicitement fourni.
  for (const [cle, valeur] of Object.entries(data)) {
    if (valeur === '') payload[cle] = ''
  }
  if (data.email !== undefined) {
    payload.emailNormalise = normalizeEmail(data.email)
    payload.domaine = emailDomain(data.email)
  }
  await updateDoc(doc(db, 'prospects', id), payload)
}

export const deleteProspect = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'prospects', id))
}

/* ------------------------------------------------------------------ */
/* Référentiel des logiciels concurrents                               */
/* ------------------------------------------------------------------ */

export const listenLogiciels = (userId: string, cb: (l: MailingLogiciel[]) => void) => {
  const q = query(collection(db, 'mailing_logiciels'), where('userId', '==', userId))
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MailingLogiciel))
    data.sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? ''))
    cb(data)
  })
}

export const ajouterLogiciel = async (userId: string, nom: string): Promise<void> => {
  await addDoc(collection(db, 'mailing_logiciels'), {
    userId, nom: nom.trim(), createdAt: Timestamp.now(),
  })
}

/**
 * Retire un logiciel du référentiel.
 * Les prospects qui le mentionnent gardent leur valeur : on ne réécrit pas
 * l'historique parce qu'on nettoie une liste de choix.
 */
export const supprimerLogiciel = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'mailing_logiciels', id))
}

/* ------------------------------------------------------------------ */
/* Enrichissement SIRET                                                */
/* ------------------------------------------------------------------ */

/**
 * Applique à un prospect les données officielles tirées de son SIRET.
 * Les champs saisis à la main (ville, code postal) ne sont complétés que s'ils
 * sont vides : l'API ne doit pas écraser une correction faite par l'utilisateur.
 */
export const appliquerEnrichissement = async (
  prospect: Prospect,
  info: InfoEntreprise,
): Promise<void> => {
  const patch: Partial<Prospect> = {
    siren: info.siren,
    effectifCode: info.effectifCode,
    effectifAnnee: info.effectifAnnee,
    effectifDeLEntreprise: info.effectifDeLEntreprise,
    activiteNaf: info.activiteNaf,
    etatEntreprise: info.etat,
    enrichiAt: Timestamp.now(),
  }
  if (info.siret) patch.siret = info.siret
  if (!prospect.ville?.trim() && info.ville) patch.ville = info.ville
  if (!prospect.codePostal?.trim() && info.codePostal) patch.codePostal = info.codePostal

  await updateDoc(doc(db, 'prospects', prospect.id), {
    ...cleanForFirestore(patch as Record<string, unknown>),
    // Booléen envoyé brut : cleanForFirestore ne filtre pas `false`, mais on
    // reste explicite pour que le champ puisse repasser à false.
    effectifDeLEntreprise: info.effectifDeLEntreprise,
    updatedAt: Timestamp.now(),
  })
}

/* ------------------------------------------------------------------ */
/* Registre d'opposition                                               */
/* ------------------------------------------------------------------ */

/**
 * Le registre est GLOBAL et vit hors de `prospects` : supprimer un prospect ou
 * réimporter une liste ne doit jamais faire réapparaître quelqu'un qui s'est
 * opposé. C'est le garde-fou principal de tout l'outil.
 */
export const listenOptouts = (cb: (emails: Set<string>, docs: MailingOptout[]) => void) =>
  onSnapshot(optoutCol(), (snap) => {
    const docsList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MailingOptout))
    cb(new Set(docsList.map((o) => normalizeEmail(o.email))), docsList)
  })

export const chargerOptouts = async (): Promise<Set<string>> => {
  const snap = await getDocs(optoutCol())
  return new Set(snap.docs.map((d) => normalizeEmail((d.data() as MailingOptout).email)))
}

export const ajouterOptout = async (
  email: string,
  origine: MailingOptout['origine'],
  prospectId?: string,
): Promise<void> => {
  const norm = normalizeEmail(email)
  await setDoc(
    doc(db, 'mailing_optout', safeId(norm)),
    cleanForFirestore({ email: norm, origine, prospectId, createdAt: Timestamp.now() }),
    { merge: true },
  )
}

/* ------------------------------------------------------------------ */
/* Journal du parcours                                                 */
/* ------------------------------------------------------------------ */

export const listenEvenements = (userId: string, cb: (e: MailingEvenement[]) => void) => {
  const q = query(evenementsCol(), where('userId', '==', userId))
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MailingEvenement))
    data.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
    cb(data)
  })
}

/** Jours entiers écoulés depuis le dernier envoi, ou undefined si jamais contacté. */
function delaiDepuis(prospect: Prospect): number | undefined {
  if (!prospect.dernierEnvoiAt) return undefined
  const ms = Date.now() - prospect.dernierEnvoiAt.toDate().getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}

/**
 * Consigne un événement. Le délai depuis le dernier envoi est figé À L'ÉCRITURE :
 * recalculé plus tard il donnerait l'âge de l'envoi, pas le délai de réponse.
 */
export const journaliser = async (
  prospect: Prospect,
  evt: Pick<MailingEvenement, 'type'> &
    Partial<Pick<MailingEvenement, 'statutAvant' | 'statutApres' | 'observations'>>,
): Promise<void> => {
  await addDoc(evenementsCol(), {
    ...cleanForFirestore({
      userId: prospect.userId,
      prospectId: prospect.id,
      societe: prospect.societe,
      metier: prospect.metier,
      delaiDepuisEnvoi: delaiDepuis(prospect),
      ...evt,
    } as Record<string, unknown>),
    createdAt: Timestamp.now(),
  })
}

/**
 * Modifie une note du journal.
 * Réservé au type 'note' : les règles Firestore refusent la même opération sur
 * un envoi ou un changement de statut, et c'est volontaire.
 */
export const modifierNote = async (id: string, observations: string): Promise<void> => {
  await updateDoc(doc(db, 'mailing_evenements', id), {
    observations,
    modifieAt: Timestamp.now(),
  })
}

export const supprimerNote = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'mailing_evenements', id))
}

/* ------------------------------------------------------------------ */
/* Envois                                                              */
/* ------------------------------------------------------------------ */

export const listenEnvois = (userId: string, cb: (e: MailingEnvoi[]) => void) => {
  const q = query(envoisCol(), where('userId', '==', userId))
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MailingEnvoi))
    data.sort((a, b) => (b.envoyeAt?.toMillis() ?? 0) - (a.envoyeAt?.toMillis() ?? 0))
    cb(data)
  })
}

/**
 * Consigne un envoi : archive le corps FIGÉ puis met le prospect à jour.
 * Le snapshot est la raison d'être de cette collection — un mail archivé ne doit
 * jamais être recalculé depuis le kit courant.
 */
export const enregistrerEnvoi = async (
  envoi: Omit<MailingEnvoi, 'id' | 'envoyeAt'>,
  prospect: Prospect,
): Promise<void> => {
  const now = Timestamp.now()
  await addDoc(envoisCol(), {
    ...cleanForFirestore(envoi as unknown as Record<string, unknown>),
    envoyeAt: now,
  })
  // Journalisé AVANT la mise à jour : `delaiDepuisEnvoi` doit mesurer l'écart
  // avec l'envoi précédent, pas avec celui qu'on est en train de consigner.
  await journaliser(prospect, {
    type: 'envoi',
    statutAvant: prospect.statut,
    statutApres: (prospect.nbEnvois ?? 0) > 0 ? 'relance' : 'envoye',
  })
  await updateDoc(doc(db, 'prospects', prospect.id), {
    statut: (prospect.nbEnvois ?? 0) > 0 ? 'relance' : 'envoye',
    nbEnvois: (prospect.nbEnvois ?? 0) + 1,
    dernierEnvoiAt: now,
    updatedAt: now,
  })
}

/* ------------------------------------------------------------------ */
/* Promotion vers le CRM                                               */
/* ------------------------------------------------------------------ */

/**
 * Un prospect qui répond quitte le mailing et entre dans le CRM.
 * C'est la frontière du modèle : `prospects` porte le contact froid,
 * `clients` porte la relation engagée. Pas de double magasin.
 */
/**
 * Cherche un client existant correspondant au prospect.
 * L'email prime (c'est l'identité la plus fiable), puis le SIRET, puis la
 * raison sociale. Sans ce contrôle, promouvoir un prospect déjà client créait
 * un doublon dans la base clients.
 */
async function clientExistant(prospect: Prospect, userId: string): Promise<string | null> {
  const snap = await getDocs(query(collection(db, 'clients'), where('userId', '==', userId)))
  const email = normalizeEmail(prospect.email)
  const siret = (prospect.siret ?? '').replace(/\D/g, '')
  const soc = prospect.societe.trim().toLowerCase()

  for (const d of snap.docs) {
    const c = d.data() as Client
    if (email && normalizeEmail(c.email ?? '') === email) return d.id
    if (siret && (c.siret ?? '').replace(/\D/g, '') === siret) return d.id
  }
  for (const d of snap.docs) {
    const c = d.data() as Client
    const noms = [c.nomEntreprise, c.nom].map((n) => (n ?? '').trim().toLowerCase())
    if (soc && noms.includes(soc)) return d.id
  }
  return null
}

export const promouvoirEnClient = async (
  prospect: Prospect,
  userId: string,
): Promise<{ clientId: string; existant: boolean }> => {
  // Rattachement à la fiche existante plutôt que création d'un doublon.
  const dejaLa = await clientExistant(prospect, userId)
  if (dejaLa) {
    await journaliser(prospect, {
      type: 'promotion',
      statutAvant: prospect.statut,
      statutApres: 'repondu',
      observations: 'Rattaché à une fiche client existante.',
    })
    await updateDoc(doc(db, 'prospects', prospect.id), {
      statut: 'repondu' as ProspectStatut,
      clientId: dejaLa,
      updatedAt: Timestamp.now(),
    })
    return { clientId: dejaLa, existant: true }
  }

  const ref = await addDoc(collection(db, 'clients'), {
    ...cleanForFirestore({
      userId,
      nom: prospect.societe,
      nomEntreprise: prospect.societe,
      email: prospect.email,
      telephone: prospect.telephone,
      ville: prospect.ville,
      codePostal: prospect.codePostal,
      profession: prospect.metier,
      statut: 'Prospect',
      commentConnuCoach: prospect.origine ? `Prospection — ${prospect.origine}` : 'Prospection',
    } as Record<string, unknown>),
    // Posés hors de cleanForFirestore : il filtre les chaînes vides, or `prenom`
    // est requis côté Client et reste vide pour une société.
    prenom: '',
    marques: ['enezo'],
    pipelineStage: 'contacte' as Client['pipelineStage'],
    pipelineUpdatedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
  })
  await journaliser(prospect, {
    type: 'promotion',
    statutAvant: prospect.statut,
    statutApres: 'repondu',
    observations: 'Promu en client — suite dans le pipeline CRM.',
  })
  await updateDoc(doc(db, 'prospects', prospect.id), {
    statut: 'repondu' as ProspectStatut,
    clientId: ref.id,
    updatedAt: Timestamp.now(),
  })
  return { clientId: ref.id, existant: false }
}
