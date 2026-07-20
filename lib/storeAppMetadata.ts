import type { Metadata } from 'next'
import { getAdminDb } from '@/lib/firebaseAdmin'

/**
 * Métadonnées d'une app de la boutique, pour le raccourci « Ajouter à l'écran d'accueil ».
 *
 * iOS met en favori l'URL affichée AU MOMENT de l'ajout : depuis /bebe, le raccourci
 * rouvre donc directement l'app Bébé. Il reprend l'`apple-touch-icon` et le
 * `apple-mobile-web-app-title` de cette page — d'où ces métadonnées par route, qui
 * surchargent celles du layout racine.
 *
 * Icône : toujours le logo Enezo (les apps de la boutique sont côté Enezo).
 * Nom : celui réglé par app dans /boutique/admin, repris TEL QUEL (aucun préfixe ajouté —
 * c'est à Teddy d'écrire « Enezo - Bébé » s'il le veut). Repli : le nom boutique de l'app.
 */

const ENEZO_APPLE_ICON = '/enezo-apple-touch-icon.png'

/** Nom d'écran d'accueil réglé sur la fiche app (repli : son nom boutique complet). */
async function homeScreenName(route: string): Promise<string> {
  try {
    const snap = await getAdminDb()
      .collection('store_apps')
      .where('route', '==', route)
      .limit(1)
      .get()
    if (snap.empty) return ''
    const app = snap.docs[0].data()
    return String(app.nomCourt || app.nom || '').trim()
  } catch {
    // Firestore indisponible / env admin absente → on retombe sur le nom passé en dur
    return ''
  }
}

export async function storeAppMetadata(route: string, fallbackName: string): Promise<Metadata> {
  const title = (await homeScreenName(route)) || fallbackName
  return {
    title,
    appleWebApp: { capable: true, title, statusBarStyle: 'default' },
    icons: { apple: ENEZO_APPLE_ICON },
  }
}
