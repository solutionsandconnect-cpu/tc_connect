// Coordonnées des codes postaux, pour filtrer et trier les prospects par distance.
//
// Source : geo.api.gouv.fr (Découpage administratif, API publique de l'État —
// gratuite, sans clé, CORS ouvert). On interroge PAR DÉPARTEMENT et non par code
// postal : une requête par département suffit à couvrir toutes ses communes,
// là où un appel par code postal en demanderait plusieurs centaines.
//
// Le résultat est mis en cache dans le navigateur : ces données ne bougent
// pratiquement jamais, et rien ne justifie d'écrire 1000 couples de coordonnées
// dans Firestore (ni d'ajouter une collection, donc des règles à déployer).

const CACHE_CLE = 'tc.geoCp.v1'

export interface Point { lat: number; lng: number }

interface CommuneApi {
  codesPostaux?: string[]
  centre?: { coordinates?: [number, number] }
}

/** Distance à vol d'oiseau, en kilomètres (formule de haversine). */
export function distanceKm(a: Point, b: Point): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

export function lireCache(): Record<string, Point> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_CLE) ?? '{}') as Record<string, Point>
  } catch {
    return {}
  }
}

function ecrireCache(table: Record<string, Point>): void {
  try {
    window.localStorage.setItem(CACHE_CLE, JSON.stringify(table))
  } catch {
    /* quota dépassé ou navigation privée : on se contente de la mémoire */
  }
}

/**
 * Complète le cache pour les départements demandés.
 * `onProgres` permet d'afficher l'avancement : une dizaine de départements,
 * c'est rapide, mais pas instantané sur une connexion lente.
 */
export async function chargerDepartements(
  codesDept: string[],
  onProgres?: (fait: number, total: number) => void,
): Promise<Record<string, Point>> {
  const table = lireCache()
  // Un département déjà connu n'est pas rechargé : le cache porte tous ses
  // codes postaux d'un coup, il n'y a donc jamais de couverture partielle.
  const manquants = codesDept.filter(
    (d) => !Object.keys(table).some((cp) => cp.startsWith(d === '2A' || d === '2B' ? '20' : d)),
  )

  let fait = 0
  onProgres?.(0, manquants.length)

  for (const dept of manquants) {
    try {
      const res = await fetch(
        `https://geo.api.gouv.fr/departements/${dept}/communes?fields=codesPostaux,centre&format=json`,
        { cache: 'force-cache' },
      )
      if (res.ok) {
        const communes = (await res.json()) as CommuneApi[]
        for (const c of communes) {
          const coord = c.centre?.coordinates
          if (!coord) continue
          // GeoJSON ordonne [longitude, latitude] — l'inverse de l'usage courant.
          const point: Point = { lat: coord[1], lng: coord[0] }
          for (const cp of c.codesPostaux ?? []) {
            // Un code postal peut couvrir plusieurs communes : la première
            // suffit, on cherche un ordre de grandeur, pas une adresse.
            if (!table[cp]) table[cp] = point
          }
        }
      }
    } catch {
      /* département ignoré : ses prospects resteront sans distance */
    }
    fait++
    onProgres?.(fait, manquants.length)
  }

  ecrireCache(table)
  return table
}
