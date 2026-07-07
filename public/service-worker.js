/*
 * PULSE — Service Worker for VAPID Web Push
 */

self.addEventListener('install', (event) => {
  console.log('[SW] Installing PULSE service worker')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating PULSE service worker')
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'PULSE', body: event.data.text() }
  }

  const title = payload.title || 'PULSE'
  const options = {
    body: payload.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-96x96.png',
    data: payload.data || {},
    requireInteraction: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/#/profile/tariff'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen)
            return client.focus()
          }
        }
        return self.clients.openWindow(urlToOpen)
      })
  )
})
