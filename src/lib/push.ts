import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { PushNotifications } from '@capacitor/push-notifications'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import { api } from './api'
import { firebaseApp } from './firebase'
import { registerVapidPush } from './vapidPush'

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

export function initPushDeepLinks(navigate: (path: string) => void): void {
  if (!Capacitor.isNativePlatform()) return

  // Только пути нашего домена — чужие URL (если прилетят) игнорируем
  const toPath = (url: string): string | null => {
    try {
      const u = new URL(url)
      if (u.host !== 'pulse.inside-trade.ru') return null
      return u.pathname + u.search
    } catch {
      return null
    }
  }

  // ТЗ-220: Android открыл MainActivity через App Link (тап по пушу) —
  // навигация на целевой экран. Query сохраняем (magic-токен отчёта ?k=…)
  App.addListener('appUrlOpen', ({ url }) => {
    const path = toPath(url)
    if (path) navigate(path)
  })

  // Холодный старт: URL пришёл до подписки на событие
  App.getLaunchUrl().then((res) => {
    const path = res?.url ? toPath(res.url) : null
    if (path) navigate(path)
  }).catch(() => {})
}

// ТЗ-223: тап по пушу в вебе (прежде всего iOS PWA). SW кладёт целевой путь
// в IndexedDB и шлёт postMessage — забираем оба канала.
export function initWebPushNav(navigate: (path: string) => void): void {
  if (Capacitor.isNativePlatform()) return

  const deletePending = (db: IDBDatabase) => {
    try {
      const tx = db.transaction('nav', 'readwrite')
      tx.objectStore('nav').delete('pending')
    } catch { /* best-effort */ }
  }

  // Холодный старт: SW открыл PWA, но WebKit мог проигнорировать URL (bug 259212)
  const readPending = async () => {
    try {
      const db = await new Promise<IDBDatabase | null>((resolve) => {
        const req = indexedDB.open('pulse-push', 1)
        req.onupgradeneeded = () => req.result.createObjectStore('nav')
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
      })
      if (!db) return
      const path = await new Promise<string | null>((resolve) => {
        const tx = db.transaction('nav', 'readwrite')
        const getReq = tx.objectStore('nav').get('pending')
        tx.objectStore('nav').delete('pending')
        getReq.onsuccess = () => resolve((getReq.result as string) ?? null)
        tx.onerror = () => resolve(null)
      })
      if (path && path !== window.location.pathname + window.location.search) {
        navigate(path)
      }
    } catch { /* IndexedDB недоступен — просто пропускаем */ }
  }
  readPending()

  // Тап по пушу при открытой PWA: SW присылает целевой путь сообщением.
  // Нит ревью: после navigate чистим pending — иначе устаревшая запись
  // «стрельнула» бы при следующем холодном старте.
  navigator.serviceWorker?.addEventListener('message', (event) => {
    const data = event.data as { type?: string; path?: string }
    if (data?.type === 'PULSE_PUSH_NAV' && typeof data.path === 'string') {
      navigate(data.path)
      try {
        const req = indexedDB.open('pulse-push', 1)
        req.onsuccess = () => deletePending(req.result)
      } catch { /* best-effort */ }
    }
  })
}

export function isPushAvailable(): boolean {
  return Capacitor.isNativePlatform() || ('Notification' in window && 'serviceWorker' in navigator)
}

export async function initPushNotifications(): Promise<boolean> {
  if (!isPushAvailable()) {
    console.log('[Push] Not available on this platform')
    return false
  }

  try {
    if (Capacitor.isNativePlatform()) {
      return await registerNativePush()
    }
    return await registerWebPush()
  } catch (err: any) {
    console.error('[Push] Registration failed:', err.message)
    return false
  }
}

async function saveToken(token: string): Promise<void> {
  try {
    await api.post('/user/channels', { channel: 'push', target: token })
  } catch (err: any) {
    console.error('[Push] Failed to save token:', err.message)
  }
}

async function registerNativePush(): Promise<boolean> {
  console.log('[Push] registerNativePush start')
  const perm = await PushNotifications.requestPermissions()
  console.log('[Push] requestPermissions result:', perm)
  if (perm.receive !== 'granted') {
    console.log('[Push] Permission denied')
    return false
  }

  return new Promise<boolean>((resolve) => {
    let resolved = false

    const done = (value: boolean) => {
      if (!resolved) {
        resolved = true
        resolve(value)
      }
    }

    PushNotifications.addListener('registration', async ({ value }) => {
      console.log('[Push] Native token received:', value)
      await saveToken(value)
      done(true)
    })

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error:', err.error)
      done(false)
    })

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Foreground notification:', notification)
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[Push] Notification tapped:', notification)
    })

    PushNotifications.register()
      .then(() => console.log('[Push] Native register() succeeded'))
      .catch((err: any) => {
        console.error('[Push] Native register() failed:', err.message || err)
        done(false)
      })
  })
}

async function registerWebPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    console.log('[Push] Web permission denied')
    return false
  }

  // Try Firebase Cloud Messaging first
  try {
    const supported = await isSupported()
    if (supported && firebaseApp) {
      const messaging = getMessaging(firebaseApp)
      const token = await getToken(messaging, { vapidKey: vapidKey || undefined })
      if (token) {
        console.log('[Push] Web FCM token:', token)
        await saveToken(token)
        onMessage(messaging, (payload) => {
          console.log('[Push] Foreground web message:', payload)
        })
        return true
      }
    }
  } catch (err: any) {
    console.log('[Push] FCM registration failed, falling back to VAPID:', err.message)
  }

  // Fallback to VAPID web push
  return registerVapidPush()
}

export async function getPushPermissionState(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (!isPushAvailable()) return 'unsupported'

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await PushNotifications.checkPermissions()
      console.log('[Push] checkPermissions result:', perm)
      if (perm.receive === 'granted') return 'granted'
      if (perm.receive === 'denied') return 'denied'
      return 'prompt'
    } catch (err: any) {
      console.error('[Push] checkPermissions error:', err.message || err)
      return 'unsupported'
    }
  }

  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission as 'granted' | 'denied' | 'prompt'
}
