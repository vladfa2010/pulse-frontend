import { Capacitor } from '@capacitor/core'

// ТЗ-123 (Android TV): детект ТВ-платформы. Основной источник — нативный
// плагин TvDetector (регистрирует другой агент в android/), но в dev-web его
// может не быть — любой вызов через try/catch, fallback — эвристика
// «большой экран без тача».

interface TvDetectorPlugin {
  isTV: () => Promise<{ isTV: boolean }>
}

let cachedResult: boolean | null = null

// Эвристика: ширина ≥1600px И ни touch-событий, ни coarse-pointer.
function heuristicIsTV(): boolean {
  if (typeof window === 'undefined') return false
  const noTouch = !('ontouchstart' in window) && !window.matchMedia('(pointer: coarse)').matches
  return window.innerWidth >= 1600 && noTouch
}

export async function detectTV(): Promise<boolean> {
  if (cachedResult !== null) return cachedResult

  try {
    const plugins = (Capacitor as unknown as { Plugins?: Record<string, TvDetectorPlugin> }).Plugins
    const result = await plugins?.TvDetector?.isTV?.()
    if (result && typeof result.isTV === 'boolean') {
      cachedResult = result.isTV
      return cachedResult
    }
  } catch {
    // Плагина нет (dev-web) или нативный вызов упал — падаем на эвристику.
  }

  cachedResult = heuristicIsTV()
  return cachedResult
}

// При старте приложения вешает на <body> маркер платформы: is-tv / no-tv.
// CSS-раскладка 10-foot UI и фокус-стили D-pad висят на body.is-tv.
export async function applyPlatformClasses(): Promise<void> {
  const isTV = await detectTV()
  document.body.classList.add(isTV ? 'is-tv' : 'no-tv')
}
