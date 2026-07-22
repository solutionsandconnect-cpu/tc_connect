// Mailing — règles métier pures (aucune dépendance Firestore/React).
// Partagé entre le client (import, composeur) et le serveur (désinscription).

import { estCessee } from '@/lib/sirene'
import type { MailingMetier, MailingSection, Prospect, ProspectStatut } from '@/types'

/* ------------------------------------------------------------------ */
/* Libellés partagés                                                   */
/* ------------------------------------------------------------------ */

export const STATUT_LABEL: Record<ProspectStatut, string> = {
  a_contacter: 'À contacter',
  envoye: 'Envoyé',
  relance: 'Relancé',
  repondu: 'A répondu',
  interesse: 'Intéressé',
  converti: 'Devenu client',
  pas_interesse: 'Pas intéressé',
  a_un_logiciel: 'Déjà équipé',
  email_manquant: 'Email à trouver',
  oppose: 'Opposition',
  bounce: 'Adresse invalide',
  cessee: "N'existe plus",
}

/** Explication affichée en aide : ces états engagent des conséquences durables. */
export const STATUT_AIDE: Record<ProspectStatut, string> = {
  a_contacter: "Jamais sollicité.",
  envoye: "Premier message parti, en attente de réponse.",
  relance: "Relancé au moins une fois, toujours sans réponse.",
  repondu: "A répondu, sans que ce soit un oui : « rappelez-moi en septembre », une question, un accusé de réception.",
  interesse: "Réponse positive. C'est le moment de le promouvoir en client : la suite se joue dans le CRM, plus dans le mailing.",
  converti: "Rattaché à une fiche client : sa vie se poursuit dans le CRM. Terminus du parcours de prospection.",
  pas_interesse: "A répondu non. On ne le recontacte plus.",
  a_un_logiciel: "Déjà outillé. Pas une perte : c'est le profil qui a la douleur et le budget, à revoir quand son outil le freinera.",
  email_manquant: "Entreprise identifiée via l'INSEE, sans adresse email. À compléter sur la fiche avant tout envoi.",
  oppose: "A demandé à ne plus être contacté (droit d'opposition RGPD). Définitif : l'adresse rejoint le registre et ne peut plus jamais être réimportée.",
  bounce: "Le message est revenu en erreur : adresse inexistante, boîte pleine ou domaine mort. Technique, pas un refus.",
  cessee: "La société n'existe plus : radiée, liquidée, ou reprise sous un autre nom. À distinguer de l'état INSEE, qui n'est connu que pour les prospects enrichis — ici c'est ton constat, il fait foi.",
}

export const STATUT_STYLE: Record<ProspectStatut, string> = {
  a_contacter: 'bg-gray-100 text-gray-700',
  envoye: 'bg-blue-100 text-blue-700',
  relance: 'bg-indigo-100 text-indigo-700',
  repondu: 'bg-teal-100 text-teal-700',
  interesse: 'bg-green-100 text-green-700',
  converti: 'bg-emerald-600 text-white',
  pas_interesse: 'bg-amber-100 text-amber-700',
  a_un_logiciel: 'bg-purple-100 text-purple-700',
  email_manquant: 'bg-orange-100 text-orange-700',
  oppose: 'bg-red-100 text-red-700',
  bounce: 'bg-red-50 text-red-600',
  cessee: 'bg-slate-700 text-white',
}

/* ------------------------------------------------------------------ */
/* Garde-fous anti-spam                                                */
/* ------------------------------------------------------------------ */

/** Plafond d'envois par jour. Le volume est la première cause de dérive en spam. */
export const QUOTA_JOUR = 25

/** Délai minimum avant de relancer un prospect resté silencieux. */
export const DELAI_RELANCE_JOURS = 8

/** Nombre de relances autorisées. Au-delà, le prospect est laissé tranquille. */
export const MAX_RELANCES = 2

/** Longueur minimale de la ligne de personnalisation exigée avant envoi. */
export const MIN_PERSONNALISATION = 30

/** Nombre de thèmes retenus dans le mail par défaut (la brochure porte le détail). */
export const NB_THEMES_MAIL_DEFAUT = 3

/** Préfixes d'adresses génériques : joignables, mais moins bien ciblés. */
const PREFIXES_GENERIQUES = [
  'contact', 'info', 'infos', 'accueil', 'secretariat', 'secretariat',
  'admin', 'administration', 'commercial', 'devis', 'bonjour', 'hello',
  'direction', 'compta', 'comptabilite', 'service', 'sav', 'no-reply', 'noreply',
]

/**
 * Webmails et FAI grand public. Deux artisans en @gmail.com ne sont PAS
 * collègues : chez les TPE du bâtiment ces adresses sont majoritaires, donc
 * traiter le domaine comme un employeur ferait passer toute la base pour une
 * seule et même entreprise.
 */
const DOMAINES_GENERIQUES = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.fr', 'outlook.com',
  'outlook.fr', 'live.fr', 'live.com', 'msn.com', 'yahoo.com', 'yahoo.fr',
  'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'neuf.fr', 'laposte.net',
  'bbox.fr', 'aliceadsl.fr', 'numericable.fr', 'icloud.com', 'me.com',
  'protonmail.com', 'proton.me', 'gmx.fr', 'aol.com',
])

/** Un domaine d'email n'identifie une entreprise que s'il lui est propre. */
export function isDomaineEntreprise(domaine: string): boolean {
  const d = (domaine ?? '').trim().toLowerCase()
  return !!d && !DOMAINES_GENERIQUES.has(d)
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

/** Forme canonique d'un email : sert de clé de dédup ET de contrôle d'opposition. */
export function normalizeEmail(raw: string): string {
  return (raw ?? '').trim().toLowerCase()
}

/**
 * Identifiant de document Firestore dérivé d'un email.
 * On garde l'email lisible (registre d'opposition consultable à l'œil) en
 * neutralisant les caractères interdits dans un doc id.
 */
export function safeId(email: string): string {
  const norm = normalizeEmail(email)
  return norm.replace(/[^a-z0-9@._+-]/g, '_').slice(0, 400)
}

export function emailDomain(email: string): string {
  const norm = normalizeEmail(email)
  const at = norm.lastIndexOf('@')
  return at === -1 ? '' : norm.slice(at + 1)
}

/** Validation de forme, volontairement stricte : une liste importée est sale. */
export function isEmailValide(email: string): boolean {
  const norm = normalizeEmail(email)
  if (!norm || /\s/.test(norm)) return false
  return /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(norm)
}

/** Adresse de type contact@ / info@ : pas disqualifiante, mais à signaler. */
export function isEmailGenerique(email: string): boolean {
  const norm = normalizeEmail(email)
  const local = norm.split('@')[0] ?? ''
  return PREFIXES_GENERIQUES.includes(local)
}

/** Jeton de désinscription. */
export function makeToken(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  return uuid.replace(/-/g, '')
}

/* ------------------------------------------------------------------ */
/* Sélection des thèmes                                                */
/* ------------------------------------------------------------------ */

/**
 * Thèmes retenus pour le MAIL.
 * Le système AppSheet piochait via `ANY(...)`, qui renvoie un élément arbitraire
 * de la liste — et son champ « Important ou non » n'était jamais utilisé dans le
 * filtre. Ici l'ordre est déterministe : les sections importantes d'abord, puis
 * `ordre` croissant.
 */
export function sectionsPourMail(metier: MailingMetier): MailingSection[] {
  const n = metier.nbThemesMail ?? NB_THEMES_MAIL_DEFAUT
  return [...(metier.sections ?? [])]
    .filter((s) => s.afficher && s.problemeMail?.trim() && s.solutionMail?.trim())
    .sort((a, b) => Number(b.important) - Number(a.important) || a.ordre - b.ordre)
    .slice(0, Math.max(1, n))
}

/** Thèmes retenus pour la BROCHURE : tout ce qui est affiché, dans l'ordre. */
export function sectionsPourBrochure(metier: MailingMetier): MailingSection[] {
  return [...(metier.sections ?? [])]
    .filter((s) => s.afficher && (s.problemesBrochure?.length || s.solutionsBrochure?.length))
    .sort((a, b) => a.ordre - b.ordre)
}

/* ------------------------------------------------------------------ */
/* Éligibilité d'un prospect                                           */
/* ------------------------------------------------------------------ */

export type Blocage =
  | { ok: true }
  | { ok: false; raison: string }

/**
 * Peut-on écrire à ce prospect maintenant ?
 * `optouts` est l'ensemble des emails normalisés en opposition.
 */
export function peutContacter(
  p: Prospect,
  optouts: Set<string>,
  maintenant: Date = new Date(),
): Blocage {
  if (optouts.has(p.emailNormalise)) {
    return { ok: false, raison: "Ce contact s'est opposé à toute sollicitation." }
  }
  if (p.statut === 'oppose') {
    return { ok: false, raison: "Ce contact s'est opposé à toute sollicitation." }
  }
  if (p.statut === 'bounce') {
    return { ok: false, raison: 'Adresse invalide : le message est revenu en erreur.' }
  }
  if (p.statut === 'pas_interesse') {
    return { ok: false, raison: 'Ce contact a répondu ne pas être intéressé.' }
  }
  // Sortie du flux courant, mais pas un refus définitif : à revoir le jour où
  // son outil actuel le freine.
  if (p.statut === 'a_un_logiciel') {
    return {
      ok: false,
      raison: p.logicielActuel
        ? `Déjà équipé (${p.logicielActuel}).`
        : 'Déjà équipé d\'un logiciel.',
    }
  }
  if (p.statut === 'repondu') {
    return { ok: false, raison: 'Ce contact a déjà répondu — la conversation est engagée.' }
  }
  if (p.statut === 'interesse') {
    return { ok: false, raison: 'Contact intéressé — promeus-le en client, la suite est dans le CRM.' }
  }
  if (p.statut === 'converti') {
    return { ok: false, raison: 'Devenu client — la relation se suit dans le CRM.' }
  }
  // Constat de l'utilisateur : il prime sur tout, il a vérifié.
  if (p.statut === 'cessee') {
    return { ok: false, raison: "Cette société n'existe plus." }
  }
  // Donnée officielle INSEE : écrire à une société radiée est une perte sèche.
  // ⚠️ Deux codes possibles ('F' établissement, 'C' entreprise) : ne tester que
  // 'C' — ce que faisait ce garde-fou — laissait passer les 62 sociétés fermées.
  if (estCessee(p.etatEntreprise)) {
    return { ok: false, raison: 'Société cessée selon les données INSEE.' }
  }
  if (!p.email?.trim() || p.statut === 'email_manquant') {
    return { ok: false, raison: "Pas d'adresse email : complète la fiche avant d'envoyer." }
  }
  if (!isEmailValide(p.email)) {
    return { ok: false, raison: 'Adresse email invalide.' }
  }
  const relances = Math.max(0, (p.nbEnvois ?? 0) - 1)
  if (relances >= MAX_RELANCES) {
    return { ok: false, raison: `Déjà relancé ${MAX_RELANCES} fois sans réponse — on s'arrête là.` }
  }
  if (p.dernierEnvoiAt) {
    const dernier = p.dernierEnvoiAt.toDate()
    const jours = (maintenant.getTime() - dernier.getTime()) / 86_400_000
    if (jours < DELAI_RELANCE_JOURS) {
      const reste = Math.ceil(DELAI_RELANCE_JOURS - jours)
      return { ok: false, raison: `Dernier envoi il y a moins de ${DELAI_RELANCE_JOURS} jours (encore ${reste} j).` }
    }
  }
  return { ok: true }
}

/**
 * Une seule sollicitation par société : écrire à trois personnes de la même
 * boîte est le réflexe qui fait basculer une prospection en spam perçu.
 */
export function doublonSociete(p: Prospect, tous: Prospect[]): Prospect | null {
  // Le domaine ne vaut comme signal que s'il appartient à l'entreprise : un
  // webmail partagé (gmail, orange…) rapprocherait des sociétés étrangères.
  const domBrut = p.domaine || emailDomain(p.email)
  const dom = isDomaineEntreprise(domBrut) ? domBrut : ''
  const soc = (p.societe ?? '').trim().toLowerCase()
  return (
    tous.find(
      (autre) =>
        autre.id !== p.id &&
        (autre.nbEnvois ?? 0) > 0 &&
        ((dom && (autre.domaine || emailDomain(autre.email)) === dom) ||
          (soc && (autre.societe ?? '').trim().toLowerCase() === soc)),
    ) ?? null
  )
}
