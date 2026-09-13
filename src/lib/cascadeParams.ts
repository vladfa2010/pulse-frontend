/**
 * =============================================================================
 * PULSE — URL params страницы «Каскады» (ТЗ-93, задача 4)
 * =============================================================================
 *
 * Чистые функции для построения и чтения query-параметров /cascades.
 * Паттерн — как feedParams.ts для /feed: URL — единый источник истины,
 * F5 и шерабельность работают из коробки.
 *
 *   ?tab=cascades|stories|graph|research|method  (дефолт cascades)
 *   ?window=24h|7d|30d                         (дефолт зависит от вкладки)
 *   ?cluster=<id>                              (деталь-панель каскада)
 */

export type CascadesTab = 'cascades' | 'stories' | 'graph' | 'research' | 'method'
export type CascadesWindow = '24h' | '7d' | '30d'

export interface CascadesParams {
  tab: CascadesTab
  window: CascadesWindow
  cluster: string | null
}

export const CASCADE_TABS: CascadesTab[] = ['cascades', 'stories', 'graph', 'research', 'method']

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
