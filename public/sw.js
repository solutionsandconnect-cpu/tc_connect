// Active immédiatement la nouvelle version du service worker (sans attendre la fermeture)
self.addEventListener('install', function () { self.skipWaiting() })
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()) })

self.addEventListener('push', function (event) {
  if (!event.data) return
  let data
  try { data = event.data.json() } catch { data = { title: 'TC Connect', body: event.data.text() } }

  event.waitUntil((async () => {
    await self.registration.showNotification(data.title || 'TC Connect', {
      body: data.body || '',
      icon: '/web-app-manifest-192x192.png',
      badge: '/web-app-manifest-192x192.png',
      data: { url: data.url || '/accueil' },
    })
    // Pastille sur l'icône de l'app (iOS 16.4+ / Android via l'API Badging)
    try {
      if (self.navigator.setAppBadge) {
        const count = typeof data.badge === 'number' && data.badge > 0 ? data.badge : (await bumpBadgeCount())
        await self.navigator.setAppBadge(count)
      }
    } catch (e) { /* Badging non supporté → on ignore */ }
  })())
})

// Compteur de pastille persistant (le service worker n'a pas de mémoire entre deux push)
async function bumpBadgeCount() {
  try {
    const cache = await caches.open('badge-count')
    const res = await cache.match('count')
    const current = res ? Number(await res.text()) || 0 : 0
    const next = current + 1
    await cache.put('count', new Response(String(next)))
    return next
  } catch {
    return 1
  }
}

// Permet à l'app (quand on l'ouvre) de remettre le compteur à zéro
self.addEventListener('message', function (event) {
  if (event.data === 'clear-badge') {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open('badge-count')
        await cache.put('count', new Response('0'))
      } catch {}
      try { if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge() } catch {}
    })())
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  // Remet la pastille à zéro : l'utilisateur ouvre l'app
  try { if (self.navigator.clearAppBadge) self.navigator.clearAppBadge() } catch {}
  caches.open('badge-count').then((c) => c.put('count', new Response('0'))).catch(() => {})
  const url = event.notification.data?.url || '/accueil'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      if (list.length > 0) {
        const client = list[0]
        return client.navigate(url).then(() => client.focus())
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
