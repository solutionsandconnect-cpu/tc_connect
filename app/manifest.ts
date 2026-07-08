import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { hostToBrand } from '@/lib/brand'

// Manifest PWA dépendant du DOMAINE : lire `headers()` le rend dynamique (cf. doc Next 16).
// app.enezo.fr → « Enezo » + thème Petrol ; tout le reste → « TC Connect » inchangé (coaching).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
  const isEnezo = hostToBrand(host) === 'enezo'

  const name = isEnezo ? 'Enezo' : 'TC Connect'
  return {
    name,
    short_name: name,
    description: isEnezo
      ? 'Espace client Enezo'
      : 'Application de gestion pour coachs sportifs',
    start_url: '/accueil',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: isEnezo ? '#377684' : '#2563eb',
    icons: isEnezo
      ? [
          { src: '/enezo-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/enezo-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]
      : [
          { src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
  }
}
