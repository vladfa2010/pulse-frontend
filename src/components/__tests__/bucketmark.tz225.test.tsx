/**
 * =============================================================================
 * PULSE — ТЗ-225: unit-тест фидбека панели бакета (спиннер → галочка → close)
 * =============================================================================
 *
 * Прогон: npx vitest run src/components/__tests__/bucketmark.tz225.test.tsx
 * Кейсы ревьюера ТЗ-225: пропсы в frozen node не доходят → доставка контекстом;
 * закрытие делает панель (onClose замкнут на провайдере при создании).
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { BucketMarkContext } from '@/components/UnreadNewsCarousel'
import { BucketPanel } from '@/components/BucketSummaryCard'
import type { BucketPayload } from '@/types/news'

const bucket: BucketPayload = {
  key: 'night',
  label: 'Ночь',
  range_start: '2026-11-23T21:00:00.000Z',
  range_end: '2026-11-24T03:00:00.000Z',
  count: 5,
  sentiment: { pos: 2, neg: 1 },
  viral_stories: 0,
  summary: 'Сводка ночи',
  top_news: [
    { id: '1', slug: 's1', title: 'Новость 1', source: 'РБК', sentiment: 'positive' },
  ],
  generated_at: null,
}

function renderPanel(ctx: { marking: boolean; markDone: boolean }, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <BucketMarkContext.Provider value={ctx}>
        <BucketPanel bucket={bucket} onMarkRead={vi.fn()} onClose={onClose} />
      </BucketMarkContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); cleanup() })

describe('BucketPanel фидбек (ТЗ-225)', () => {
  it('marking: спиннер и disabled на кнопке', () => {
    renderPanel({ marking: true, markDone: false })
    const btn = screen.getByText(/Отметить прочитанными/).closest('button')!
    expect(btn.disabled).toBe(true)
    expect(btn.querySelector('svg.animate-spin')).toBeTruthy()
  })

  it('markDone: галочка, через 350мс — onClose', () => {
    const onClose = vi.fn()
    renderPanel({ marking: false, markDone: true }, onClose)
    const btn = screen.getByText(/Отметить прочитанными/).closest('button')!
    expect(btn.disabled).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(350) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('повторный markDone не дублирует close (cleanup таймера)', () => {
    const onClose = vi.fn()
    const { rerender } = renderPanel({ marking: false, markDone: false }, onClose)
    rerender(
      <MemoryRouter>
        <BucketMarkContext.Provider value={{ marking: false, markDone: true }}>
          <BucketPanel bucket={bucket} onMarkRead={vi.fn()} onClose={onClose} />
        </BucketMarkContext.Provider>
      </MemoryRouter>,
    )
    act(() => { vi.advanceTimersByTime(200) })
    rerender(
      <MemoryRouter>
        <BucketMarkContext.Provider value={{ marking: false, markDone: false }}>
          <BucketPanel bucket={bucket} onMarkRead={vi.fn()} onClose={onClose} />
        </BucketMarkContext.Provider>
      </MemoryRouter>,
    )
    rerender(
      <MemoryRouter>
        <BucketMarkContext.Provider value={{ marking: false, markDone: true }}>
          <BucketPanel bucket={bucket} onMarkRead={vi.fn()} onClose={onClose} />
        </BucketMarkContext.Provider>
      </MemoryRouter>,
    )
    act(() => { vi.advanceTimersByTime(350) })
    expect(onClose).toHaveBeenCalledTimes(1) // первый таймер снят cleanup'ом
  })
})
