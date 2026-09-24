/**
 * PULSE — Радио: получить диалог сводки (ТЗ-57 v2).
 *
 * GET /api/market/market-dialog → { segments: RadioSegment[] } или 204.
 *
 * ВАЖНО (повторяет fetchMarketCached): запрос идёт через единый клиент `api`
 * (@/lib/api) — Bearer-заголовок. authMiddleware бэкенда куку не читает,
 * прямой fetch с credentials:'include' давал бы вечный 401 → диалог никогда
 * не заработал бы. Гость (без токена) запрос не делает вообще.
 *
 * Не бросает: 204/5xx/network/пустой segments → null (fallback на plain text).
 */
import { api } from '@/lib/api'
import { safeStorage } from '@/lib/safeStorage'
import type { RadioSegment } from '@/types/radio'

export async function fetchMarketDialog(): Promise<RadioSegment[] | null> {
  try {
    if (!safeStorage.get('pulse_token')) return null

    // api.get: Bearer-заголовок автоматически; 204 → null; 401/5xx/network → throw
    const data = await api.get('/market/market-dialog')
    if (!data || !Array.isArray(data.segments) || data.segments.length === 0) {
      return null
    }
    return data.segments as RadioSegment[]
  } catch {
    return null
  }
}
