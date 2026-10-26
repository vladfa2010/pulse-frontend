// ТЗ-189: «Глазами ученика» — проброс preview_token в запрос карточки,
// плашка предпросмотра вместо CTA записи/покупки при admin_preview,
// 404 без токена как раньше, регрессия опубликованного курса.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import CoursePage from '@/pages/CoursePage'
import type { PublicCourseCard } from '@/lib/educationApi'

beforeAll(() => {
  class IO {
    observe() { setTimeout(() => this.cb([{ isIntersecting: true }], this), 0) }
    unobserve() {}
    disconnect() {}
    constructor(private cb: any, public opts?: any) {}
  }
  ;(globalThis as any).IntersectionObserver = IO
})

const fetchPublicCourseMock = vi.fn()

vi.mock('@/lib/educationApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/educationApi')>('@/lib/educationApi')
  return {
    ...actual,
    fetchPublicCourse: (...args: unknown[]) => fetchPublicCourseMock(...args),
    fetchCourseEvents: vi.fn().mockResolvedValue({ events: [] }),
    fetchMyCourses: vi.fn().mockResolvedValue([]),
    enrollCourse: vi.fn(),
    unenrollCourse: vi.fn(),
    materialDownloadPath: vi.fn(),
  }
})

vi.mock('@/lib/api', () => ({
  API_BASE: 'https://pulse.inside-trade.ru/api',
  api: { get: vi.fn().mockResolvedValue([]) },
  getToken: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ isLoggedIn: true }) }))
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ toast: vi.fn(), toastError: vi.fn() }) }))
vi.mock('@/contexts/AuthModalContext', () => ({ useAuthModal: () => ({ open: vi.fn() }) }))
vi.mock('@/components/education/SuggestMaterialModal', () => ({ default: () => null }))
vi.mock('@/components/education/CourseKnowledgeGraph', () => ({ default: () => null }))
vi.mock('@/components/education/LessonChartBlock', () => ({
  default: () => null,
  readChartBlockAttrs: () => ({}),
}))
vi.mock('@/components/education/SafeHtmlContent', () => ({ SafeHtmlContent: ({ html }: { html: string }) => <div>{html}</div> }))

const baseCard: PublicCourseCard = {
  id: 'c1',
  slug: 'course',
  title: 'Тестовый курс',
  description: '<p>Описание</p>',
  cover_url: null,
  type: 'course',
  size: 'standard',
  price: 0,
  badges: [],
  author: null,
  category: null,
  tags: [],
  is_expired: false,
  relevant_until: null,
  my_enrollment: null,
  access_via_subscription: false,
  progress: null,
  program: [{ id: 'l1', position: 1, title: 'Урок 1', kind: 'video_text', duration_min: 10, is_free_preview: true, unlock_after_days: 0, locked_by_drip: false, unlock_in_days: null }],
  materials: [],
  locked_materials_count: 0,
}

const renderPage = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/education/:slug" element={<CoursePage />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('CoursePage preview_token (ТЗ-189)', () => {
  it('фетч уходит с ?preview_token= из URL', async () => {
    fetchPublicCourseMock.mockResolvedValue({ ...baseCard, admin_preview: true })
    renderPage('/education/course?preview_token=abc123')
    await waitFor(() => expect(fetchPublicCourseMock).toHaveBeenCalledWith('course', 'abc123'), { timeout: 3000 })
  })

  it('опубликованный курс без токена — запрос без токена (регрессия)', async () => {
    fetchPublicCourseMock.mockResolvedValue(baseCard)
    renderPage('/education/course')
    await waitFor(() => expect(fetchPublicCourseMock).toHaveBeenCalledWith('course', null), { timeout: 3000 })
  })

  it('admin_preview: плашка предпросмотра есть, CTA «Записаться» скрыта', async () => {
    fetchPublicCourseMock.mockResolvedValue({ ...baseCard, admin_preview: true })
    renderPage('/education/course?preview_token=abc123')
    await waitFor(() => expect(screen.getByText(/Предпросмотр: курс не опубликован/)).toBeTruthy(), { timeout: 3000 })
    expect(screen.queryByText('Записаться')).toBeNull()
    expect(screen.queryByText(/Купить курс/)).toBeNull()
  })

  it('без admin_preview: обычный CTA «Записаться» (регрессия)', async () => {
    fetchPublicCourseMock.mockResolvedValue(baseCard)
    renderPage('/education/course')
    await waitFor(() => expect(screen.getByText('Записаться')).toBeTruthy(), { timeout: 3000 })
    expect(screen.queryByText(/Предпросмотр: курс не опубликован/)).toBeNull()
  })

  it('404 без токена — «Курс не найден» как раньше', async () => {
    fetchPublicCourseMock.mockRejectedValue({ status: 404 })
    renderPage('/education/course')
    await waitFor(() => expect(screen.getByText('Курс не найден')).toBeTruthy(), { timeout: 3000 })
  })
})
