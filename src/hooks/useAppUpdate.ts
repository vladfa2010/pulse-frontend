import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { api } from '@/lib/api'
import { InAppUpdater } from '@/lib/inAppUpdate'
import packageJson from '../../package.json'

const SKIP_VERSION_KEY = 'pulse_update_skipped_version'

interface AppVersionInfo {
  version: string
  apkUrl: string
  releaseUrl: string
}

function getInstalledVersion(): string {
  return packageJson.version
}

function isNewer(latest: string, current: string): boolean {
  const normalize = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const a = normalize(latest)
  const b = normalize(current)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const av = a[i] || 0
    const bv = b[i] || 0
    if (av > bv) return true
    if (av < bv) return false
  }
  return false
}

export function useAppUpdate() {
  const [info, setInfo] = useState<AppVersionInfo | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [checking, setChecking] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let isMounted = true

    const check = async () => {
      if (Capacitor.getPlatform() !== 'android') {
        if (isMounted) setChecking(false)
        return
      }

      try {
        const data = (await api.get('/app/version')) as AppVersionInfo
        if (!isMounted) return

        const current = getInstalledVersion()
        const skipped = localStorage.getItem(SKIP_VERSION_KEY)

        if (isNewer(data.version, current) && data.version !== skipped) {
          setInfo(data)
          setShowModal(true)
        }
      } catch (err: any) {
        console.log('[AppUpdate] Check failed:', err.message)
      } finally {
        if (isMounted) setChecking(false)
      }
    }

    // Check after a short delay so the app UI renders first
    const timer = setTimeout(check, 3000)
    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [])

  const dismiss = () => {
    if (info) {
      localStorage.setItem(SKIP_VERSION_KEY, info.version)
    }
    setShowModal(false)
  }

  const update = async () => {
    if (!info || updating) return
    setUpdating(true)
    setProgress(0)

    let listener: { remove: () => void } | null = null
    let caughtError: any = null
    try {
      if (Capacitor.getPlatform() === 'android') {
        listener = await InAppUpdater.addListener('downloadProgress', (event) => {
          setProgress(event.progress)
        })
        await InAppUpdater.downloadAndInstall({ url: info.apkUrl })
      } else if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: info.apkUrl })
      } else {
        window.open(info.releaseUrl, '_blank')
      }
    } catch (err: any) {
      caughtError = err
      console.error('[AppUpdate] Update failed:', err.message)

      if (Capacitor.getPlatform() === 'android' && err?.message === 'INSTALL_PACKAGES_PERMISSION_DENIED') {
        // User was redirected to settings. Keep modal open so they can retry.
        setUpdating(false)
        return
      }

      const pluginNotAvailable = err?.message?.includes('not implemented')
        || err?.message?.includes('plugin not found')
        || err?.message?.includes('no implementation')

      if (pluginNotAvailable) {
        // Fallback to browser only if the plugin is genuinely missing.
        if (Capacitor.isNativePlatform()) {
          await Browser.open({ url: info.apkUrl })
        } else {
          window.open(info.releaseUrl, '_blank')
        }
        setShowModal(false)
      }
      // Otherwise leave the modal open so the user sees the error and can retry.
    } finally {
      listener?.remove()
      const isPermissionError = caughtError?.message === 'INSTALL_PACKAGES_PERMISSION_DENIED'
      if (Capacitor.getPlatform() !== 'android' || isPermissionError) {
        setUpdating(false)
      }
    }
  }

  return { info, showModal, checking, updating, progress, dismiss, update }
}
