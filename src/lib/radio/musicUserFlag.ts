/**
 * PULSE — Радио: юзерский флаг фоновой музыки (TZ70).
 *
 * Один ключ localStorage для всех UI (иконка ♪ в GlobalPlayerBar, тоггл в
 * SettingsPanel, useMusicOnIdle). Запись диспатчит кастомное событие
 * `pulse_music_toggled` — слушатели в том же окне мгновенно перечитывают флаг
 * (storage-событие между табами не доходит до текущего). Хук useMusicUserFlag
 * подписан на ОБА события — любой переключатель реактивен везде.
 */
import { useEffect, useState } from 'react'

export const MUSIC_USER_FLAG_KEY = 'pulse_music_enabled'
export const MUSIC_TOGGLED_EVENT = 'pulse_music_toggled'

export function getMusicUserFlag(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(MUSIC_USER_FLAG_KEY) !== '0'
}

export function setMusicUserFlag(enabled: boolean): void {
  localStorage.setItem(MUSIC_USER_FLAG_KEY, enabled ? '1' : '0')
  window.dispatchEvent(new CustomEvent(MUSIC_TOGGLED_EVENT))
}

/** Реактивное чтение юзерского флага: подписан на storage (другие табы) и
 *  pulse_music_toggled (это окно). */
export function useMusicUserFlag(): boolean {
  const [enabled, setEnabled] = useState(getMusicUserFlag)

  useEffect(() => {
    const sync = () => setEnabled(getMusicUserFlag())
    window.addEventListener(MUSIC_TOGGLED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(MUSIC_TOGGLED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return enabled
}
