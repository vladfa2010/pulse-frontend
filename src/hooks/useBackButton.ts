import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { useNavigate } from 'react-router'

/**
 * Intercepts the Android system back button.
 * - If there is browser/app history, navigate back via React Router.
 * - If we are on the root screen, move the app to background (Android moveTaskToBack).
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
        App.exitApp()
      }
    })

    return () => {
      listener.then((l) => l.remove())
    }
  }, [navigate])
}
