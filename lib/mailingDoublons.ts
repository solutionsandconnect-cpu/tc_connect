// Rapprochement des fiches en double.
//
// Le cas d'usage : l'INSEE donne SIRET, effectif et activité mais JAMAIS
// d'email ; l'annuaire des artisans donne l'email mais aucune donnée officielle.
// La même entreprise arrive donc deux fois, chacune avec la moitié de ce qu'on
// veut. Ce module repère les paires ; c'est l'utilisateur qui tranche.
//
// Aucune fusion automatique, jamais : l'appariement automatique de
// l'enrichissement a déjà envoyé un artisan de Trédion à Fort-de-France.

import type { Prospect } from '@/types'

/** Formes juridiques et préfixes qui ne distinguent pas deux entreprises. */
const BRUIT = [
  'sarl', 'eurl', 'sas', 'sasu', 'sa', 'sci', 'scop', 'snc', 'ei', 'eirl',
  'ets', 'etablissements', 'etablissement', 'ste', 'societe', 'entreprise', 'entreprises',
  'monsieur', 'madame', 'mr', 'mme',
]

/**
 * Forme comparable d'une raison sociale : sans accents, sans ponctuation, sans
 * forme juridique. « SARL A.B. PLOMBERIE » et « AB Plomberie » deviennent
 * identiques — c'est exactement ce qu'on veut rapprocher.
 */
export function normaliserNom(brut: string): string {
  const sansAccent = (brut ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  const mots = sansAccent
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((m) => m && !BRUIT.includes(m))
  return mots.join(' ').trim()
}

/** Distance de Levenshtein, bornée en mémoire (deux lignes suffisent). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prec = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cour = [i]
    for (let j = 1; j <= b.length; j++) {
      cour[j] = Math.min(
        prec[j] + 1,
        cour[j - 1] + 1,
        prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prec = cour
  }
  return prec[b.length]
}

/** Score de ressemblance entre deux noms, de 0 à 100. */
export function scoreNom(a: string, b: string): number {
  const na = normaliserNom(a)
  const nb = normaliserNom(b)
  if (!na || !nb) return 0
  if (na === nb) return 100
  // Inclusion : « ab plomberie » vs « ab plomberie chauffage ». Fréquent, et
  // c'est bien la même entreprise dans l'immense majorité des cas.
  if (na.includes(nb) || nb.includes(na)) return 90
  const d = levenshtein(na, nb)
  const max = Math.max(na.length, nb.length)
  return Math.round((1 - d / max) * 100)
}

/** En dessous, le rapprochement produit trop de faux positifs pour être utile. */
export const SEUIL_DOUBLON = 82

export interface PaireDoublon {
  a: Prospect
  b: Prospect
  score: number
  motif: string
  /** Ce que la fusion ferait gagner — sert à trier les paires les plus utiles. */
  apport: string[]
  /** Paire déjà écartée à la main. Conservée pour pouvoir revenir sur sa décision. */
  ignoree: boolean
}

function apportDe(a: Prospect, b: Prospect): string[] {
  const out: string[] = []
  const emailA = !!a.email?.trim()
  const emailB = !!b.email?.trim()
  if (emailA !== emailB) out.push('email')
  if (!!a.siren !== !!b.siren) out.push('SIRET')
  if (!!a.effectifCode !== !!b.effectifCode) out.push('effectif')
  if (!!a.telephone?.trim() !== !!b.telephone?.trim()) out.push('téléphone')
  return out
}

/**
 * Paires candidates.
 *
 * Critères cumulés (choix de Teddy) : même code postal, même corps de métier,
 * nom proche. Le métier n'est exigé que si les DEUX fiches en ont un — un
 * prospect importé sans kit ne doit pas échapper au rapprochement.
 */
export function trouverDoublons(prospects: Prospect[]): PaireDoublon[] {
  const paires: PaireDoublon[] = []
  // Regroupement par code postal : évite de comparer 1072 fiches deux à deux.
  const parCp = new Map<string, Prospect[]>()
  for (const p of prospects) {
    const cp = p.codePostal?.trim()
    if (!cp) continue
    const l = parCp.get(cp) ?? []
    l.push(p)
    parCp.set(cp, l)
  }

  for (const liste of parCp.values()) {
    for (let i = 0; i < liste.length; i++) {
      for (let j = i + 1; j < liste.length; j++) {
        const a = liste[i]
        const b = liste[j]
        if (a.metierId && b.metierId && a.metierId !== b.metierId) continue
        const score = scoreNom(a.societe, b.societe)
        if (score < SEUIL_DOUBLON) continue
        // Les paires écartées sont MARQUÉES, pas supprimées : « ce ne sont pas
        // les mêmes » se clique vite, à la chaîne, et doit rester révocable.
        const ignoree =
          !!a.doublonsIgnores?.includes(b.id) || !!b.doublonsIgnores?.includes(a.id)
        paires.push({
          a, b, score, ignoree,
          motif: `${a.codePostal} · nom ${score} %`,
          apport: apportDe(a, b),
        })
      }
    }
  }

  // Les paires qui apportent le plus (email + SIRET) d'abord, puis le score.
  return paires.sort((x, y) => y.apport.length - x.apport.length || y.score - x.score)
}

/**
 * Laquelle des deux fiches conserver ?
 * Celle qui porte l'email : elle a le jeton de désinscription et, le cas
 * échéant, l'historique d'envois rattaché. À défaut, la plus ancienne.
 */
export function fichePrincipale(a: Prospect, b: Prospect): { garde: Prospect; absorbe: Prospect } {
  const emailA = !!a.email?.trim()
  const emailB = !!b.email?.trim()
  if (emailA !== emailB) return emailA ? { garde: a, absorbe: b } : { garde: b, absorbe: a }
  const envA = a.nbEnvois ?? 0
  const envB = b.nbEnvois ?? 0
  if (envA !== envB) return envA > envB ? { garde: a, absorbe: b } : { garde: b, absorbe: a }
  const ta = a.createdAt?.toMillis?.() ?? 0
  const tb = b.createdAt?.toMillis?.() ?? 0
  return ta <= tb ? { garde: a, absorbe: b } : { garde: b, absorbe: a }
}
