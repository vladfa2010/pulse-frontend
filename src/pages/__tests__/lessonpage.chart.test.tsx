// ТЗ-143: регрессия — chart-block конспекта у ученика рендерится порталом
// (LessonChartBlock внутри div.chart-block из dangerouslySetInnerHTML).
// Пойманный на проде кейс: блок есть в text_content, но на странице пусто.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LessonPage from '@/pages/LessonPage'

// ─── Моки окружения ──────────────────────────────────────────────────────────

beforeAll(() => {
  // jsdom не умеет IntersectionObserver — LessonChartBlock ждёт его для ленивой
  // загрузки; сразу сообщаем «блок в вьюпорте», как в браузере.
  class IO {
    observe() { setTimeout(() => this.cb([{ isIntersecting: true }], this), 0) }
    unobserve() {}
    disconnect() {}
    constructor(private cb: any, public opts?: any) {}
  }
  ;(globalThis as any).IntersectionObserver = IO
})

vi.mock('@/lib/educationApi', () => ({
  fetchLesson: vi.fn().mockResolvedValue({
    id: 'l1',
    course_id: 'c1',
    course_slug: 'course',
    course_title: 'Курс',
    position: 1,
    title: 'Урок с графиком',
    kind: 'video',
    text_content:
      '<p>До графика</p>' +
      '<div class="chart-block" data-ticker="UVXY" data-exchange="BATS" data-tf="d1" data-range="3M" data-name="ProShares"></div>' +
      '<p>После графика</p>',
    video_source: null,
    video_embed_url: null,
    duration_min: 10,
    unlock_after_days: 0,
    buttons: [],
    materials: [],
    has_full_access: true,
    test: null,
    progress: { completed: false, test_score: null },
    total_lessons: 1,
    program: [{ id: 'l1', position: 1, title: 'Урок с графиком', kind: 'video', duration_min: 10, completed: false }],
    prev: null,
    next: null,
    next_lesson: null,
    completed_lessons: 0,
    course_progress: { total_lessons: 1, completed_lessons: 0 },
  }),
  completeLesson: vi.fn().mockResolvedValue({ ok: true }),
  submitLessonTest: vi.fn(),
  materialDownloadPath: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  API_BASE: 'https://pulse.inside-trade.ru/api',
  api: {
    get: vi.fn().mockResolvedValue({
      ticker: 'UVXY',
      exchange: 'BATS',
      exchange_name: 'CBOE BZX',
      tf: 'd1',
      range: '3M',
      timezone: 'America/New_York',
      times: ['2026-08-01', '2026-08-02'],
      ohlc: [[1, 2, 0.5, 3], [2, 1.5, 1, 2.5]],
      volumes: [100, 200],
    }),
  },
}))

// echarts в jsdom не нужен — CandleChart заменяем маркером.
vi.mock('@/components/CandleChart', () => ({
  default: (props: any) => <div data-testid="candle-chart" data-height={props.height} />,
}))

vi.mock('@/lib/useLessonAudio', () => ({
  useLessonAudio: () => ({
    disabled: true,
    playing: false,
    pct: 0,
    cur: 0,
    total: 0,
    speedLabel: '1×',
    browserVoice: false,
    toggle: () => {},
    seekByFraction: () => {},
    cycleSpeed: () => {},
  }),
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ isLoggedIn: true }) }))
vi.mock('@/contexts/AuthModalContext', () => ({ useAuthModal: () => ({ open: () => {} }) }))
vi.mock('@/lib/analytics', () => ({ logAnalyticsEvent: () => {} }))

// ─── Тест ────────────────────────────────────────────────────────────────────

describe('LessonPage chart-block (ТЗ-143)', () => {
  it('график монтируется в div.chart-block конспекта', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/education/lesson/l1']}>
          <Routes>
            <Route path="/education/lesson/:id" element={<LessonPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // Конспект отрендерился
    await waitFor(() => {
      expect(container.querySelector('.edu-content')).toBeTruthy()
    }, { timeout: 3000 })

    const block = container.querySelector('div.chart-block') as HTMLElement
    expect(block).toBeTruthy()

    // Портал: внутри div.chart-block появляется живой блок со свечами
    await waitFor(() => {
      expect(block.querySelector('.lesson-chart')).toBeTruthy()
    }, { timeout: 3000 })

    await waitFor(() => {
      expect(block.querySelector('[data-testid="candle-chart"]')).toBeTruthy()
      expect(block.querySelector('.lesson-chart-head')?.textContent).toContain('UVXY')
    }, { timeout: 3000 })
  })
})
