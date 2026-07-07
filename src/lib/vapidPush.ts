import { api } from './api'

export function isVapidPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export async function registerVapidPush(): Promise<boolean> {
  if (!isVapidPushSupported()) return false

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js')
    await navigator.serviceWorker.ready

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      const { publicKey } = await api.get('/user/vapid-public-key')
      if (!publicKey) {
        console.warn('[VAPID] No public key configured')
        return false
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })
    }

    const subJson = subscription.toJSON()
    await api.post('/user/push-subscribe', {
      endpoint: subJson.endpoint,
      p256dh: subJson.keys?.p256dh,
      auth: subJson.keys?.auth,
    })

    return true
  } catch (err: any) {
    console.error('[VAPID] Registration failed:', err.message)
    return false
  }
}

export async function unregisterVapidPush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await api.post('/user/push-unsubscribe', { endpoint: subscription.endpoint })
      await subscription.unsubscribe()
    }
  } catch (err: any) {
    console.error('[VAPID] Unregister failed:', err.message)
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
