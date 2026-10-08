// ТЗ-143/144: регрессия — chart-block конспекта монтируется порталом и в читалке
// (ReadMode), не только на странице урока. Прод-кейс: блок есть в text_content,
// бэкенд отдаёт, но в читалке пусто.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReadMode from '@/components/education/ReadMode'
import type { LessonContent } from '@/lib/educationApi'

// ─── Моки окружения ──────────────────────────────────────────────────────────

beforeAll(() => {
  // jsdom не умеет ResizeObserver (пересчёт пагинации при ресайзе).
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // jsdom не умеет IntersectionObserver — LessonChartBlock ждёт его для ленивой
  // загрузки; сразу сообщаем «блок в вьюпорте», как в браузере.
  class IO {
    observe() { setTimeout(() => this.cb([{ isIntersecting: true }], this), 0) }
    unobserve() {}
    disconnect() {}
    constructor(private cb: any, public opts?: any) {}
  }
  ;(globalThis as any).IntersectionObserver = IO
  // jsdom не реализует Element.scrollTo — пагинация падает с TypeError.
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })
  // jsdom отдаёт 0 для clientWidth/scrollWidth — эмулируем одну страницу.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() { return 600 },
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() { return 600 },
  })
})

vi.mock('@/lib/api', () => ({
  API_BASE: 'https://pulse.inside-trade.ru/api',
  api: {
    get: vi.fn().mockResolvedValue({
      ticker: 'SBER',
      exchange: 'MOEX',
      exchange_name: 'MOSCOW EXCHANGE',
      tf: 'd1',
      range: '3M',
      timezone: 'Europe/Moscow',
      times: ['2026-09-01', '2026-09-02'],
      ohlc: [[250, 252, 249, 251], [251, 253, 250, 252]],
      volumes: [1000, 1200],
    }),
  },
}))
// echarts в jsdom не нужен — CandleChart заменяем маркером.
vi.mock('@/components/CandleChart', () => ({
  default: (props: any) => <div data-testid="candle-chart" data-height={props.height} />,
}))

// Читалка рендерится createPortal в document.body — без cleanup порталы
// накапливаются между тестами и портят селекторы.
afterEach(cleanup)

// ─── Тест ────────────────────────────────────────────────────────────────────

const baseProps = {
  lessonId: 'l1',
  title: 'Урок с графиком',
  html:
    '<p><strong>Вступление</strong></p>' +
    '<div class="chart-block" data-ticker="SBER" data-exchange="MOEX" data-tf="d1" data-range="3M" data-name="Сбербанк"></div>' +
    '<p>Дальше текст</p>',
  open: true,
  onClose: () => {},
  page: 1,
  onPageChange: () => {},
  pages: 1,
  onPages: () => {},
  readerScale: 1,
  allVisited: true,
  hasTest: false,
  completed: false,
  canComplete: true,
  onDone: () => {},
  nextLesson: null as LessonContent['next_lesson'],
  courseSlug: 'course',
}

describe('ReadMode chart-block (ТЗ-143/144)', () => {
  it('график монтируется в div.chart-block конспекта внутри читалки', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<ReadMode {...baseProps} />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // Контент читалки отрендерился (портал в body)
    await waitFor(() => {
      expect(document.body.querySelector('.rm-page .content.edu-content')).toBeTruthy()
    }, { timeout: 3000 })

    const block = document.body.querySelector('div.chart-block') as HTMLElement
    expect(block).toBeTruthy()

    // Портал: внутри div.chart-block появляется живой блок со свечами
    await waitFor(() => {
      expect(block.querySelector('.lesson-chart')).toBeTruthy()
    }, { timeout: 3000 })

    await waitFor(() => {
      expect(block.querySelector('[data-testid="candle-chart"]')).toBeTruthy()
      expect(block.querySelector('.lesson-chart-head')?.textContent).toContain('SBER')
    }, { timeout: 3000 })
  })
})
