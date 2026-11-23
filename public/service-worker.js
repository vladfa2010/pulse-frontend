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

// ТЗ-223: iOS Safari уводит clients.openWindow(absolute) во вкладку Safari вместо
// PWA. Навигируем и открываем только относительные пути своего origin.
function toRelativePath(u) {
  try {
    const url = new URL(u, self.location.origin)
    if (url.origin !== self.location.origin) return '/'
    return url.pathname + url.search
  } catch {
    return typeof u === 'string' && u.startsWith('/') ? u : '/'
  }
}

// ТЗ-223: страховка от WebKit-багов iOS (openWindow игнорирует URL при холодном
// старте PWA, bug 259212). SW кладёт целевой путь в IndexedDB, приложение
// забирает его при загрузке и навигирует само. Никогда не реджектит.
function savePendingNav(path) {
  return new Promise((resolve) => {
    let req
    try {
      req = indexedDB.open('pulse-push', 1)
    } catch {
      resolve()
      return
    }
    req.onupgradeneeded = () => req.result.createObjectStore('nav')
    req.onsuccess = () => {
      try {
        const tx = req.result.transaction('nav', 'readwrite')
        tx.objectStore('nav').put(path, 'pending')
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      } catch {
        resolve()
      }
    }
    req.onerror = () => resolve()
  })
}

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

  // ТЗ-223 слой 1: только относительный путь своего origin (чужие → '/')
  const path = toRelativePath(urlToOpen)

  // ТЗ-223 слои 2+3: сначала запись в IndexedDB и рассылка живым клиентам,
  // потом navigate/focus/openWindow — порядок закрывает гонку «записали до открытия окна»
  event.waitUntil(
    savePendingNav(path).then(() =>
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url.includes(self.location.origin)) {
              // Слой 3: сообщение живому клиенту — обход «инертного» клиента
              // (WebKit 252544), navigate к нему может молча не сработать.
              client.postMessage({ type: 'PULSE_PUSH_NAV', path })
              if ('focus' in client) {
                client.navigate(path)
                return client.focus()
              }
            }
          }
          return self.clients.openWindow(path)
        })
    ).catch(() => {}) // ТЗ-223 аудит: focus/openWindow могут реджектить (NotAllowedError) — клик уже обработан
  )
})

