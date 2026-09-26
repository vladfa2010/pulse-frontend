/**
 * PULSE — Радио: тесты fetchMarketCached (ТЗ-55, публичный доступ — ТЗ-64).
 *
 * Мокаем единый api-клиент (@/lib/api) — модуль не дёргает глобальный fetch
 * напрямую. ТЗ-64: endpoint стал публичным (/api/public/summary-global) и
 * работает для гостя и юзера одинаково — ветки по токену нет.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: { get: (...args: any[]) => mocks.apiGet(...args) },
}))

import { fetchMarketCached } from '../fetchMarketCached'

describe('fetchMarketCached — read-only кэш крона (ТЗ-55/ТЗ-64)', () => {
  beforeEach(() => {
    mocks.apiGet.mockReset()
  })

  it('404/ошибка (кэша нет) → null, не throw', async () => {
    const err: any = new Error('Ошибка 404')
    err.status = 404
    mocks.apiGet.mockRejectedValue(err)
    expect(await fetchMarketCached()).toBeNull()
    expect(mocks.apiGet).toHaveBeenCalledWith('/public/summary-global')
  })

  it('200 + JSON → MarketSummary (гость и юзер — один путь)', async () => {
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
