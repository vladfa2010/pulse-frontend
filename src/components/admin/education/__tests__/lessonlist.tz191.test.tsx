// ТЗ-191: экспорт курса/урока в MD из админки.
// Кнопки дергают exportCourseMd с корректными аргументами (с/без lesson_id),
// blob-download срабатывает (createObjectURL + a[download]), ошибка → тост.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import LessonList from '../LessonList'
import { exportCourseMd } from '../api'

vi.mock('../api', () => ({
  fetchLessons: vi.fn(),
  reorderLessons: vi.fn(),
  updateLesson: vi.fn(),
  exportCourseMd: vi.fn(),
}))

const toastMock = vi.fn()

const course = {
  id: 'c1',
  title: 'Курс',
  slug: 'course',
  lessons: [
    {
      id: 'l1',
      title: 'Первый урок',
      kind: 'video_text',
      position: 1,
      is_free_preview: true,
      duration_min: 10,
      unlock_after_days: 0,
      has_test: false,
      materials_count: 0,
    },
    {
      id: 'l2',
      title: 'Второй урок',
      kind: 'text',
      position: 2,
      is_free_preview: false,
      duration_min: null,
      unlock_after_days: 3,
      has_test: true,
      test_is_blocking: true,
      materials_count: 2,
    },
  ],
} as any

const blobOf = () => ({ blob: new Blob(['# Урок'], { type: 'text/markdown' }), filename: 'Курс — Тест.md' })

beforeEach(() => {
  vi.clearAllMocks()
  ;(exportCourseMd as any).mockResolvedValue(blobOf())
  // jsdom: createObjectURL/revokeObjectURL нет
  ;(URL as any).createObjectURL = vi.fn(() => 'blob:mock')
  ;(URL as any).revokeObjectURL = vi.fn()
})

afterEach(cleanup)

describe('LessonList экспорт MD (ТЗ-191)', () => {
  it('«Экспорт MD» качает весь курс (без lesson_id), blob-download срабатывает', async () => {
    render(<LessonList course={course} onUpdated={() => {}} toast={toastMock} />)

    fireEvent.click(screen.getByText('Экспорт MD'))

    await waitFor(() => expect(exportCourseMd).toHaveBeenCalledWith('c1', undefined))
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('Материалы в файл не входят'), 'success'),
    )
    expect((URL as any).createObjectURL).toHaveBeenCalled()
    expect((URL as any).revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('иконка у урока качает один урок (с lesson_id)', async () => {
    render(<LessonList course={course} onUpdated={() => {}} toast={toastMock} />)

    const icons = screen.getAllByTitle('Скачать урок в MD (ТЗ-191)')
    fireEvent.click(icons[1])

    await waitFor(() => expect(exportCourseMd).toHaveBeenCalledWith('c1', 'l2'))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('Урок сохранён'), 'success'))
    expect(exportCourseMd).toHaveBeenCalledTimes(1)
  })

  it('ошибка 403 → тост с текстом бэка', async () => {
    ;(exportCourseMd as any).mockRejectedValue(Object.assign(new Error('Admin access required'), { status: 403 }))
    render(<LessonList course={course} onUpdated={() => {}} toast={toastMock} />)

    fireEvent.click(screen.getByText('Экспорт MD'))

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Admin access required', 'error'))
  })
})
