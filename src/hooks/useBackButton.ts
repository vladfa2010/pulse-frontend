import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { useNavigate } from 'react-router'

/**
 * Intercepts the Android system back button.
 * - If there is browser/app history, navigate back via React Router.
 * - If we are on the root screen, minimize the app (Android moveTaskToBack).
 *
 * We intentionally use App.minimizeApp() instead of App.exitApp():
 * exitApp() finishes the Activity, which on many devices causes the WebView
 * and localStorage session to be recreated and the user to appear logged out.
 * minimizeApp() keeps the Activity alive in the background, preserving the
 * JWT session and the FCM push token association.
 *
 * Safe to call on web/iOS: it no-ops when not running on a native platform.
 */
export function useBackButton() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listener = App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        navigate(-1)
      } else {
        // Minimize instead of exit to keep the user logged in and push token active.
        App.minimizeApp()
      }
    })

    return () => {
      listener.then((l) => l.remove())
    }
  }, [navigate])
}
