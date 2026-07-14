import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'pulse_sound_muted'

function readMuted(): boolean {
  try {
    // По умолчанию звук выключен (muted=true), пока пользователь явно не включил
    return localStorage.getItem(STORAGE_KEY) !== 'false'
  } catch {
    return true
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
