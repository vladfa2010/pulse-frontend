import { Capacitor } from '@capacitor/core'

// ТЗ-123 (Android TV): детект ТВ-платформы. Основной источник — нативный
// плагин TvDetector (регистрирует другой агент в android/). Запасной путь —
// эвристика «большой экран без тача» — применяется только внутри нативного
// приложения; на вебе (где плагина нет всегда) ответ всегда false.

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

  // Эвристика «большой экран без тача» валидна только внутри нативного
  // приложения (запасной путь, если плагин не ответил). На вебе плагина нет
  // всегда, и эвристика срабатывала бы на любых десктопных мониторах ≥1600px,
  // навешивая body.is-tv и ТВ-раскладку обычным веб-пользователям (блокер
  // ревью REVIEW-TZ-123_2026-10-03). Поэтому на вебе — сразу false.
  if (!Capacitor.isNativePlatform()) {
    cachedResult = false
    return cachedResult
  }

  try {
    const plugins = (Capacitor as unknown as { Plugins?: Record<string, TvDetectorPlugin> }).Plugins
    const result = await plugins?.TvDetector?.isTV?.()
    if (result && typeof result.isTV === 'boolean') {
      cachedResult = result.isTV
      return cachedResult
    }
  } catch {
    // Нативный вызов упал — падаем на эвристику.
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
