// ТЗ-146: регрессия — листание читалки идёт программным scrollLeft ленты
// .rm-strip (smooth при листании, instant при перепагинации), НЕ transform.
// transform на любом предке мультиколонки пробивает клипы движков
// (Chromium/WebKit рисуют соседние колонки поверх видимой области).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import ReadMode from '@/components/education/ReadMode'

// ─── Моки окружения ──────────────────────────────────────────────────────────

beforeAll(() => {
  // jsdom не умеет ResizeObserver (пересчёт пагинации при ресайзе).
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // jsdom не реализует Element.scrollTo — листание падает с TypeError.
  const scrollToMock = vi.fn()
  ;(globalThis as any).__scrollToMock = scrollToMock
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    writable: true,
    value: scrollToMock,
  })
  // jsdom отдаёт 0 для clientWidth/scrollWidth — пагинация и листание
  // уходили по раннему return. Эмулируем страницу шириной 600px, 3 страницы.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() { return 600 },
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() { return 1800 },
  })
})

vi.mock('@/lib/api', () => ({
  API_BASE: 'https://pulse.inside-trade.ru/api',
  api: { get: vi.fn().mockResolvedValue({}) },
}))
// echarts в jsdom не нужен — CandleChart заменяем маркером.
vi.mock('@/components/CandleChart', () => ({
  default: (props: any) => <div data-testid="candle-chart" data-height={props.height} />,
}))

// ─── Тест ────────────────────────────────────────────────────────────────────

const baseProps = {
  lessonId: 'l1',
  title: 'Урок',
  html: '<p>Текст конспекта</p>',
  open: true,
  onClose: () => {},
  onPageChange: () => {},
  onPages: () => {},
  readerScale: 1,
  allVisited: false,
  hasTest: false,
  completed: false,
  canComplete: false,
  onDone: () => {},
}

describe('ReadMode листание (ТЗ-146)', () => {
  it('листание — scrollTo ленты: smooth к странице, instant при пагинации', async () => {
    render(<ReadMode {...baseProps} page={2} pages={3} />)

    const strip = document.body.querySelector('.rm-strip') as HTMLElement
    const content = document.body.querySelector('.rm-page .content') as HTMLElement
    expect(strip).toBeTruthy()
    expect(content).toBeTruthy()
    // strip — прямая обёртка .content внутри .rm-page
    expect(strip.parentElement?.classList.contains('rm-page')).toBe(true)
    expect(strip.firstElementChild).toBe(content)

    const scrollToMock = (globalThis as any).__scrollToMock as ReturnType<typeof vi.fn>

    // Листание: scrollTo({left: (page-1)*step, behavior:'smooth'}) на ленте.
    // transform на ленте/контенте не используется (проверено grep-ом критерия §9 —
    // здесь фиксируем поведение: шаг 600px, страница 2 → left 600).
    await waitFor(() => {
      expect(scrollToMock).toHaveBeenCalledWith({ left: 600, behavior: 'smooth' })
    }, { timeout: 3000 })
    // Перепагинация восстанавливает позицию мгновенно (instant, без анимации)
    await waitFor(() => {
      expect(scrollToMock).toHaveBeenCalledWith({ left: 600, behavior: 'instant' })
    }, { timeout: 3000 })
    expect(content.style.transform).toBe('')
    expect(strip.style.transform).toBe('')
  })
})
