/**
 * PULSE — Радио: read-only кэш крона (ТЗ-55, публичный доступ — ТЗ-64).
 *
 * GET /api/public/summary-global — публичный read-only кэш крона. НИКОГДА не
 * триггерит LLM (в отличие от /api/user/summary-global). 404 если кэша нет /
 * протух — возвращаем null, страница ретраит раз в 30с, пока крон не отработает
 * (warm-up 3 мин после boot VDS, далее каждые 6ч MSK).
 *
 * ТЗ-64: endpoint публичный и работает для гостя и юзера одинаково — единый
 * кодовый путь без ветвления по токену. Токен (если есть) api-клиент подставит
 * сам, роут его просто игнорирует (auth middleware там нет).
 *
 * Не бросает исключений: любая ошибка (network, 5xx, 404, пустой summary) → null.
 */
import { api } from '@/lib/api'
import type { MarketSummary } from './summary'

export async function fetchMarketCached(): Promise<MarketSummary | null> {
  try {
    const data = (await api.get('/public/summary-global')) as {
      summary?: string
      generated_at?: string | number
      articles_count?: number
    }
    if (!data || !data.summary) return null
    return {
      id: `cached-${data.generated_at ?? Date.now()}`,
      text: data.summary,
      segments: [{ role: 'single', text: data.summary }],
      createdAt: data.generated_at ? new Date(data.generated_at).getTime() : Date.now(),
      freshCount: data.articles_count ?? 0,
    }
  } catch {
    return null
  }
}
