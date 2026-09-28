/**
 * PULSE — Радио: SFX-cue из библиотеки (TZ71).
 *
 * «Пилик» о новой новости берётся из файловой библиотеки на сервере
 * (/opt/pulse/sfx, админка: SFX Library) и играет через sfxGain общего
 * AudioContext — на одном уровне с синтетическим beep() из sound.ts.
 *
 * Фолбэк: библиотека пуста / сеть недоступна → false → вызывающий код
 * играет синтетический beep() (поведение ТЗ-44 сохраняется).
 */
import { API_BASE } from '@/lib/api'
import { getSfxElement, resumeAudio } from '@/services/audioContext'

const API_ORIGIN = API_BASE.replace(/\/api$/, '')

/** Склеить origin API с путём вида /api/radio/sfx/file/... из ответа бэка. */
export function sfxAbsoluteUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_ORIGIN}${path}`
}

/**
 * Сыграть случайный SFX из библиотеки.
 * @returns true — файл начал играть; false — библиотека пуста/ошибка (фолбэк на beep()).
 */
export async function playSfxCueFromLibrary(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/radio/sfx/next`, { credentials: 'include' })
    if (!res.ok) return false
    const data = (await res.json()) as { url: string | null }
    if (!data?.url) return false

    const el = getSfxElement()
    el.src = sfxAbsoluteUrl(data.url)
    resumeAudio() // контекст мог уйти в suspended (фоновая вкладка)
    await el.play()
    return true
  } catch {
    return false
  }
}
