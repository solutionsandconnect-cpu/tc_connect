// Extraction des fiches artisans de l'annuaire levraiartisan.fr.
//
// Fonctions PURES : elles prennent du HTML et rendent des données. Le réseau vit
// dans la route serveur (app/api/annuaire), ce qui permet de tester l'extraction
// sur du HTML réel sans appeler le site.
//
// Le site est un WordPress : sa structure peut changer. Chaque champ est donc
// extrait par plusieurs chemins indépendants plutôt que par un XPath unique —
// c'est précisément ce qui rend les formules IMPORTXML si fragiles.

export const ANNUAIRE_BASE = 'https://levraiartisan.fr'

/**
 * Numéros affichés sur TOUTES les fiches : ce sont ceux de l'annuaire lui-même,
 * pas de l'artisan. Repérés en comparant plusieurs fiches entre elles.
 */
const TELEPHONES_ANNUAIRE = new Set(['0763988343'])

export interface FicheArtisan {
  url: string
  societe: string
  email?: string
  telephone?: string
  codePostal?: string
  commune?: string
  metier?: string
  /** Nom du département tel qu'affiché par l'annuaire (« Puy de Dôme »). */
  departement?: string
}

/** Décode les entités HTML courantes laissées par WordPress. */
function decode(s: string): string {
  return s
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** URLs de fiches présentes dans une page de catégorie ou un sitemap. */
export function extraireLiensFiches(html: string): string[] {
  const re = new RegExp(`(?:href="|<loc>)(${ANNUAIRE_BASE}/artisan/[^"<]+)`, 'g')
  const urls = [...html.matchAll(re)]
    .map((m) => m[1].replace(/[?#].*$/, ''))
    // `/artisan/` seul est la page d'index de la rubrique, pas une fiche.
    .filter((u) => u !== `${ANNUAIRE_BASE}/artisan/` && u.length > `${ANNUAIRE_BASE}/artisan/`.length)
  return [...new Set(urls)]
}

/** Extrait une fiche artisan. Renvoie null si la page n'en est pas une. */
export function extraireFiche(html: string, url: string): FicheArtisan | null {
  // Raison sociale : le <title> est « Nom - Le vrai artisan ».
  const titre = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1]
  const societe = titre ? decode(titre).replace(/\s*-\s*Le vrai artisan\s*$/i, '').trim() : ''
  if (!societe) return null

  // Email : premier mailto qui n'est pas celui de l'annuaire lui-même.
  const email = [...html.matchAll(/mailto:([^"'?&]+)/g)]
    .map((m) => decode(m[1]).toLowerCase())
    .find((e) => e.includes('@') && !e.endsWith('@levraiartisan.fr'))

  // Téléphone : on écarte les numéros de l'annuaire, communs à toutes les fiches.
  const telephone = [...html.matchAll(/tel:([+0-9 .]+)/g)]
    .map((m) => m[1].replace(/[^\d+]/g, ''))
    .find((t) => t && !TELEPHONES_ANNUAIRE.has(t))

  // Adresse : lue dans le paramètre `q=` du lien Google Maps plutôt que dans le
  // texte du lien — celui-ci contient une icône SVG volumineuse qui rendait
  // l'extraction dépendante d'une limite de longueur arbitraire.
  const q = (html.match(/maps\.google\.com\/\?q=([^"]*)"/) || [])[1]
  let adresse = ''
  if (q) {
    try { adresse = decode(decodeURIComponent(q.replace(/\+/g, ' '))) }
    catch { adresse = decode(q) }
  }
  const cpVille = adresse.match(/\b(\d{5})\s+([^,]+?)(?:,|$)/)
  const codePostal = cpVille?.[1]
  const commune = cpVille?.[2]?.trim()

  // Métier : classe du <body> (`local_business_category-plombier`), avec repli
  // sur le lien de taxonomie si la classe disparaissait.
  const metier =
    (html.match(/local_business_category-([a-z0-9-]+)/) || [])[1] ??
    (html.match(/\/categorie\/([a-z0-9-]+)\//) || [])[1]

  // Département : la meta description dit « ... dans le Puy de Dôme : ... ».
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1]
  const dep = desc ? decode(desc).match(/\bdans (?:le |la |l'|les )?([^:]+?)\s*:/i) : null
  const departement = dep?.[1]?.trim()

  return { url, societe, email, telephone, codePostal, commune, metier, departement }
}

/** Les deux premiers chiffres du code postal donnent le département (hors Corse/DOM). */
export function departementDepuisCp(cp?: string): string | undefined {
  if (!cp || cp.length < 2) return undefined
  const d = cp.slice(0, 2)
  if (d === '20') return '2A/2B'
  if (d === '97' || d === '98') return cp.slice(0, 3)
  return d
}

/** URL d'une page de catégorie (`page` commence à 1). */
export function urlCategorie(metier: string, page = 1): string {
  const slug = metier.trim().toLowerCase()
  return page <= 1
    ? `${ANNUAIRE_BASE}/categorie/${slug}/`
    : `${ANNUAIRE_BASE}/categorie/${slug}/page/${page}/`
}
