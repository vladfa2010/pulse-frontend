import { useState, useCallback, useEffect } from 'react'
import { safeStorage } from '@/lib/safeStorage'

const STORAGE_KEY = 'pulse_sound_muted'

function readMuted(): boolean {
  // По умолчанию звук выключен (muted=true), пока пользователь явно не включил
  return safeStorage.get(STORAGE_KEY) !== 'false'
}

export function useSoundToggle() {
  const [isMuted, setIsMuted] = useState(readMuted)

  useEffect(() => {
    safeStorage.set(STORAGE_KEY, String(isMuted))
  }, [isMuted])

  const toggle = useCallback(() => setIsMuted((prev) => !prev), [])

  return { isMuted, toggle }
}
