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

  const data = payload.data || {}
  // Backend кладёт текст события в title/body; для data-only пушей — в data.title/data.body
  const title = payload.title || data.title || 'PULSE'
  const body = payload.body || data.body || ''

  // Нет содержания — не показываем пустой пуш с брендом
  if (title === 'PULSE' && !body) return

  const options = {
    body,
    icon: '/icon-192x192.png',
    badge: '/icon-96x96.png',
    data,
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // Маппинг сверён с роутингом App.tsx (BrowserRouter, hash-роутов нет)
  // ТЗ-220: d.url первым (единый контракт диплинков), report_url — legacy ТЗ-191,
  // маппинг по type — fallback для старых пушей. Держать в синке с firebase-messaging-sw.js
  const d = event.notification.data || {}
  const urlToOpen =
    d.url ||
    d.report_url ||
    (d.type === 'new_article' && d.news_id ? `/news/${d.news_id}` : null) ||
    (d.type === 'digest' ? '/feed' : null) ||
    (d.type === 'weekly_report' ? '/feed' : null) ||
    (d.type === 'sentiment_vote' ? '/sentiment' : null) ||
    (d.type === 'course_access' ? '/education' : null) ||
    (d.type === 'bucket' && d.key ? '/?bucket=' + d.key : null) ||
    '/profile/tariff'

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
