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
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const d = event.notification.data || {}
  const urlToOpen =
    d.url ||
    d.report_url ||
    (d.type === 'new_article' && d.news_id ? `/news/${d.news_id}` : null) ||
    (d.type === 'digest' ? '/feed' : null) ||
    (d.type === 'weekly_report' ? '/feed' : null) ||
    (d.type === 'sentiment_vote' ? '/sentiment' : null) ||
    (d.type === 'course_access' ? '/education' : null) ||
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
