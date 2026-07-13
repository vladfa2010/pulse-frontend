import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'pulse_sound_muted'

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function useSoundToggle() {
  const [isMuted, setIsMuted] = useState(readMuted)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isMuted))
    } catch {
      // ignore
    }
  }, [isMuted])

  const toggle = useCallback(() => setIsMuted((prev) => !prev), [])

  return { isMuted, toggle }
}
