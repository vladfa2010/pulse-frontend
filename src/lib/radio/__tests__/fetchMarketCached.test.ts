/**
 * PULSE — Радио: тесты fetchMarketCached (ТЗ-55).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMarketCached } from '../fetchMarketCached'

describe('fetchMarketCached — read-only кэш крона (ТЗ-55)', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('204 → null (кэша нет, не ошибка)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 204, ok: false }))
    expect(await fetchMarketCached()).toBeNull()
  })

  it('200 + JSON → MarketSummary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          summary: 'Test summary',
          generated_at: '2026-09-23T12:00:00.000Z',
          articles_count: 187,
        }),
      })
    )
    const result = await fetchMarketCached()
    expect(result).toMatchObject({
      text: 'Test summary',
      freshCount: 187,
      segments: [{ role: 'single', text: 'Test summary' }],
    })
    expect(result?.createdAt).toBe(new Date('2026-09-23T12:00:00.000Z').getTime())
  })

  it('network error → null (без throw)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await fetchMarketCached()).toBeNull()
  })

  it('500 → null (без throw)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 500, ok: false }))
    expect(await fetchMarketCached()).toBeNull()
  })

  it('200 без summary → null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ summary: '', generated_at: null, articles_count: 0 }),
      })
    )
    expect(await fetchMarketCached()).toBeNull()
  })

  it('передаёт credentials: include (сессионная кука)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 204, ok: false })
    vi.stubGlobal('fetch', mockFetch)
    await fetchMarketCached()
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/user/summary-global/cached',
      expect.objectContaining({ credentials: 'include' })
    )
  })
})
