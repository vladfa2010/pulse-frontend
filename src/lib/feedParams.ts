/**
 * =============================================================================
 * PULSE Frontend — Feed URL params helpers
 * =============================================================================
 *
 * Чистые функции для построения и чтения query-параметров страницы /feed.
 * Цель: URL — единый источник истины для tag/q, вся синхронизация лежит здесь.
 */

export interface FeedParams {
  tag: string | null
  q: string | null
}

/**
 * Собирает URLSearchParams для /feed.
 * Пустые значения не попадают в результат.
 * Порядок фиксирован: tag → q.
 */
export function buildFeedParams(tag: string | null, q: string | null): URLSearchParams {
  const params = new URLSearchParams()
  if (tag?.trim()) params.set('tag', tag.trim())
  if (q?.trim()) params.set('q', q.trim())
  return params
}

/**
 * Извлекает tag/q из URLSearchParams, нормализуя пустые строки в null.
 */
export function parseFeedParams(searchParams: URLSearchParams): FeedParams {
  return {
    tag: searchParams.get('tag')?.trim() || null,
    q: searchParams.get('q')?.trim() || null,
  }
}
