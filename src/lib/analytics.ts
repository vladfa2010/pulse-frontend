import { Capacitor } from '@capacitor/core'
import { firebaseApp } from './firebase'
import type { Analytics } from 'firebase/analytics'

let analytics: Analytics | null = null
let initPromise: Promise<Analytics | null> | null = null

export async function initAnalytics(): Promise<Analytics | null> {
  if (analytics) return analytics
  if (initPromise) return initPromise

  initPromise = (async () => {
    if (typeof window === 'undefined') return null
    if (Capacitor.isNativePlatform()) return null
    if (!firebaseApp) return null
    if (!import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) return null

    const { getAnalytics, isSupported } = await import('firebase/analytics')
    const supported = await isSupported().catch(() => false)
    if (!supported) return null

    try {
      analytics = getAnalytics(firebaseApp)
      return analytics
    } catch (err) {
      console.warn('[Analytics] Initialization failed:', err)
      return null
    }
  })()

  return initPromise
}

export function logAnalyticsEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>
) {
  if (!analytics) return
  import('firebase/analytics')
    .then(({ logEvent }) => {
      logEvent(analytics as Analytics, eventName, params as Record<string, never>)
    })
    .catch(() => {
      // ignore
    })
}

export function setAnalyticsUserId(userId: string | null) {
  if (!analytics) return
  import('firebase/analytics')
    .then(({ setUserId }) => {
      setUserId(analytics as Analytics, userId)
    })
    .catch(() => {
      // ignore
    })
}

export function setAnalyticsUserProperties(
  properties: Record<string, string | number | boolean | undefined>
) {
  if (!analytics) return
  import('firebase/analytics')
    .then(({ setUserProperties }) => {
      setUserProperties(analytics as Analytics, properties as Record<string, never>)
    })
    .catch(() => {
      // ignore
    })
}
