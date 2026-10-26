// ТЗ-192: жёсткая фиксация прилипшего видео — на sticky-контейнере нет
// framer-motion (нет инлайнового transform/will-change). Контейнер рендерится
// обычным div, sticky-класс на месте, сворачивание по-прежнему размонтирует
// iframe (регрессия ТЗ-190).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, waitFor, cleanup, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LessonPage from '@/pages/LessonPage'

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

vi.mock('@/lib/educationApi', () => ({
  fetchLesson: (...args: unknown[]) => fetchLessonMock(...args),
  completeLesson: vi.fn().mockResolvedValue({ ok: true }),
  submitLessonTest: vi.fn(),
  materialDownloadPath: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  API_BASE: 'https://pulse.inside-trade.ru/api',
  api: { get: vi.fn().mockResolvedValue({}) },
}))

vi.mock('@/lib/useLessonAudio', () => ({
  useLessonAudio: () => ({
    disabled: true, playing: false, pct: 0, cur: 0, total: 0,
    speedLabel: '1×', browserVoice: false,
    toggle: () => {}, seekByFraction: () => {}, cycleSpeed: () => {},
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
  video_embed_url: 'https://www.youtube.com/watch?v=abc123',
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

const renderPage = () => {
  fetchLessonMock.mockResolvedValue(baseLesson)
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

describe('LessonPage жёсткая фиксация sticky-видео (ТЗ-192)', () => {
  it('контейнер видео — div без framer-инлайнов (нет transform/will-change)', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy(), { timeout: 3000 })

    const sticky = container.querySelector('.lesson-video-sticky') as HTMLElement
    expect(sticky).toBeTruthy()
    expect(sticky.tagName).toBe('DIV')
    // framer-motion оставил бы inline transform/will-change — их быть не должно
    expect(sticky.style.transform).toBe('')
    expect(sticky.style.willChange).toBe('')
    expect(sticky.style.opacity).toBe('')
    // iframe живёт внутри, sticky-класс не потерян
    expect(sticky.querySelector('iframe')).toBeTruthy()
  })

  it('после монтирования не появляется transform (анимация отсутствует)', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy(), { timeout: 3000 })
    // Прогоняем таймеры/кадры — framer при входной анимации выставил бы
    // промежуточные значения. Здесь инлайн-стили должны остаться пустыми.
    await act(async () => {})
    const sticky = container.querySelector('.lesson-video-sticky') as HTMLElement
    expect(sticky.style.transform).toBe('')
    expect(sticky.style.willChange).toBe('')
  })
})
