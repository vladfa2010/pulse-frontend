/**
 * PULSE — Радио: тесты fetchMarketDialog (ТЗ-57 v2, публичный доступ — ТЗ-64).
 *
 * Мокаем единый api-клиент (@/lib/api) — модуль не дёргает глобальный fetch
 * напрямую. ТЗ-64: endpoint публичный (optionalAuth) — гость без токена
 * получает тот же диалог, гость-чека нет.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: { get: (...args: any[]) => mocks.apiGet(...args) },
}))

import { fetchMarketDialog } from '../fetchMarketDialog'

describe('fetchMarketDialog — диалог сводки (ТЗ-57 v2 / ТЗ-64)', () => {
  beforeEach(() => {
    mocks.apiGet.mockReset()
  })

  it('гость и юзер — один путь: всегда дёргает api.get', async () => {
    mocks.apiGet.mockResolvedValue(null)
    expect(await fetchMarketDialog()).toBeNull()
    expect(mocks.apiGet).toHaveBeenCalledWith('/market/market-dialog')
  })

  it('204/пустой ответ → null (fallback на plain)', async () => {
    mocks.apiGet.mockResolvedValue(null)
    expect(await fetchMarketDialog()).toBeNull()
  })

  it('200 + segments → диалог', async () => {
    const segments = [
      { role: 'host', text: 'Открываем сводку' },
      { role: 'guest', text: 'Рынок в плюсе' },
    ]
    mocks.apiGet.mockResolvedValue({ segments })
    expect(await fetchMarketDialog()).toEqual(segments)
  })

  it('пустой segments → null', async () => {
    mocks.apiGet.mockResolvedValue({ segments: [] })
    expect(await fetchMarketDialog()).toBeNull()
  })

  it('401/5xx/network (api.get throw) → null', async () => {
    mocks.apiGet.mockRejectedValue(new Error('401'))
    expect(await fetchMarketDialog()).toBeNull()
  })
})
