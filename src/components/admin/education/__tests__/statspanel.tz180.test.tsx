// ТЗ-180: под-вкладка «Статистика» в табе «Образование» админки.
// Один запрос fetchStatsOverview(days) на период, локальная сортировка,
// «—» для null-метрик, янтарная подсветка при низкой конверсии (≥10 записей).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import StatsPanel from '../StatsPanel'
import { C } from '../ui'
import type { EduStatsOverview } from '../types'

const fetchStatsOverviewMock = vi.fn()

vi.mock('../api', () => ({
  fetchStatsOverview: (...args: unknown[]) => fetchStatsOverviewMock(...args),
}))

// Курс A: ≥10 записей за период и низкая конверсия — обе янтарные подсветки.
const courseA = {
  id: 'a', title: 'Курс A', status: 'published', type: 'course',
  lessons_count: 5,
  enrolled_period: 12, enrolled_total: 40,
  started_period: 2, start_rate: 2 / 12,
  completed_total: 2, completion_rate: 2 / 40,
  test_attempts_period: 5, test_pass_rate: 0.6, avg_test_score: 7.5,
  materials_downloads_period: 3, active_learners_7d: 4,
}
// Курс B: записей за период 0 — start_rate null → «—».
const courseB = {
  id: 'b', title: 'Курс B', status: 'archived', type: 'course',
  lessons_count: 2,
  enrolled_period: 0, enrolled_total: 10,
  started_period: 0, start_rate: null,
  completed_total: 0, completion_rate: 0,
  test_attempts_period: 0, test_pass_rate: null, avg_test_score: null,
  materials_downloads_period: 0, active_learners_7d: 0,
}
// Курс C: больше всех записей за период — первый при сортировке по умолчанию.
const courseC = {
  id: 'c', title: 'Курс C', status: 'published', type: 'course',
  lessons_count: 8,
  enrolled_period: 20, enrolled_total: 25,
  started_period: 15, start_rate: 0.75,
  completed_total: 5, completion_rate: 0.2,
  test_attempts_period: 10, test_pass_rate: 0.8, avg_test_score: 8,
  materials_downloads_period: 7, active_learners_7d: 9,
}

const overview: EduStatsOverview = {
  period_days: 30,
  generated_at: '2026-10-19T12:00:00.000Z',
  courses: [courseB, courseA, courseC], // порядок от бэка не важен — фронт сортирует
}

const rowOf = (title: string): HTMLTableRowElement =>
  screen.getByText(title).closest('tr') as HTMLTableRowElement

// jsdom нормализует style.color в rgb() — приводим константу к тому же виду.
const hexToRgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchStatsOverviewMock.mockResolvedValue(overview)
})

afterEach(() => {
  cleanup()
})

describe('ТЗ-180: сводная статистика обучения', () => {
  it('ленивая загрузка при маунте: один запрос за период 30 дней', async () => {
    render(<StatsPanel onOpenCourse={() => {}} toast={() => {}} toastError={() => {}} />)
    await waitFor(() => expect(fetchStatsOverviewMock).toHaveBeenCalledWith(30))
    await waitFor(() => expect(screen.getByText('Курс C')).not.toBeNull())
    expect(fetchStatsOverviewMock).toHaveBeenCalledTimes(1)
  })

  it('сортировка по умолчанию: больше записей за период — выше', async () => {
    render(<StatsPanel onOpenCourse={() => {}} toast={() => {}} toastError={() => {}} />)
    await waitFor(() => expect(screen.getByText('Курс C')).not.toBeNull())
    const body = screen.getByText('Курс C').closest('tbody') as HTMLElement
    const firstCell = body.querySelector('tr td div') as HTMLElement
    expect(firstCell.textContent).toBe('Курс C')
  })

  it('null-метрика → «—», а не 0%', async () => {
    render(<StatsPanel onOpenCourse={() => {}} toast={() => {}} toastError={() => {}} />)
    await waitFor(() => expect(screen.getByText('Курс B')).not.toBeNull())
    const row = rowOf('Курс B')
    const cells = row.querySelectorAll('td')
    // ячейки: 0=Курс, 1=Уроков, 2=Записи, 3=Начали %, 4=Прошли, 5=Тесты, 6=Скачивания, 7=Активных 7д
    // «Начали %»: start_rate null → «—»
    expect(cells[3].textContent).toBe('—')
    // «Тесты» без попыток → «—»
    expect(cells[5].textContent).toBe('—')
  })

  it('низкая конверсия при ≥10 записей подсвечивается янтарным', async () => {
    render(<StatsPanel onOpenCourse={() => {}} toast={() => {}} toastError={() => {}} />)
    await waitFor(() => expect(screen.getByText('Курс A')).not.toBeNull())
    const row = rowOf('Курс A')
    const cells = row.querySelectorAll('td')
    const warning = hexToRgb(C.warning)
    expect((cells[3] as HTMLElement).style.color).toBe(warning) // start_rate
    expect((cells[4] as HTMLElement).style.color).toBe(warning) // completion_rate
    // У курса C конверсии нормальные — без подсветки.
    const rowC = rowOf('Курс C').querySelectorAll('td')
    expect((rowC[3] as HTMLElement).style.color).toBe('')
  })

  it('сводные чипы — суммы по всем курсам за период', async () => {
    render(<StatsPanel onOpenCourse={() => {}} toast={() => {}} toastError={() => {}} />)
    await waitFor(() => expect(screen.getByText(/Записей 32/)).not.toBeNull())
    // enrolled 12+0+20=32; started 2+0+15=17 → 53%
    expect(screen.getByText(/Начали 17 \(53%\)/)).not.toBeNull()
    expect(screen.getByText(/Скачиваний материалов 10/)).not.toBeNull()
    expect(screen.getByText(/Попыток тестов 15/)).not.toBeNull()
  })

  it('клик по заголовку переключает сортировку', async () => {
    render(<StatsPanel onOpenCourse={() => {}} toast={() => {}} toastError={() => {}} />)
    await waitFor(() => expect(screen.getByText('Курс C')).not.toBeNull())
    // Первый клик по новому ключу — по убыванию (0.75 > 0.167 > null): C остаётся первым.
    fireEvent.click(screen.getByText(/^Начали %/))
    let body = screen.getByText('Курс C').closest('tbody') as HTMLElement
    expect((body.querySelector('tr td div') as HTMLElement).textContent).toBe('Курс C')
    // Второй клик — по возрастанию: null (B) первым, затем 0.167 (A), потом 0.75 (C).
    fireEvent.click(screen.getByText(/^Начали %/))
    body = screen.getByText('Курс C').closest('tbody') as HTMLElement
    const firstTitles = [...body.querySelectorAll('tr')].map(
      tr => (tr.querySelector('td div') as HTMLElement).textContent,
    )
    expect(firstTitles).toEqual(['Курс B', 'Курс A', 'Курс C'])
  })

  it('клик по строке открывает редактор курса', async () => {
    const onOpenCourse = vi.fn()
    render(<StatsPanel onOpenCourse={onOpenCourse} toast={() => {}} toastError={() => {}} />)
    await waitFor(() => expect(screen.getByText('Курс C')).not.toBeNull())
    fireEvent.click(rowOf('Курс C'))
    expect(onOpenCourse).toHaveBeenCalledWith('c')
  })
})
