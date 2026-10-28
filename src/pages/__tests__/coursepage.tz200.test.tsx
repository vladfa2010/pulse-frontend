// ТЗ-200: баннер «не опубликован» только для неопубликованных курсов.
// published + admin_preview → фиолетового баннера нет, CTA видны как у ученика,
// тонкая muted-плашка «как админ»; draft/archived + admin_preview → баннер и
// скрытые CTA (регрессия ТЗ-189); записанный админ — чистый вид ученика.
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
  status: 'published',
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

const BANNER = /Предпросмотр: курс не опубликован/
const ADMIN_PLATE = /Вы смотрите как админ/

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

describe('CoursePage ТЗ-200: previewMode по статусу курса', () => {
  it('published + admin_preview: фиолетового баннера НЕТ, CTA «Записаться» виден, muted-плашка есть', async () => {
    fetchPublicCourseMock.mockResolvedValue({ ...baseCard, admin_preview: true })
    renderPage('/education/course')
    await waitFor(() => expect(screen.getByText('Записаться')).toBeTruthy(), { timeout: 3000 })
    expect(screen.queryByText(BANNER)).toBeNull()
    expect(screen.getByText(ADMIN_PLATE)).toBeTruthy()
  })

  it('draft + admin_preview: баннер есть, CTA скрыты (регрессия ТЗ-189)', async () => {
    fetchPublicCourseMock.mockResolvedValue({ ...baseCard, status: 'draft', admin_preview: true })
    renderPage('/education/course?preview_token=abc123')
    await waitFor(() => expect(screen.getByText(BANNER)).toBeTruthy(), { timeout: 3000 })
    expect(screen.queryByText('Записаться')).toBeNull()
    expect(screen.queryByText(ADMIN_PLATE)).toBeNull()
  })

  it('archived + admin_preview: баннер есть, CTA скрыты', async () => {
    fetchPublicCourseMock.mockResolvedValue({ ...baseCard, status: 'archived', admin_preview: true })
    renderPage('/education/course?preview_token=abc123')
    await waitFor(() => expect(screen.getByText(BANNER)).toBeTruthy(), { timeout: 3000 })
    expect(screen.queryByText('Записаться')).toBeNull()
  })

  it('записанный админ (admin_preview=false): ни баннера, ни плашки, вид ученика', async () => {
    fetchPublicCourseMock.mockResolvedValue({
      ...baseCard,
      my_enrollment: { source: 'admin_grant', created_at: '2026-10-27T00:00:00Z' },
      progress: { completed_lessons: 0, total_lessons: 1, percent: 0 },
    })
    renderPage('/education/course')
    await waitFor(() => expect(screen.getByText(/Вы записаны/)).toBeTruthy(), { timeout: 3000 })
    expect(screen.queryByText(BANNER)).toBeNull()
    expect(screen.queryByText(ADMIN_PLATE)).toBeNull()
  })

  it('гость на published: никаких плашек (регрессия основного флоу)', async () => {
    fetchPublicCourseMock.mockResolvedValue(baseCard)
    renderPage('/education/course')
    await waitFor(() => expect(screen.getByText('Записаться')).toBeTruthy(), { timeout: 3000 })
    expect(screen.queryByText(BANNER)).toBeNull()
    expect(screen.queryByText(ADMIN_PLATE)).toBeNull()
  })
})
