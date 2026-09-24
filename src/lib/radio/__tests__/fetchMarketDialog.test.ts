/**
 * PULSE — Радио: тесты fetchMarketDialog (ТЗ-57 v2).
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

import { fetchMarketDialog } from '../fetchMarketDialog'

describe('fetchMarketDialog — диалог сводки (ТЗ-57 v2)', () => {
  beforeEach(() => {
    mocks.apiGet.mockReset()
    mocks.state.hasToken = true
  })

  it('гость (без токена) → null, запроса нет', async () => {
    mocks.state.hasToken = false
    expect(await fetchMarketDialog()).toBeNull()
    expect(mocks.apiGet).not.toHaveBeenCalled()
  })

  it('204/пустой ответ → null (fallback на plain)', async () => {
    mocks.apiGet.mockResolvedValue(null)
    expect(await fetchMarketDialog()).toBeNull()
    expect(mocks.apiGet).toHaveBeenCalledWith('/market/market-dialog')
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
