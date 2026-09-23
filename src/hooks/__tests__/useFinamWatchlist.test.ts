/**
 * PULSE — Радио: тесты useFinamWatchlist (ТЗ-56).
 *
 * Хук идёт через единый api-клиент — мокаем @/lib/api (Bearer-заголовок,
 * не cookie: authMiddleware куку не читает).
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ apiGet: vi.fn() }))

vi.mock('@/lib/api', () => ({
  api: { get: (...args: any[]) => mocks.apiGet(...args) },
}))

import { useFinamWatchlist } from '../useFinamWatchlist'

const flush = () => act(() => Promise.resolve())

describe('useFinamWatchlist (ТЗ-56)', () => {
  beforeEach(() => {
    mocks.apiGet.mockReset()
    vi.useRealTimers()
  })

  it('гость (isLoggedIn=false) → пустой state, запроса нет', () => {
    const { result } = renderHook(() => useFinamWatchlist(false))
    expect(result.current.quotes).toEqual([])
    expect(result.current.empty).toBe(false)
    expect(mocks.apiGet).not.toHaveBeenCalled()
  })

  it('200 + quotes → state с quotes и currency', async () => {
    mocks.apiGet.mockResolvedValue({
      quotes: [
        { symbol: 'SBER@MISX', tag_id: 'sber', tag_name: 'Сбер', price: 280, changePct: 1.5, currency: 'RUB', ts: 1 },
        { symbol: 'AAPL@XNGS', tag_id: 'aapl', tag_name: 'Apple', price: 200, changePct: -0.5, currency: 'USD', ts: 1 },
      ],
      ts: 1,
    })
    const { result } = renderHook(() => useFinamWatchlist(true))
    await flush()
    expect(mocks.apiGet).toHaveBeenCalledWith('/market/watchlist-quotes')
    expect(result.current.quotes).toHaveLength(2)
    expect(result.current.quotes[0]).toMatchObject({ name: 'Сбер', price: 280, currency: 'RUB' })
    expect(result.current.offline).toBe(false)
    expect(result.current.empty).toBe(false)
    expect(result.current.lastUpdate).toBe(1)
  })

  it('200 + пустой массив → empty', async () => {
    mocks.apiGet.mockResolvedValue({ quotes: [], ts: 1 })
    const { result } = renderHook(() => useFinamWatchlist(true))
    await flush()
    expect(result.current.empty).toBe(true)
    expect(result.current.quotes).toEqual([])
  })

  it('ошибка после успеха → offline, последний успешный сохраняется', async () => {
    mocks.apiGet
      .mockResolvedValueOnce({
        quotes: [{ symbol: 'SBER@MISX', tag_id: 'sber', tag_name: 'Сбер', price: 280, changePct: 0, currency: 'RUB', ts: 1000 }],
        ts: 1000,
      })
      .mockRejectedValueOnce(new Error('network'))
    // Фейковые таймеры ДО монтирования — иначе setInterval создастся на реальных
    vi.useFakeTimers()
    const { result } = renderHook(() => useFinamWatchlist(true))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) }) // первый tick — успех
    expect(result.current.offline).toBe(false)
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) }) // второй tick — ошибка
    expect(result.current.quotes).toHaveLength(1) // последний успешный остался
    expect(result.current.offline).toBe(true)
    expect(result.current.error).toBe('network')
    expect(result.current.lastUpdate).toBe(1000)
  })

  it('503 market_unavailable на первом запросе → offline с пустым списком', async () => {
    const err: any = new Error('market_unavailable')
    err.status = 503
    mocks.apiGet.mockRejectedValue(err)
    const { result } = renderHook(() => useFinamWatchlist(true))
    await flush()
    expect(result.current.offline).toBe(true)
    expect(result.current.quotes).toEqual([])
    expect(result.current.lastUpdate).toBeNull()
  })
})
