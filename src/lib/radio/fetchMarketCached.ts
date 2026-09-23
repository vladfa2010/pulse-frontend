/**
 * PULSE — Радио: read-only кэш крона (ТЗ-55).
 *
 * GET /api/user/summary-global/cached — никогда не триггерит LLM (в отличие от
 * /api/user/summary-global). 204 No Content если кэша нет/протух — возвращаем
 * null, страница ретраит раз в 30с, пока крон не отработает (warm-up 3 мин
 * после boot VDS, далее каждые 6ч MSK).
 *
 * ВАЖНО: запрос идёт через единый клиент `api` (@/lib/api), который ставит
 * `Authorization: Bearer <jwt>` — authMiddleware бэкенда читает токен только
 * из заголовка (куку не читает). Прямой fetch с credentials:'include' давал
 * вечный 401 → спиннер у кнопки саммари.
 *
 * Без токена (гость) запрос не делаем вообще — endpoint требует авторизации,
 * а 401 через api-клиент чистил бы auth и спамил событиями logout (60 ретраев).
 *
 * Не бросает исключений: любая ошибка (network, 5xx, пустой summary) → null.
 */
import { api } from '@/lib/api'
import { safeStorage } from '@/lib/safeStorage'
import type { MarketSummary } from './summary'

export async function fetchMarketCached(): Promise<MarketSummary | null> {
  try {
    // Гость: кэш недоступен (endpoint под authMiddleware) — не дёргаем сеть
    if (!safeStorage.get('pulse_token')) return null

    // api.get: Bearer-заголовок автоматически; 204 → null; 401/5xx/network → throw
    const data = await api.get('/user/summary-global/cached')
    if (!data || !data.summary) return null
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
