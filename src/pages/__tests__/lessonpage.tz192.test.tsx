// ТЗ-192: жёсткая фиксация прилипшего видео — на sticky-контейнере нет
// framer-motion (нет инлайнового transform/will-change). Контейнер рендерится
// обычным div, sticky-класс на месте, сворачивание по-прежнему размонтирует
// iframe (регрессия ТЗ-190). ТЗ-193: композитный слой на внутреннем контейнере,
// backdrop-filter снят, механизм --strip-h удалён.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, waitFor, cleanup, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'fs'
import { join } from 'path'
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

  it('ТЗ-193: iframe — во внутреннем контейнере lesson-video-frame (композитный слой)', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy(), { timeout: 3000 })

    const frame = container.querySelector('.lesson-video-frame') as HTMLElement
    expect(frame).toBeTruthy()
    // iframe лежит именно во фрейм-контейнере — translateZ(0) его изолирует
    expect(frame.querySelector('iframe')).toBeTruthy()
    // sticky-контейнер не совпадает с фрейм-контейнером: слой внутри, не на нём
    const sticky = container.querySelector('.lesson-video-sticky') as HTMLElement
    expect(sticky.contains(frame)).toBe(true)
    expect(sticky).not.toBe(frame)
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

describe('ТЗ-193: CSS-инварианты (index.css)', () => {
  const css = readFileSync(join(__dirname, '../../index.css'), 'utf8')

  it('backdrop-filter снят с кнопки сворачивания и свёрнутой плашки', () => {
    for (const cls of ['.lesson-video-collapse-btn', '.lesson-video-collapsed']) {
      const rule = css.match(new RegExp(`\\${cls}\\{[^}]*\\}`))
      expect(rule, `правило ${cls} существует`).toBeTruthy()
      expect(rule![0]).not.toContain('backdrop-filter')
      expect(rule![0]).not.toContain('-webkit-backdrop-filter')
    }
  })

  it('композитный слой — на внутреннем .lesson-video-frame, не на sticky', () => {
    const frame = css.match(/\.lesson-video-frame\{[^}]*\}/)
    expect(frame).toBeTruthy()
    expect(frame![0]).toContain('translateZ(0)')
    // на самом липком элементе трансформы запрещены (ТЗ-192 + страховка)
    const stickyRules = [...css.matchAll(/\.lesson-video-sticky\{[^}]*\}/g)].map((m) => m[0])
    const stickyMain = stickyRules.find((r) => r.includes('position:sticky'))
    expect(stickyMain, 'mobile-правило sticky с position:sticky').toBeTruthy()
    const norm = (s: string) => s.replace(/\s+/g, '')
    expect(norm(stickyMain!)).toContain('transform:none!important')
    expect(norm(stickyMain!)).toContain('will-change:auto!important')
    for (const r of stickyRules) expect(r).not.toContain('translateZ')
  })

  it('ТЗ-193: top видео — константа 64px, без --strip-h; стрип static на мобильном', () => {
    expect(css).not.toContain('--strip-h')
    const stickyMain = [...css.matchAll(/\.lesson-video-sticky\{[^}]*\}/g)]
      .map((m) => m[0])
      .find((r) => r.includes('position:sticky'))!
    expect(stickyMain).toContain('top:64px')
    // sticky-правило живёт в mobile-media; position:static стрипа — там же
    const media = css.match(/@media\(max-width:960px\) and \(orientation:portrait\)\{[\s\S]*?\n\}/)
    expect(media).toBeTruthy()
    expect(media![0]).toContain('.lesson-strip{position:static')
    expect(media![0]).toContain('.lesson-video-sticky{position:sticky')
    // глобально (десктоп) стрип остаётся sticky — ТЗ-127
    expect(css).toMatch(/\.lesson-strip\{position:sticky/)
  })

  it('карточка видео непрозрачная (фон #0a0a0a) — ничего не просвечивает', () => {
    const stickyBg = [...css.matchAll(/\.lesson-video-sticky\{[^}]*\}/g)]
      .map((m) => m[0])
      .find((r) => r.includes('background:#0a0a0a'))
    expect(stickyBg, 'фон задан правилом .lesson-video-sticky').toBeTruthy()
  })
})
