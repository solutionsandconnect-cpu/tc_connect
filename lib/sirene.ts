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
