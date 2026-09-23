/**
 * PULSE — Радио: тесты fetchMarketCached (ТЗ-55).
 *
 * Мокаем единый api-клиент (@/lib/api) и safeStorage — модуль не должен
 * дёргать глобальный fetch напрямую (токен передаётся через Bearer-заголовок
 * api-клиента, authMiddleware куку не читает).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  state: { hasToken: true },
}))

vi.mock('@/lib/api', () => ({
  api: { get: (...args: any[]) => mocks.apiGet(...args) },
}))

vi.mock('@/lib/safeStorage', () => ({
  safeStorage: {
    get: (key: string) => (key === 'pulse_token' && mocks.state.hasToken ? 'jwt-token' : null),
    remove: vi.fn(),
  },
}))

import { fetchMarketCached } from '../fetchMarketCached'

describe('fetchMarketCached — read-only кэш крона (ТЗ-55)', () => {
  beforeEach(() => {
    mocks.apiGet.mockReset()
    mocks.state.hasToken = true
  })

  it('гость (без токена) → null, запроса нет', async () => {
    mocks.state.hasToken = false
    expect(await fetchMarketCached()).toBeNull()
    expect(mocks.apiGet).not.toHaveBeenCalled()
  })

  it('204/пустой ответ → null (кэша нет, не ошибка)', async () => {
    mocks.apiGet.mockResolvedValue(null)
    expect(await fetchMarketCached()).toBeNull()
    expect(mocks.apiGet).toHaveBeenCalledWith('/user/summary-global/cached')
  })

  it('200 + JSON → MarketSummary', async () => {
    mocks.apiGet.mockResolvedValue({
      summary: 'Test summary',
      generated_at: '2026-09-23T12:00:00.000Z',
      articles_count: 187,
    })
    const result = await fetchMarketCached()
    expect(result).toMatchObject({
      text: 'Test summary',
      freshCount: 187,
      segments: [{ role: 'single', text: 'Test summary' }],
    })
    expect(result?.createdAt).toBe(new Date('2026-09-23T12:00:00.000Z').getTime())
  })

  it('network error → null (без throw)', async () => {
    mocks.apiGet.mockRejectedValue(new TypeError('network'))
    expect(await fetchMarketCached()).toBeNull()
  })

  it('500 → null (без throw)', async () => {
    const err: any = new Error('Ошибка 500')
    err.status = 500
    mocks.apiGet.mockRejectedValue(err)
    expect(await fetchMarketCached()).toBeNull()
  })

  it('ответ без summary → null', async () => {
    mocks.apiGet.mockResolvedValue({ summary: '', generated_at: null, articles_count: 0 })
    expect(await fetchMarketCached()).toBeNull()
  })
})
