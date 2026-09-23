/**
 * PULSE — Радио: read-only кэш крона (ТЗ-55).
 *
 * GET /api/user/summary-global/cached — никогда не триггерит LLM (в отличие от
 * /api/user/summary-global). 204 No Content если кэша нет/протух — возвращаем
 * null, страница ретраит раз в 30с, пока крон не отработает (warm-up 3 мин
 * после boot VDS, далее каждые 6ч MSK).
 *
 * Не бросает исключений: любая ошибка (network, 5xx, пустой summary) → null.
 */
import type { MarketSummary } from './summary'

export async function fetchMarketCached(): Promise<MarketSummary | null> {
  try {
    const res = await fetch('/api/user/summary-global/cached', {
      credentials: 'include',
    })
    if (res.status === 204) return null
    if (!res.ok) return null
    const data = (await res.json()) as {
      summary: string
      generated_at: string | null
      articles_count: number
    }
    if (!data.summary) return null
    return {
      id: `cached-${data.generated_at ?? Date.now()}`,
      text: data.summary,
      segments: [{ role: 'single', text: data.summary }],
      createdAt: data.generated_at ? new Date(data.generated_at).getTime() : Date.now(),
      freshCount: data.articles_count,
    }
  } catch {
    return null
  }
}
