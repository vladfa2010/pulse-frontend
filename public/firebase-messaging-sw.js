importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js')

// Fill these values from your Firebase Console web app config.
const firebaseConfig = {
  apiKey: '',
  projectId: '',
  messagingSenderId: '',
  appId: '',
}

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig)
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || 'PULSE'
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: '/logo.png',
      data: payload.data || {},
    }
    self.registration.showNotification(notificationTitle, notificationOptions)
  })
}
