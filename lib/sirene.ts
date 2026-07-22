// Enrichissement d'un prospect depuis son SIRET.
//
// Source : « Recherche d'entreprises » (DINUM), API publique de l'État — sans
// clé ni inscription, et CORS ouvert, donc appelable directement du navigateur.
// https://recherche-entreprises.api.gouv.fr
//
// Deux limites structurelles à garder en tête (elles viennent de l'INSEE, pas
// de l'API) : l'effectif n'est publié qu'en TRANCHES, jamais en nombre exact ;
// et il est souvent absent au niveau de l'établissement, d'où le repli sur
// l'entreprise. On préfère afficher « non renseigné » plutôt qu'inventer.

const BASE = 'https://recherche-entreprises.api.gouv.fr/search'

/** Débit annoncé par l'API : 7 req/s. On reste en dessous. */
const DELAI_ENTRE_APPELS_MS = 180

/** Codes « tranche d'effectif salarié » de l'INSEE. */
export const TRANCHE_EFFECTIF: Record<string, string> = {
  NN: 'Non renseigné',
  '00': '0 salarié',
  '01': '1 ou 2 salariés',
  '02': '3 à 5 salariés',
  '03': '6 à 9 salariés',
  '11': '10 à 19 salariés',
  '12': '20 à 49 salariés',
  '21': '50 à 99 salariés',
  '22': '100 à 199 salariés',
  '31': '200 à 249 salariés',
  '32': '250 à 499 salariés',
  '41': '500 à 999 salariés',
  '42': '1 000 à 1 999 salariés',
  '51': '2 000 à 4 999 salariés',
  '52': '5 000 à 9 999 salariés',
  '53': '10 000 salariés et plus',
}

export function libelleEffectif(code?: string): string {
  if (!code) return 'Non renseigné'
  return TRANCHE_EFFECTIF[code] ?? `Code ${code}`
}

/** Ordre de grandeur, pour trier ou filtrer sans interpréter le code à la main. */
export function effectifMinimum(code?: string): number {
  const min: Record<string, number> = {
    '00': 0, '01': 1, '02': 3, '03': 6, '11': 10, '12': 20, '21': 50, '22': 100,
    '31': 200, '32': 250, '41': 500, '42': 1000, '51': 2000, '52': 5000, '53': 10000,
  }
  return code && code in min ? min[code] : -1
}

/**
 * Regroupement des 13 tranches INSEE en 5 paliers utiles à la prospection.
 *
 * Les tranches brutes sont trop fines (« 200 à 249 » ne concerne aucun artisan)
 * et feraient treize filtres illisibles. Ces paliers-ci correspondent à des
 * réalités d'organisation distinctes : le patron seul, la petite équipe où il
 * fait tout, la structure où quelqu'un commence à gérer, et celle qui a un poste
 * dédié à la planification.
 */
export const GROUPES_EFFECTIF = [
  { id: 'nc', label: 'Effectif inconnu' },
  { id: 'solo', label: 'Sans salarié' },
  { id: 'micro', label: '1 à 5 salariés' },
  { id: 'petite', label: '6 à 19 salariés' },
  { id: 'grande', label: '20 salariés et +' },
] as const

export type GroupeEffectif = (typeof GROUPES_EFFECTIF)[number]['id']

export function groupeEffectif(code?: string): GroupeEffectif {
  const min = effectifMinimum(code)
  if (min < 0) return 'nc'
  if (min === 0) return 'solo'
  if (min < 6) return 'micro'
  if (min < 20) return 'petite'
  return 'grande'
}

/**
 * L'entreprise a-t-elle cessé son activité ?
 *
 * ⚠️ Deux codes à tester, et c'est la source d'un bug resté invisible : l'API
 * renvoie l'état de l'ÉTABLISSEMENT quand il existe (`A` actif / `F` fermé) et
 * seulement sinon celui de l'ENTREPRISE (`A` / `C` cessée). Ne tester que `C`
 * — ce que faisait le code — laissait passer 62 sociétés fermées sur 547
 * enrichies, sans jamais afficher le badge.
 */
export function estCessee(etat?: string): boolean {
  return etat === 'C' || etat === 'F'
}

export function normaliserSiret(brut: string): string {
  return (brut ?? '').replace(/\D/g, '')
}

/** Un SIRET fait 14 chiffres, un SIREN 9. On accepte les deux. */
export function siretValide(brut: string): boolean {
  const n = normaliserSiret(brut)
  return n.length === 14 || n.length === 9
}

export interface InfoEntreprise {
  siren: string
  siret?: string
  nom: string
  /** Code INSEE de tranche d'effectif (voir TRANCHE_EFFECTIF). */
  effectifCode?: string
  effectifAnnee?: number
  /** true si l'effectif vient de l'entreprise faute de donnée d'établissement. */
  effectifDeLEntreprise: boolean
  activiteNaf?: string
  adresse?: string
  codePostal?: string
  ville?: string
  dateCreation?: string
  /** 'A' = active, 'C' = cessée. */
  etat?: string
  categorie?: string
}

interface ReponseEtab {
  siret?: string
  tranche_effectif_salarie?: string | null
  annee_tranche_effectif_salarie?: number | null
  adresse?: string
  code_postal?: string
  libelle_commune?: string
  etat_administratif?: string
}

interface ReponseEntreprise {
  siren?: string
  nom_complet?: string
  tranche_effectif_salarie?: string | null
  annee_tranche_effectif_salarie?: number | null
  activite_principale?: string
  date_creation?: string
  etat_administratif?: string
  categorie_entreprise?: string
  siege?: ReponseEtab
  matching_etablissements?: ReponseEtab[]
}

/** `NN` et la chaîne vide signifient « non renseigné » — à ne pas confondre avec 0. */
function effectifUtile(v?: string | null): string | undefined {
  return v && v !== 'NN' ? v : undefined
}

/**
 * Interroge l'API pour un SIRET (ou SIREN).
 * Renvoie `null` si l'entreprise est introuvable — cas fréquent avec des
 * numéros saisis à la main.
 */
export async function rechercherParSiret(brut: string, signal?: AbortSignal): Promise<InfoEntreprise | null> {
  const num = normaliserSiret(brut)
  if (!siretValide(num)) return null

  const res = await fetch(`${BASE}?q=${encodeURIComponent(num)}&per_page=1`, { signal })
  if (!res.ok) throw new Error(`API entreprises : HTTP ${res.status}`)
  const json = (await res.json()) as { results?: ReponseEntreprise[] }
  const r = json.results?.[0]
  if (!r?.siren) return null

  // L'établissement correspondant au SIRET demandé ; à défaut le siège.
  const etab =
    r.matching_etablissements?.find((e) => e.siret === num) ??
    r.matching_etablissements?.[0] ??
    r.siege

  const effEtab = effectifUtile(etab?.tranche_effectif_salarie)
  const effEnt = effectifUtile(r.tranche_effectif_salarie)

  return {
    siren: r.siren,
    siret: etab?.siret,
    nom: r.nom_complet ?? '',
    effectifCode: effEtab ?? effEnt,
    effectifAnnee: (effEtab ? etab?.annee_tranche_effectif_salarie : r.annee_tranche_effectif_salarie) ?? undefined,
    effectifDeLEntreprise: !effEtab && !!effEnt,
    activiteNaf: r.activite_principale ?? undefined,
    adresse: etab?.adresse ?? undefined,
    codePostal: etab?.code_postal ?? undefined,
    ville: etab?.libelle_commune ?? undefined,
    dateCreation: r.date_creation ?? undefined,
    etat: etab?.etat_administratif ?? r.etat_administratif ?? undefined,
    categorie: r.categorie_entreprise ?? undefined,
  }
}

/* ------------------------------------------------------------------ */
/* Recherche inverse : retrouver l'entreprise sans son SIRET           */
/* ------------------------------------------------------------------ */

export interface Candidats {
  candidats: InfoEntreprise[]
  /** Requête qui a abouti — utile pour expliquer un résultat surprenant. */
  requete: string
  /** true si on a dû retirer le premier mot du nom pour trouver. */
  nomTronque: boolean
}

function versInfo(r: ReponseEntreprise): InfoEntreprise {
  const etab = r.siege
  const effEtab = effectifUtile(etab?.tranche_effectif_salarie)
  const effEnt = effectifUtile(r.tranche_effectif_salarie)
  return {
    siren: r.siren ?? '',
    siret: etab?.siret,
    nom: r.nom_complet ?? '',
    effectifCode: effEtab ?? effEnt,
    effectifAnnee: (effEtab ? etab?.annee_tranche_effectif_salarie : r.annee_tranche_effectif_salarie) ?? undefined,
    effectifDeLEntreprise: !effEtab && !!effEnt,
    activiteNaf: r.activite_principale ?? undefined,
    adresse: etab?.adresse ?? undefined,
    codePostal: etab?.code_postal ?? undefined,
    ville: etab?.libelle_commune ?? undefined,
    dateCreation: r.date_creation ?? undefined,
    etat: etab?.etat_administratif ?? r.etat_administratif ?? undefined,
    categorie: r.categorie_entreprise ?? undefined,
  }
}

async function chercher(
  nom: string, codePostal?: string, codesNaf?: string, signal?: AbortSignal,
): Promise<InfoEntreprise[]> {
  const u = new URL(BASE)
  u.searchParams.set('q', nom)
  u.searchParams.set('per_page', '5')
  if (codePostal) u.searchParams.set('code_postal', codePostal)
  if (codesNaf?.trim()) u.searchParams.set('activite_principale', codesNaf.trim())

  const res = await fetch(u, { signal })
  if (!res.ok) throw new Error(`API entreprises : HTTP ${res.status}`)
  const json = (await res.json()) as { results?: ReponseEntreprise[] }
  return (json.results ?? []).filter((r) => r.siren).map(versInfo)
}

/**
 * Retrouve une entreprise à partir de sa raison sociale.
 *
 * Deux garde-fous appris des données réelles :
 *  - beaucoup de listes commerciales préfixent la raison sociale d'un nom de
 *    RÉSEAU absent du registre (« CHAUFFALIA LEGAVE ») : zéro résultat tant
 *    qu'il est présent. D'où le repli en retirant les premiers mots ;
 *  - un nom de famille seul est très ambigu (« OLLIVAUD » → 14 sociétés, dont
 *    un commerce de bouche). Le filtre par code NAF du métier le ramène à une
 *    poignée. On ne choisit JAMAIS le premier résultat à la place de
 *    l'utilisateur : au-delà d'un candidat, c'est à lui de trancher.
 */
export async function rechercherCandidats(
  nom: string,
  codePostal?: string,
  codesNaf?: string,
  signal?: AbortSignal,
): Promise<Candidats> {
  const mots = (nom ?? '').trim().split(/\s+/).filter(Boolean)
  if (!mots.length) return { candidats: [], requete: '', nomTronque: false }

  // Nom complet, puis en retirant un mot de tête à la fois (jamais le dernier).
  for (let debut = 0; debut < mots.length; debut++) {
    const requete = mots.slice(debut).join(' ')
    const trouves = await chercher(requete, codePostal, codesNaf, signal)
    if (trouves.length) {
      return { candidats: trouves, requete, nomTronque: debut > 0 }
    }
  }
  return { candidats: [], requete: nom, nomTronque: false }
}

/* ------------------------------------------------------------------ */
/* Recherche par critères (NAF + département + effectif)               */
/* ------------------------------------------------------------------ */

/** Codes de tranche correspondant à « au moins N salariés ». */
export function codesEffectifAuMoins(seuil: number): string {
  return Object.keys(TRANCHE_EFFECTIF)
    .filter((c) => effectifMinimum(c) >= seuil)
    .join(',')
}

/**
 * Métiers du bâtiment avec leurs codes NAF, pour chercher sans avoir à les
 * connaître. Chaque code a été vérifié contre l'API : aucun ne renvoie zéro.
 * La plomberie en porte deux — un plombier-chauffagiste peut être immatriculé
 * sous l'un ou l'autre, n'en prendre qu'un ferait perdre la moitié du métier.
 */
export const METIERS_NAF: { label: string; naf: string }[] = [
  { label: 'Plomberie / Chauffage', naf: '43.22A,43.22B' },
  { label: 'Électricité', naf: '43.21A' },
  { label: 'Plâtrerie / Plaquiste', naf: '43.31Z' },
  { label: 'Peinture / Vitrerie', naf: '43.34Z' },
  { label: 'Carrelage / Sols', naf: '43.33Z' },
  { label: 'Menuiserie bois-PVC', naf: '43.32A' },
  { label: 'Menuiserie métal / Serrurerie', naf: '43.32B' },
  { label: 'Charpente', naf: '43.91A' },
  { label: 'Couverture', naf: '43.91B' },
  { label: 'Maçonnerie / Gros œuvre', naf: '43.99C' },
  { label: 'Terrassement', naf: '43.12A' },
  { label: 'Démolition', naf: '43.11Z' },
  { label: 'Isolation', naf: '43.29A' },
  { label: 'Étanchéité', naf: '43.99A' },
  { label: 'Paysagiste', naf: '81.30Z' },
  { label: 'Architecte', naf: '71.11Z' },
  // La maîtrise d'œuvre n'a pas de code à elle : elle se déclare tantôt en
  // architecture (71.11Z), tantôt en ingénierie / études techniques (71.12B).
  // Les deux ensemble, sinon on perd la moitié de la profession. (Vérifié :
  // 547 et 1025 entreprises actives dans le seul Morbihan.)
  { label: 'Maîtrise d’œuvre / Bureau d’études', naf: '71.12B' },
  { label: 'Maître d’œuvre + architecte', naf: '71.11Z,71.12B' },
]

export interface RechercheCriteres {
  naf: string
  departement?: string
  /** Seuil de salariés. 0 = pas de filtre. */
  effectifMin?: number
  /** Écarte les sociétés radiées. Défaut : true. */
  actifSeulement?: boolean
  page?: number
}

export interface PageCriteres {
  resultats: InfoEntreprise[]
  total: number
  page: number
  totalPages: number
}

/**
 * Liste les entreprises d'un métier dans un département.
 *
 * Deux points appris des données réelles :
 *  - le filtre `departement` porte sur les ÉTABLISSEMENTS, mais `siege` reste le
 *    siège social : sans lire `matching_etablissements`, on afficherait Levallois
 *    pour une agence de Lanester. C'est donc l'établissement local qui fait foi ;
 *  - la pagination de l'API plafonne bien avant le total annoncé. Le filtre par
 *    effectif n'est pas qu'un critère de ciblage, c'est ce qui ramène le volume
 *    sous ce plafond (474 plombiers du Morbihan → 78 à partir de 3 salariés).
 */
export async function rechercherParCriteres(
  c: RechercheCriteres, signal?: AbortSignal,
): Promise<PageCriteres> {
  const u = new URL(BASE)
  u.searchParams.set('activite_principale', c.naf.trim())
  u.searchParams.set('per_page', '25')
  u.searchParams.set('page', String(Math.max(1, c.page ?? 1)))
  if (c.departement?.trim()) u.searchParams.set('departement', c.departement.trim())
  if (c.effectifMin && c.effectifMin > 0) {
    u.searchParams.set('tranche_effectif_salarie', codesEffectifAuMoins(c.effectifMin))
  }
  // Filtré à la source plutôt qu'après coup : écarter les radiées côté serveur
  // réduit aussi le volume paginé (1 717 → 1 026 sur la plomberie du Morbihan),
  // donc on atteint moins vite le plafond de l'API.
  if (c.actifSeulement !== false) u.searchParams.set('etat_administratif', 'A')

  const res = await fetch(u, { signal })
  if (!res.ok) throw new Error(`API entreprises : HTTP ${res.status}`)
  const json = (await res.json()) as {
    results?: ReponseEntreprise[]; total_results?: number; page?: number; total_pages?: number
  }

  const dep = c.departement?.trim()
  const resultats = (json.results ?? []).filter((r) => r.siren).map((r) => {
    // Établissement du département demandé, à défaut le premier, à défaut le siège.
    const etab =
      r.matching_etablissements?.find((e) => !dep || e.code_postal?.startsWith(dep)) ??
      r.matching_etablissements?.[0] ??
      r.siege
    const effEtab = effectifUtile(etab?.tranche_effectif_salarie)
    const effEnt = effectifUtile(r.tranche_effectif_salarie)
    return {
      siren: r.siren ?? '',
      siret: etab?.siret,
      nom: r.nom_complet ?? '',
      effectifCode: effEtab ?? effEnt,
      effectifAnnee: (effEtab ? etab?.annee_tranche_effectif_salarie : r.annee_tranche_effectif_salarie) ?? undefined,
      effectifDeLEntreprise: !effEtab && !!effEnt,
      activiteNaf: r.activite_principale ?? undefined,
      adresse: etab?.adresse ?? undefined,
      codePostal: etab?.code_postal ?? undefined,
      ville: etab?.libelle_commune ?? undefined,
      dateCreation: r.date_creation ?? undefined,
      etat: etab?.etat_administratif ?? r.etat_administratif ?? undefined,
      categorie: r.categorie_entreprise ?? undefined,
    } as InfoEntreprise
  })

  return {
    resultats,
    total: json.total_results ?? resultats.length,
    page: json.page ?? 1,
    totalPages: json.total_pages ?? 1,
  }
}

export interface ResultatRecherche {
  prospectId: string
  societe: string
  candidats: InfoEntreprise[]
  requete: string
  nomTronque: boolean
  erreur?: string
}

/**
 * Recherche en série pour un lot de prospects.
 * L'appelant n'applique que les résultats à candidat unique ; les autres sont
 * remontés tels quels pour un arbitrage manuel.
 */
export async function rechercherLot(
  cibles: { id: string; societe: string; codePostal?: string; codesNaf?: string }[],
  onProgres?: (fait: number, total: number) => void,
  signal?: AbortSignal,
): Promise<ResultatRecherche[]> {
  const out: ResultatRecherche[] = []
  for (let i = 0; i < cibles.length; i++) {
    if (signal?.aborted) break
    const c = cibles[i]
    try {
      const r = await rechercherCandidats(c.societe, c.codePostal, c.codesNaf, signal)
      out.push({ prospectId: c.id, societe: c.societe, ...r })
    } catch (e) {
      out.push({
        prospectId: c.id, societe: c.societe, candidats: [], requete: c.societe, nomTronque: false,
        erreur: e instanceof Error ? e.message : 'Erreur inconnue',
      })
    }
    onProgres?.(i + 1, cibles.length)
    if (i < cibles.length - 1) await new Promise((r) => setTimeout(r, DELAI_ENTRE_APPELS_MS))
  }
  return out
}

export interface ResultatLot {
  siret: string
  info: InfoEntreprise | null
  erreur?: string
}

/**
 * Enrichit une liste de SIRET en série, en respectant le débit de l'API.
 * Séquentiel volontairement : un parallélisme agressif ferait tomber l'API en
 * 429, et un enrichissement de masse n'a pas besoin d'être rapide.
 */
export async function enrichirLot(
  sirets: string[],
  onProgres?: (fait: number, total: number) => void,
  signal?: AbortSignal,
): Promise<ResultatLot[]> {
  const out: ResultatLot[] = []
  for (let i = 0; i < sirets.length; i++) {
    if (signal?.aborted) break
    const siret = sirets[i]
    try {
      out.push({ siret, info: await rechercherParSiret(siret, signal) })
    } catch (e) {
      out.push({ siret, info: null, erreur: e instanceof Error ? e.message : 'Erreur inconnue' })
    }
    onProgres?.(i + 1, sirets.length)
    if (i < sirets.length - 1) await new Promise((r) => setTimeout(r, DELAI_ENTRE_APPELS_MS))
  }
  return out
}
