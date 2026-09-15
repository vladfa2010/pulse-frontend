/**
 * =============================================================================
 * PULSE — URL params страницы «Каскады» (ТЗ-93, задача 4)
 * =============================================================================
 *
 * Чистые функции для построения и чтения query-параметров /cascades.
 * Паттерн — как feedParams.ts для /feed: URL — единый источник истины,
 * F5 и шерабельность работают из коробки.
 *
 *   ?tab=cascades|stories|topics|graph|research|method  (дефолт cascades;
 *     'topics' — только при VITE_TOPICS_ENABLED=true, ТЗ-115)
 *   ?window=24h|7d|30d                         (дефолт зависит от вкладки)
 *   ?cluster=<id>                              (деталь-панель каскада)
 */

export type CascadesTab = 'cascades' | 'stories' | 'topics' | 'graph' | 'research' | 'method'
export type CascadesWindow = '24h' | '7d' | '30d'

/**
 * Фиче-флаг вкладки «Темы» (ТЗ-115): темы живут только на VPS-проде.
 *   VITE_TOPICS_ENABLED === 'true' (env VPS-сборки) → вкладка в массиве;
 *   unset/'false' (Render Static Site) → вкладки нет, ?tab=topics откатывается
 *   на 'cascades' через CASCADE_TABS.includes в parseCascadesParams.
 * Чистая функция — для тестов (src/lib/__tests__/cascadeParams.test.ts),
 * паттерн как isCascadeExpandEnabled (ТЗ-101).
 */
export function isTopicsEnabled(flag: string | null | undefined): boolean {
  return flag === 'true'
}

export const TOPICS_ENABLED = isTopicsEnabled(import.meta.env.VITE_TOPICS_ENABLED as string | undefined)

export interface CascadesParams {
  tab: CascadesTab
  window: CascadesWindow
  cluster: string | null
}

/** Список вкладок: «Темы» — условно, позиция 3 (ТЗ-115). Чистая функция —
 *  vite встраивает снапшот import.meta.env при трансформе, поэтому тесты
 *  гоняют эту функцию напрямую, а не TOPICS_ENABLED. */
export function cascadesTabs(enabled: boolean): CascadesTab[] {
  return [
    'cascades',
    'stories',
    ...(enabled ? (['topics'] as const) : []),
    'graph',
    'research',
    'method',
  ]
}

export const CASCADE_TABS: CascadesTab[] = cascadesTabs(TOPICS_ENABLED)

export const CASCADE_WINDOWS: CascadesWindow[] = ['24h', '7d', '30d']
/** Для графа и ресерча 24h бессмысленно (бэкенд отдаёт 400) — только 7d/30d */
export const GRAPH_WINDOWS: CascadesWindow[] = ['7d', '30d']

/** Дефолт окна по вкладке: «Каскады» — 24ч, «Граф»/«Ресерч» — 7д */
export function defaultWindowForTab(tab: CascadesTab): CascadesWindow {
  return tab === 'cascades' ? '24h' : '7d'
}

/** Валидность окна для вкладки: невалидное окно сбрасываем на дефолт вкладки */
export function isWindowValidForTab(tab: CascadesTab, window: CascadesWindow): boolean {
  return tab === 'cascades' ? CASCADE_WINDOWS.includes(window) : GRAPH_WINDOWS.includes(window)
}

/** Читает и нормализует параметры: неизвестная вкладка → cascades, невалидное окно → дефолт вкладки */
export function parseCascadesParams(searchParams: URLSearchParams): CascadesParams {
  const rawTab = searchParams.get('tab')?.trim() as CascadesTab | null
  const tab: CascadesTab = rawTab && CASCADE_TABS.includes(rawTab) ? rawTab : 'cascades'
  const rawWindow = searchParams.get('window')?.trim() as CascadesWindow | null
  const window: CascadesWindow =
    rawWindow && isWindowValidForTab(tab, rawWindow) ? rawWindow : defaultWindowForTab(tab)
  const cluster = searchParams.get('cluster')?.trim() || null
  return { tab, window, cluster }
}

/** Собирает URLSearchParams; дефолтные значения не попадают в URL (короткие шеры) */
export function buildCascadesParams(params: CascadesParams): URLSearchParams {
  const sp = new URLSearchParams()
  if (params.tab !== 'cascades') sp.set('tab', params.tab)
  if (params.window !== defaultWindowForTab(params.tab)) sp.set('window', params.window)
  if (params.cluster) sp.set('cluster', params.cluster)
  return sp
}
