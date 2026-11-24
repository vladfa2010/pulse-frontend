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
import { render, screen, act } from '@testing-library/react'
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

const baseCtx = { marking: false, markDone: false, markAllSignal: 0, pendingOpenKey: null, clearPendingOpen: () => {} }

function renderPanel(ctx: Partial<typeof baseCtx>, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <BucketMarkContext.Provider value={{ ...baseCtx, ...ctx }}>
        <BucketPanel bucket={bucket} onMarkRead={vi.fn()} onClose={onClose} />
      </BucketMarkContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); cleanup() })

describe('BucketPanel фидбек (ТЗ-225)', () => {
  it('markAllSignal: «Прочитать всё» закрывает открытую панель', () => {
    const onClose = vi.fn()
    const { rerender } = renderPanel({ marking: false, markDone: false, markAllSignal: 0, pendingOpenKey: null, clearPendingOpen: () => {} }, onClose)
    expect(onClose).not.toHaveBeenCalled()
    rerender(
      <MemoryRouter>
        <BucketMarkContext.Provider value={{ marking: false, markDone: false, markAllSignal: 1, pendingOpenKey: null, clearPendingOpen: () => {} }}>
          <BucketPanel bucket={bucket} onMarkRead={vi.fn()} onClose={onClose} />
        </BucketMarkContext.Provider>
      </MemoryRouter>,
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('marking: спиннер и disabled на кнопке', () => {
    renderPanel({ marking: true, markDone: false, markAllSignal: 0, pendingOpenKey: null, clearPendingOpen: () => {} })
    const btn = screen.getByText(/Отметить прочитанными/).closest('button')!
    expect(btn.disabled).toBe(true)
    expect(btn.querySelector('svg.animate-spin')).toBeTruthy()
  })

  it('markDone: галочка, через 350мс — onClose', () => {
    const onClose = vi.fn()
    renderPanel({ marking: false, markDone: true, markAllSignal: 0, pendingOpenKey: null, clearPendingOpen: () => {} }, onClose)
    const btn = screen.getByText(/Отметить прочитанными/).closest('button')!
    expect(btn.disabled).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(350) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('повторный markDone не дублирует close (cleanup таймера)', () => {
    const onClose = vi.fn()
    const { rerender } = renderPanel({ marking: false, markDone: false, markAllSignal: 0, pendingOpenKey: null, clearPendingOpen: () => {} }, onClose)
    rerender(
      <MemoryRouter>
        <BucketMarkContext.Provider value={{ marking: false, markDone: true, markAllSignal: 0, pendingOpenKey: null, clearPendingOpen: () => {} }}>
          <BucketPanel bucket={bucket} onMarkRead={vi.fn()} onClose={onClose} />
        </BucketMarkContext.Provider>
      </MemoryRouter>,
    )
    act(() => { vi.advanceTimersByTime(200) })
    rerender(
      <MemoryRouter>
        <BucketMarkContext.Provider value={{ marking: false, markDone: false, markAllSignal: 0, pendingOpenKey: null, clearPendingOpen: () => {} }}>
          <BucketPanel bucket={bucket} onMarkRead={vi.fn()} onClose={onClose} />
        </BucketMarkContext.Provider>
      </MemoryRouter>,
    )
    rerender(
      <MemoryRouter>
        <BucketMarkContext.Provider value={{ marking: false, markDone: true, markAllSignal: 0, pendingOpenKey: null, clearPendingOpen: () => {} }}>
          <BucketPanel bucket={bucket} onMarkRead={vi.fn()} onClose={onClose} />
        </BucketMarkContext.Provider>
      </MemoryRouter>,
    )
    act(() => { vi.advanceTimersByTime(350) })
    expect(onClose).toHaveBeenCalledTimes(1) // первый таймер снят cleanup'ом
  })
})

// ─── ТЗ-226: deep link — карточка раскрывает панель по pendingOpenKey ─────────
import CascadeExpandProvider, { useCascadeExpand } from '@/components/CascadeExpandProvider'
import BucketSummaryCard from '@/components/BucketSummaryCard'

let lastState: { expanded: boolean; bucketKey: string | null } = { expanded: false, bucketKey: null }
function Spy() {
  const ctx = useCascadeExpand()
  lastState = { expanded: ctx?.expandedContent != null, bucketKey: ctx?.expandedBucketKey ?? null }
  return null
}

describe('ТЗ-226: deep link /?bucket=<key>', () => {
  it('регрессия композиции: BucketMarkContext.Provider оборачивает buckets.map в карусели', () => {
    // Блокер ревью ТЗ-226: карточки вне провайдера получали дефолтный контекст и
    // deep link не работал. Ловим порядок JSX в исходнике карусели.
    const fs = require('fs')
    const src = fs.readFileSync('src/components/UnreadNewsCarousel.tsx', 'utf8')
    const providerIdx = src.indexOf('<BucketMarkContext.Provider')
    const bucketsIdx = src.indexOf('{buckets')
    expect(providerIdx).toBeGreaterThan(-1)
    expect(bucketsIdx).toBeGreaterThan(-1)
    expect(providerIdx).toBeLessThan(bucketsIdx)
  })

  it('pendingOpenKey раскрывает панель и зовёт clearPendingOpen', () => {
    const clearPendingOpen = vi.fn()
    const ctxValue = { ...baseCtx, pendingOpenKey: 'night' as string | null, clearPendingOpen }
    const { rerender } = render(
      <MemoryRouter>
        <BucketMarkContext.Provider value={ctxValue}>
          <CascadeExpandProvider>
            <BucketSummaryCard bucket={bucket} onMarkRead={vi.fn()} />
            <Spy />
          </CascadeExpandProvider>
        </BucketMarkContext.Provider>
      </MemoryRouter>,
    )
    expect(lastState.expanded && lastState.bucketKey === 'night').toBe(true)
    expect(clearPendingOpen).toHaveBeenCalled()
    // повторный рендер с тем же ключем не должен тогглить (закрывать) панель:
    // после раскрытия pendingOpenKey обычно null — имитируем сброс
    rerender(
      <MemoryRouter>
        <BucketMarkContext.Provider value={{ ...ctxValue, pendingOpenKey: null }}>
          <CascadeExpandProvider>
            <BucketSummaryCard bucket={bucket} onMarkRead={vi.fn()} />
            <Spy />
          </CascadeExpandProvider>
        </BucketMarkContext.Provider>
      </MemoryRouter>,
    )
    expect(lastState.expanded).toBe(true)
  })
})
