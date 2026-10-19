// ТЗ-181: детальный экран статистики курса (дрилл-даун из сводной табы ТЗ-180).
// Воронка с процентами, stacked bars с 4 сериями по полной оси дней,
// drop_vs_prev подсветка, «—» для null, топ-3 завальных вопросов.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import CourseStatsView from '../CourseStatsView'
import { C } from '../ui'
import type { CourseStats } from '../types'

const fetchCourseStatsMock = vi.fn()
const fetchEnrollmentsMock = vi.fn()

vi.mock('../api', () => ({
  fetchCourseStats: (...args: unknown[]) => fetchCourseStatsMock(...args),
  fetchEnrollments: (...args: unknown[]) => fetchEnrollmentsMock(...args),
}))

const hexToRgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

const stats: CourseStats = {
  course: { id: 'c1', title: 'Курс тест', status: 'published', type: 'course', lessons_count: 4, created_at: '2026-09-01' },
  period_days: 30,
  generated_at: '2026-10-19T12:00:00.000Z',
  funnel: { enrolled: 100, started: 50, halfway: 30, completed: 10 },
  sources: { free: 10, purchase: 40, subscription: 45, admin_grant: 5 },
  // бэк отдаёт только ненулевые дни — фронт достраивает ось до 30 дней
  activity_timeline: [
    { day: new Date(Date.now() - 86400000).toISOString().slice(0, 10), lesson_started: 4, test_attempt: 2, material_downloaded: 1, lesson_completed: 3 },
  ],
  active_7d: [
    { user_id: 'u1', username: 'Иван', email: 'ivan@test.ru', last_event_at: new Date(Date.now() - 2 * 3600000).toISOString(), events_7d: 7 },
  ],
  lessons: [
    {
      id: 'l1', position: 1, title: 'Вводный', completed: 50, pct_of_enrolled: 0.5,
      median_day: 0, drop_vs_prev: null, test_attempts: 10, test_pass_rate: 0.8, avg_score: 76,
      per_question: [],
    },
    {
      id: 'l2', position: 2, title: 'Стоппер', completed: 20, pct_of_enrolled: 0.2,
      median_day: 3, drop_vs_prev: -0.3, test_attempts: 5, test_pass_rate: 0.4, avg_score: 55,
      per_question: [{ q: 'Что такое спред?', attempts: 5, wrong_rate: 0.8 }],
    },
    {
      id: 'l3', position: 3, title: 'Пустой', completed: 0, pct_of_enrolled: 0,
      median_day: null, drop_vs_prev: -0.2, test_attempts: 0, test_pass_rate: null, avg_score: null,
      per_question: [],
    },
  ],
  materials: [
    { id: 'm1', title: 'Шпаргалка', kind: 'file', lesson_id: null, downloads: 12 },
    { id: 'm2', title: 'Мёртвый файл', kind: 'file', lesson_id: null, downloads: 0 },
  ],
}

const setup = () =>
  render(
    <CourseStatsView
      courseId="c1"
      days={30}
      onBack={() => {}}
      onOpenEditor={() => {}}
      toastError={() => {}}
    />,
  )

beforeEach(() => {
  vi.clearAllMocks()
  fetchCourseStatsMock.mockResolvedValue(stats)
  fetchEnrollmentsMock.mockResolvedValue([
    {
      user_id: 'u1', username: 'Иван', email: 'ivan@test.ru', is_blocked: false,
      source: 'purchase', payment_id: null, created_at: '2026-10-01',
      progress: { completed_lessons: 2, total_lessons: 4, percent: 50 },
    },
    {
      user_id: 'u2', username: 'Пётр', email: 'petr@test.ru', is_blocked: false,
      source: 'free', payment_id: null, created_at: '2026-10-02',
      progress: { completed_lessons: 0, total_lessons: 4, percent: 0 },
    },
  ])
})

afterEach(() => {
  cleanup()
})

describe('ТЗ-181: детальная статистика курса', () => {
  it('два запроса: stats за общий период + enrollments', async () => {
    setup()
    await waitFor(() => expect(fetchCourseStatsMock).toHaveBeenCalledWith('c1', 30))
    expect(fetchEnrollmentsMock).toHaveBeenCalledWith('c1')
  })

  it('воронка: подписи «N из 100 · %» и конверсия шага', async () => {
    setup()
    await waitFor(() => expect(screen.getByText(/50 из 100 · 50%/)).not.toBeNull())
    expect(screen.getByText(/30 из 100 · 30%/)).not.toBeNull()
    expect(screen.getByText(/10 из 100 · 10%/)).not.toBeNull()
    // конверсия шага между «Начали» и «Середина»: 30/50 = 60%
    expect(screen.getByText(/· шаг 60%/)).not.toBeNull()
  })

  it('stacked bars: 4 серии, полная ось дней (30 слотов, пустые — нулём)', async () => {
    setup()
    await waitFor(() => expect(screen.getByLabelText('Активность по дням')).not.toBeNull())
    const svg = screen.getByLabelText('Активность по дням')
    for (const label of ['Старт урока', 'Завершение', 'Тест', 'Материал']) {
      expect(svg.parentElement!.textContent).toContain(label)
    }
    const groups = svg.querySelectorAll('g[data-day]')
    expect(groups.length).toBe(30) // полная ось периода, не только ненулевые дни
  })

  it('кто записан: поиск фильтрует локально', async () => {
    setup()
    await waitFor(() => expect(screen.getAllByText('Иван').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Пётр').length).toBeGreaterThan(0)
    // прогресс «2/4» у Ивана ДО фильтра
    expect(screen.getByText('2/4')).not.toBeNull()
    fireEvent.change(screen.getByPlaceholderText(/Поиск по имени или email/), { target: { value: 'petr' } })
    // «Иван» остаётся только в блоке «Активные за 7 дней» (там тоже Иван),
    // из «Кто записан» он исчезает.
    expect(screen.queryAllByText('Иван')).toHaveLength(1)
    expect(screen.getByText('Пётр')).not.toBeNull()
  })

  it('активные за 7 дней: относительное время и счётчик', async () => {
    setup()
    await waitFor(() => expect(screen.getByText(/последнее событие: 2 ч назад/)).not.toBeNull())
    expect(screen.getByText('7 соб.')).not.toBeNull()
  })

  it('уроки: drop_vs_prev подсветка, «—» для null', async () => {
    setup()
    await waitFor(() => expect(screen.getAllByText(/Стоппер/).length).toBeGreaterThan(0))
    const warning = hexToRgb(C.warning)
    expect((screen.getByText('-30 п.п.').closest('td') as HTMLElement).style.color).toBe(warning)
    // первый урок — drop_vs_prev null → «—»; пустой урок — pass/ball «—»
    const row3 = screen.getByText(/Пустой/).closest('tr') as HTMLElement
    expect(row3.textContent).toContain('—')
  })

  it('топ-3 завальных вопросов с wrong_rate', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Что такое спред?')).not.toBeNull())
    expect(screen.getByText(/80% ошибок/)).not.toBeNull()
    expect(screen.getByText(/Стоппер · 5 попыток/)).not.toBeNull()
  })

  it('материалы: сортировка по скачиваниям, нулевые помечены', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Шпаргалка')).not.toBeNull())
    expect(screen.getByText('12 скач.')).not.toBeNull()
    expect(screen.getByText('0 — не скачивали')).not.toBeNull()
    // «Шпаргалка» (12) идёт раньше «Мёртвый файл» (0)
    const text = document.body.textContent || ''
    expect(text.indexOf('Шпаргалка')).toBeLessThan(text.indexOf('Мёртвый файл'))
  })
})
