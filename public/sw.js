self.addEventListener('push', function (event) {
  if (!event.data) return
  let data
  try { data = event.data.json() } catch { data = { title: 'TC Connect', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title || 'TC Connect', {
      body: data.body || '',
      icon: '/logo.PNG',
      badge: '/logo.PNG',
      data: { url: data.url || '/accueil' },
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
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
