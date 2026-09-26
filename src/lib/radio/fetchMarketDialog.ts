/**
 * PULSE — Радио: получить диалог сводки (ТЗ-57 v2, публичный доступ — ТЗ-64).
 *
 * GET /api/market/market-dialog → { segments: RadioSegment[] } или 204.
 *
 * Запрос идёт через единый клиент `api` (@/lib/api) — Bearer-заголовок при
 * наличии токена. Endpoint с ТЗ-64 публичный (optionalAuth): гость без токена
 * получает тот же диалог (кэш бэка общий, один на всех).
 *
 * Не бросает: 204/5xx/network/пустой segments → null (fallback на plain text).
 */
import { api } from '@/lib/api'
import type { RadioSegment } from '@/types/radio'

export async function fetchMarketDialog(): Promise<RadioSegment[] | null> {
  try {
    // api.get: Bearer-заголовок автоматически (если токен есть); 204 → null;
    // 401/5xx/network → throw → null
    const data = await api.get('/market/market-dialog')
    if (!data || !Array.isArray(data.segments) || data.segments.length === 0) {
      return null
    }
    return data.segments as RadioSegment[]
  } catch {
    return null
  }
}
