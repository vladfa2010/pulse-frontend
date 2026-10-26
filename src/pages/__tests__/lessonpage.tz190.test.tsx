// ТЗ-190: прилипающее видео на мобильном портрете (sticky под стрипом
// прогресса) + кнопка «Свернуть» с размонтированием iframe.
// Критерии: класс только при живом embedUrl; сворачивание убирает iframe и
// показывает sticky-плашку; разворот восстанавливает; при videoFailed
// ни sticky, ни крестика.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LessonPage from '@/pages/LessonPage'

// jsdom не умеет IntersectionObserver (ленивые блоки конспекта) — штатный шим.
beforeAll(() => {
  class IO {
    observe() { setTimeout(() => this.cb([{ isIntersecting: true }], this), 0) }
    unobserve() {}
    disconnect() {}
    constructor(private cb: any, public opts?: any) {}
  }
  ;(globalThis as any).IntersectionObserver = IO
})

const fetchLessonMock = vi.fn()
const completeLessonMock = vi.fn().mockResolvedValue({ ok: true })

vi.mock('@/lib/educationApi', () => ({
  fetchLesson: (...args: unknown[]) => fetchLessonMock(...args),
  completeLesson: (...args: unknown[]) => completeLessonMock(...args),
  submitLessonTest: vi.fn(),
  materialDownloadPath: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  API_BASE: 'https://pulse.inside-trade.ru/api',
  api: { get: vi.fn().mockResolvedValue({}) },
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

const baseLesson = {
  id: 'l1',
  course_id: 'c1',
  course_slug: 'course',
  course_title: 'Курс',
  position: 1,
  title: 'Урок с видео',
  kind: 'video_text',
  text_content: '<p>Текст урока</p>',
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
  program: [{ id: 'l1', position: 1, title: 'Урок с видео', kind: 'video_text', duration_min: 10, completed: false }],
  prev: null,
  next: null,
  next_lesson: null,
  completed_lessons: 0,
  course_progress: { total_lessons: 1, completed_lessons: 0 },
}

const renderPage = (overrides: Record<string, unknown> = {}) => {
  fetchLessonMock.mockResolvedValue({ ...baseLesson, ...overrides })
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/education/lesson/l1']}>
        <Routes>
          <Route path="/education/lesson/:id" element={<LessonPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('LessonPage sticky-видео (ТЗ-190)', () => {
  it('живое видео: sticky-класс на контейнере, iframe и крестик на месте', async () => {
    const { container } = renderPage({ video_embed_url: 'https://www.youtube.com/watch?v=abc123' })
    await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy(), { timeout: 3000 })

    const sticky = container.querySelector('.lesson-video-sticky')
    expect(sticky).toBeTruthy()
    expect(sticky!.querySelector('iframe')).toBeTruthy()
    expect(sticky!.querySelector('.lesson-video-collapse-btn')).toBeTruthy()
  })

  it('крестик → iframe размонтирован, sticky-плашка с хостом и «Развернуть»', async () => {
    const { container } = renderPage({ video_embed_url: 'https://www.youtube.com/watch?v=abc123' })
    await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy(), { timeout: 3000 })

    fireEvent.click(screen.getByLabelText('Свернуть видео'))

    expect(container.querySelector('iframe')).toBeNull()
    const plaque = container.querySelector('.lesson-video-collapsed')
    expect(plaque).toBeTruthy()
    expect(plaque!.classList.contains('lesson-video-sticky')).toBe(true)
    expect(plaque!.textContent).toContain('Видео свёрнуто')
    expect(plaque!.textContent).toContain('YouTube')
    expect(plaque!.querySelector('.lesson-video-expand-btn')).toBeTruthy()
  })

  it('«Развернуть» → iframe возвращается, плашка исчезает', async () => {
    const { container } = renderPage({ video_embed_url: 'https://www.youtube.com/watch?v=abc123' })
    await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy(), { timeout: 3000 })

    fireEvent.click(screen.getByLabelText('Свернуть видео'))
    expect(container.querySelector('iframe')).toBeNull()

    fireEvent.click(screen.getByText('Развернуть'))
    await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy(), { timeout: 3000 })
    expect(container.querySelector('.lesson-video-collapsed')).toBeNull()
    expect(container.querySelector('.lesson-video-sticky iframe')).toBeTruthy()
  })

  it('урок без видео: sticky-класса и крестика нет (регрессия)', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('.edu-content')).toBeTruthy(), { timeout: 3000 })
    expect(container.querySelector('.lesson-video-sticky')).toBeNull()
    expect(container.querySelector('.lesson-video-collapse-btn')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
  })

  it('videoFailed: ни sticky, ни крестика — карточка ошибки в потоке', async () => {
    // Фейковые таймеры до рендера: компонент планирует ТЗ-165-таймауты уже на
    // них. onError iframe в jsdom не триггерится (React вешает его только на
    // медиа) — идём реальным путём ТЗ-165: 3 попытки × 15 с без onLoad →
    // videoFailed. Микротаски fetchLesson крутим act-ами.
    vi.useFakeTimers()
    try {
      const { container } = renderPage({ video_embed_url: 'https://www.youtube.com/watch?v=abc123' })
      for (let i = 0; i < 30 && !container.querySelector('iframe'); i++) await act(async () => {})
      expect(container.querySelector('iframe')).toBeTruthy()

      for (let i = 0; i < 3; i++) {
        act(() => { vi.advanceTimersByTime(16000) })
      }

      expect(container.querySelector('iframe')).toBeNull()
      expect(container.querySelector('.lesson-video-sticky')).toBeNull()
      expect(container.querySelector('.lesson-video-collapse-btn')).toBeNull()
      // ТЗ-165: карточка ошибки на месте (хост видео в тексте)
      expect(container.textContent).toContain('YouTube')
    } finally {
      vi.useRealTimers()
    }
  })
})
