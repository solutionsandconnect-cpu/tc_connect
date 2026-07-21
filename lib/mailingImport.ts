// Mailing — import de listes CSV.
//
// Reprend le rôle de la table `RecuperationMailing` (le sas d'import AppSheet)
// en y ajoutant ce qui manquait : contrôle du registre d'opposition AVANT
// insertion, et détection des doublons par société autant que par email.

import {
  emailDomain, isEmailGenerique, isEmailValide, normalizeEmail,
} from '@/lib/mailingModel'
import { normaliserSiret } from '@/lib/sirene'
import type { Prospect } from '@/types'
import type { NouveauProspect } from '@/lib/mailingService'

/* ------------------------------------------------------------------ */
/* Décodage                                                            */
/* ------------------------------------------------------------------ */

export type Encodage = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252'

export const LIBELLE_ENCODAGE: Record<Encodage, string> = {
  'utf-8': 'UTF-8',
  'utf-16le': 'UTF-16 (Excel « Texte Unicode »)',
  'utf-16be': 'UTF-16 gros-boutiste',
  'windows-1252': 'Windows-1252 (export Excel français)',
}

/**
 * Décode un fichier sans supposer son encodage.
 * L'export « CSV » par défaut d'Excel en français est en Windows-1252, pas en
 * UTF-8 : lu de force en UTF-8, « Pénestin » devient « PÃ©nestin » et le
 * charabia finit dans les mails envoyés. On tranche donc sur le contenu :
 * marque d'ordre des octets si elle existe, sinon UTF-8 STRICT — et son échec
 * est justement la preuve qu'on a affaire à du Windows-1252, où tout octet est
 * valide.
 */
export function decoderTexte(buf: ArrayBuffer): { texte: string; encodage: Encodage } {
  const o = new Uint8Array(buf)

  if (o.length >= 2 && o[0] === 0xff && o[1] === 0xfe) {
    return { texte: new TextDecoder('utf-16le').decode(buf), encodage: 'utf-16le' }
  }
  if (o.length >= 2 && o[0] === 0xfe && o[1] === 0xff) {
    return { texte: new TextDecoder('utf-16be').decode(buf), encodage: 'utf-16be' }
  }
  if (o.length >= 3 && o[0] === 0xef && o[1] === 0xbb && o[2] === 0xbf) {
    return { texte: new TextDecoder('utf-8').decode(buf), encodage: 'utf-8' }
  }

  try {
    return { texte: new TextDecoder('utf-8', { fatal: true }).decode(buf), encodage: 'utf-8' }
  } catch {
    return { texte: new TextDecoder('windows-1252').decode(buf), encodage: 'windows-1252' }
  }
}

/* ------------------------------------------------------------------ */
/* Lecture CSV                                                         */
/* ------------------------------------------------------------------ */

/** Devine le séparateur : Excel FR exporte en `;`, la plupart des outils en `,`. */
function detecterSeparateur(ligne: string): string {
  const candidats = [';', ',', '\t', '|']
  let meilleur = ';'
  let max = -1
  for (const c of candidats) {
    const n = ligne.split(c).length
    if (n > max) { max = n; meilleur = c }
  }
  return meilleur
}

/** Parseur CSV minimal mais correct : guillemets, `""` échappés, sauts de ligne. */
export function parseCsv(texte: string): string[][] {
  const src = texte.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const premiereLigne = src.slice(0, src.indexOf('\n') === -1 ? undefined : src.indexOf('\n'))
  const sep = detecterSeparateur(premiereLigne)

  const lignes: string[][] = []
  let champ = ''
  let ligne: string[] = []
  let dansGuillemets = false

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (dansGuillemets) {
      if (c === '"') {
        if (src[i + 1] === '"') { champ += '"'; i++ }
        else dansGuillemets = false
      } else champ += c
    } else if (c === '"') {
      dansGuillemets = true
    } else if (c === sep) {
      ligne.push(champ); champ = ''
    } else if (c === '\n') {
      ligne.push(champ); champ = ''
      if (ligne.some((v) => v.trim() !== '')) lignes.push(ligne)
      ligne = []
    } else {
      champ += c
    }
  }
  ligne.push(champ)
  if (ligne.some((v) => v.trim() !== '')) lignes.push(ligne)

  return lignes.map((l) => l.map((v) => v.trim()))
}

/* ------------------------------------------------------------------ */
/* Reconnaissance des colonnes                                         */
/* ------------------------------------------------------------------ */

export type ChampCible =
  | 'societe' | 'email' | 'telephone' | 'codePostal' | 'ville' | 'metier' | 'siret'
  | 'dateCreation' | 'dateEnvoi'

const ALIAS: Record<ChampCible, string[]> = {
  siret:        ['siret', 'siren', 'numero siret', 'n siret', 'siret siege'],
  dateCreation: ['date de la creation', 'date de creation', 'date creation', 'cree le', 'created at'],
  dateEnvoi:    ['date d envoi realise', 'date d envoi', 'date envoi', 'date d envoi realisee', 'envoye le', 'date du dernier envoi'],
  societe:    ['societe', 'société', 'nom de la societe', 'entreprise', 'raison sociale', 'nom', 'enseigne'],
  email:      ['email', 'mail', 'e-mail', 'courriel', 'adresse mail'],
  telephone:  ['telephone', 'téléphone', 'tel', 'tél', 'portable', 'mobile'],
  codePostal: ['cp', 'code postal', 'codepostal', 'zip'],
  ville:      ['ville', 'commune', 'localite', 'localité'],
  metier:     ['metier', 'métier', 'corps de metier', 'corps de métier', 'activite', 'activité', 'secteur'],
}

function normaliseEntete(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Analyse une date d'export français.
 * On ne passe JAMAIS par `new Date(chaîne)` : il interprète « 03/07/2026 » en
 * mm/jj à l'américaine et transformerait le 3 juillet en 7 mars.
 */
export function parseDateFr(v: string): Date | undefined {
  const s = (v ?? '').trim()
  if (!s) return undefined

  // `\d{4}` AVANT `\d{2}` : l'alternance est gourmande de gauche à droite, et
  // l'ordre inverse capturait « 20 » dans « 2026 » puis rendait l'année 2020.
  const fr = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})(?:\D+(\d{1,2}):(\d{2}))?/)
  if (fr) {
    const [, j, mo, y, h, mi] = fr
    let an = Number(y)
    if (an < 100) an += an < 70 ? 2000 : 1900
    const d = new Date(an, Number(mo) - 1, Number(j), Number(h ?? 0), Number(mi ?? 0))
    // Contrôle de cohérence : le 31/02 doit être rejeté, pas glissé au 3 mars.
    if (isNaN(d.getTime()) || d.getMonth() !== Number(mo) - 1 || d.getDate() !== Number(j)) return undefined
    return d
  }

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\D+(\d{1,2}):(\d{2}))?/)
  if (iso) {
    const [, y, mo, j, h, mi] = iso
    const d = new Date(Number(y), Number(mo) - 1, Number(j), Number(h ?? 0), Number(mi ?? 0))
    return isNaN(d.getTime()) ? undefined : d
  }

  return undefined
}

/** Associe chaque champ cible à l'index de colonne détecté (ou -1). */
export function detecterColonnes(entetes: string[]): Record<ChampCible, number> {
  const norm = entetes.map(normaliseEntete)
  const res = {} as Record<ChampCible, number>
  for (const champ of Object.keys(ALIAS) as ChampCible[]) {
    const alias = ALIAS[champ].map(normaliseEntete)
    res[champ] = norm.findIndex((h) => alias.includes(h))
  }
  return res
}

/* ------------------------------------------------------------------ */
/* Analyse                                                             */
/* ------------------------------------------------------------------ */

export type MotifRejet =
  | 'email_manquant'
  | 'email_invalide'
  | 'societe_manquante'
  | 'oppose'
  | 'societe_opposee'
  | 'doublon_fichier'
  | 'doublon_base'
  | 'doublon_societe'

export const LIBELLE_REJET: Record<MotifRejet, string> = {
  email_manquant:  'Email absent',
  email_invalide:  'Email mal formé',
  societe_manquante: 'Société absente',
  oppose:          "Opposition enregistrée — ne sera jamais réimporté",
  societe_opposee: "Un contact de cette société s'est opposé",
  doublon_fichier: 'En double dans le fichier',
  doublon_base:    'Déjà présent dans les prospects',
  doublon_societe: 'Même société déjà présente',
}

export interface LigneAnalysee {
  ligne: number
  brut: NouveauProspect
  rejet?: MotifRejet
  generique?: boolean
}

export interface RapportImport {
  retenues: LigneAnalysee[]
  rejetees: LigneAnalysee[]
  parMotif: Record<MotifRejet, number>
  total: number
}

/**
 * Analyse le CSV sans rien écrire.
 * Le rejet pour opposition est volontairement définitif et silencieux : c'est
 * ce qui garantit qu'un ré-import ne ressuscite jamais quelqu'un qui a demandé
 * à ne plus être contacté.
 */
export function analyserImport(
  lignes: string[][],
  colonnes: Record<ChampCible, number>,
  opts: {
    userId: string
    metierId?: string
    metierParDefaut?: string
    existants: Prospect[]
    optouts: Set<string>
  },
): RapportImport {
  const [, ...corps] = lignes
  const vus = new Set<string>()
  const societesVues = new Set<string>()

  const emailsExistants = new Set(opts.existants.map((p) => p.emailNormalise || normalizeEmail(p.email)))
  const societesExistantes = new Set(
    opts.existants.map((p) => (p.societe ?? '').trim().toLowerCase()).filter(Boolean),
  )

  // Les espaces internes multiples sont normalisés : « SAINT ETIENNE DE  MONTLUC »
  // s'affiche mal et fausse les comparaisons de doublon par société.
  const cell = (l: string[], i: number) =>
    i >= 0 && i < l.length ? l[i].replace(/\s+/g, ' ').trim() : ''

  // Pré-passe : sociétés dont au moins une adresse s'est opposée, dans le fichier
  // comme en base. Écrire à un collègue de quelqu'un qui vient de dire non est
  // précisément ce qui fait passer une prospection pour du spam — et le calcul
  // est fait avant la boucle pour ne pas dépendre de l'ordre des lignes du CSV.
  const societesOpposees = new Set<string>()
  for (const l of corps) {
    const e = normalizeEmail(cell(l, colonnes.email))
    const s = cell(l, colonnes.societe).trim().toLowerCase()
    if (s && e && opts.optouts.has(e)) societesOpposees.add(s)
  }
  for (const p of opts.existants) {
    const s = (p.societe ?? '').trim().toLowerCase()
    const e = p.emailNormalise || normalizeEmail(p.email)
    if (s && (p.statut === 'oppose' || opts.optouts.has(e))) societesOpposees.add(s)
  }

  const retenues: LigneAnalysee[] = []
  const rejetees: LigneAnalysee[] = []
  const parMotif = {
    email_manquant: 0, email_invalide: 0, societe_manquante: 0,
    oppose: 0, societe_opposee: 0, doublon_fichier: 0, doublon_base: 0, doublon_societe: 0,
  } as Record<MotifRejet, number>

  corps.forEach((l, idx) => {
    const email = cell(l, colonnes.email)
    const societe = cell(l, colonnes.societe)
    const norm = normalizeEmail(email)
    const soc = societe.trim().toLowerCase()

    const brut: NouveauProspect = {
      userId: opts.userId,
      societe,
      email: norm,
      telephone: cell(l, colonnes.telephone) || undefined,
      codePostal: cell(l, colonnes.codePostal) || undefined,
      ville: cell(l, colonnes.ville) || undefined,
      metier: cell(l, colonnes.metier) || opts.metierParDefaut || undefined,
      metierId: opts.metierId,
      siret: normaliserSiret(cell(l, colonnes.siret)) || undefined,
      // Historique repris de l'export : un prospect déjà contacté ne doit pas
      // repartir « à contacter », sinon le composeur le proposerait comme neuf
      // et le délai de relance serait remis à zéro.
      dateCreation: parseDateFr(cell(l, colonnes.dateCreation)),
      dateDernierEnvoi: parseDateFr(cell(l, colonnes.dateEnvoi)),
    }

    const item: LigneAnalysee = { ligne: idx + 2, brut, generique: !!norm && isEmailGenerique(norm) }

    let rejet: MotifRejet | undefined
    if (!norm) rejet = 'email_manquant'
    else if (!isEmailValide(norm)) rejet = 'email_invalide'
    else if (!societe) rejet = 'societe_manquante'
    else if (opts.optouts.has(norm)) rejet = 'oppose'
    else if (soc && societesOpposees.has(soc)) rejet = 'societe_opposee'
    else if (vus.has(norm)) rejet = 'doublon_fichier'
    else if (emailsExistants.has(norm)) rejet = 'doublon_base'
    else if (soc && (societesExistantes.has(soc) || societesVues.has(soc))) rejet = 'doublon_societe'

    if (rejet) {
      item.rejet = rejet
      parMotif[rejet]++
      rejetees.push(item)
    } else {
      vus.add(norm)
      if (soc) societesVues.add(soc)
      retenues.push(item)
    }
  })

  return { retenues, rejetees, parMotif, total: corps.length }
}

/** Petit utilitaire d'affichage : domaine dominant d'une liste (contrôle de cohérence). */
export function domaineMajoritaire(items: LigneAnalysee[]): string | null {
  const compte = new Map<string, number>()
  for (const it of items) {
    const d = emailDomain(it.brut.email)
    if (d) compte.set(d, (compte.get(d) ?? 0) + 1)
  }
  let best: string | null = null
  let max = 0
  for (const [d, n] of compte) if (n > max) { max = n; best = d }
  return max > items.length / 2 ? best : null
}
