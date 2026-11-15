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

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(openApp(event.notification.data?.url || '/'))
})

// Selain sallii ikkunan tuomisen eteen vain heti napautuksen jälkeen, joten focus tehdään ensin.
// Auki oleva Treenis vaihtaa näkymän itse (src/main.ts): sivu ei lataudu uudelleen eikä
// käynnissä oleva treeni katkea. Jos eteen tuominen ei onnistu, avataan uusi ikkuna.
async function openApp(path) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const open = windows.find((client) => client.url.startsWith(self.location.origin))
  if (open) {
    try {
      const focused = (await open.focus()) ?? open
      focused.postMessage({ type: 'open', path })
      return
    } catch {
      // Jatketaan uuteen ikkunaan.
    }
  }
  await self.clients.openWindow(new URL(path, self.location.origin).href)
}
