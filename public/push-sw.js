// Treeniksen ilmoitukset. Workboxin service worker lataa tämän (vite.config.ts: importScripts).
// Palvelin lähettää { title, body, url, tag }. Sama tag korvaa edellisen ilmoituksen.

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Treenis', {
      body: data.body || '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  )
})

// Napautus avaa ilmoituksen näkymän: jo auki oleva Treenis siirtyy sinne, muuten avataan uusi.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin))
      if (open) return open.navigate(url).then((client) => (client ?? open).focus())
      return self.clients.openWindow(url)
    }),
  )
})
