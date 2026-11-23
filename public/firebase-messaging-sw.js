importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js')

// Fill these values from your Firebase Console web app config.
const firebaseConfig = {
  apiKey: 'AIzaSyDK6QdiEKb7dLUM97j2eyOiHxUzj1IMyhs',
  projectId: 'pulse-5366b',
  messagingSenderId: '547755321077',
  appId: '1:547755321077:web:73bfae06df048d2d6787bc',
}

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig)
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {}
    const title = payload.notification?.title || data.title || 'PULSE'
    const body = payload.notification?.body || data.body || ''

    // Нет содержания — не показываем пустой пуш с брендом
    if (title === 'PULSE' && !body) return

    self.registration.showNotification(title, {
      body,
      icon: '/logo.png',
      data,
    })
  })
}

// ТЗ-220: тап по пушу открывает URL назначения. Цепочка в синке с
// service-worker.js (VAPID): d.url первым, маппинг по type — fallback.
// fcmOptions.link из бэкенда не конфликтует: уведомление рисуем мы сами.
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
    )
  )
})

