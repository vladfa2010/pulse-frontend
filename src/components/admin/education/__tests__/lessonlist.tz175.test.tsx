// ТЗ-175: форма урока не должна тащить состояние предыдущего урока при
// переключении ✎ поверх открытой формы (затирание урока B данными урока A).
// Стаб LessonForm повторяет реальный паттерн бага: useState(lesson?.title)
// инициализируется только при маунте — без key на форме состояние переживало
// смену урока, с key — форма перемонтируется и берёт данные нового урока.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import LessonList from '../LessonList'
import type { CourseCard, Lesson } from '../types'

const fetchLessonsMock = vi.fn()
const fetchCourseMock = vi.fn()
const reorderLessonsMock = vi.fn()
const updateLessonMock = vi.fn()

vi.mock('../api', () => ({
  fetchLessons: (...args: unknown[]) => fetchLessonsMock(...args),
  fetchCourse: (...args: unknown[]) => fetchCourseMock(...args),
  reorderLessons: (...args: unknown[]) => reorderLessonsMock(...args),
  updateLesson: (...args: unknown[]) => updateLessonMock(...args),
}))

// Как LessonForm (ТЗ-175 до фикса): состояние поля — только для первого
// маунта. Плюс показываем id урока, чтобы проверить, в какой урок целится форма.
vi.mock('../LessonForm', async () => {
  const React = await import('react')
  return {
    default: ({ lesson, onClose }: { lesson: Lesson | null; onClose: () => void }) => {
      const [title, setTitle] = React.useState(lesson?.title || '')
      return (
        <div data-testid="form" data-lesson-id={lesson?.id ?? 'new'}>
          <input
            aria-label="Название урока"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button onClick={onClose}>✕</button>
        </div>
      )
    },
  }
})

vi.mock('../ImportMdModal', () => ({ default: () => null }))

const lessonA = {
  id: 'lA', course_id: 1, title: 'Урок A', kind: 'text', buttons: [], test: null,
  unlock_after_days: 0, is_free_preview: false, duration_min: 15,
} as unknown as Lesson

const lessonB = {
  id: 'lB', course_id: 1, title: 'Урок B', kind: 'text', buttons: [], test: null,
  unlock_after_days: 0, is_free_preview: false, duration_min: null,
} as unknown as Lesson

const course = {
  id: 1, title: 'Курс', subscription_unlock_mode: 'all',
  lessons: [lessonA, lessonB],
} as unknown as CourseCard

const setup = () =>
  render(<LessonList course={course} onUpdated={() => {}} toast={() => {}} />)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ТЗ-175: смена урока поверх открытой формы', () => {
  it('подтверждённое переключение: форма показывает данные урока B, целится в B', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    setup()

    fireEvent.click(screen.getAllByTitle('Редактировать урок')[0]) // ✎ урока A
    const input = screen.getByLabelText('Название урока') as HTMLInputElement
    expect(input.value).toBe('Урок A')

    fireEvent.change(input, { target: { value: 'Переименованный A' } })

    fireEvent.click(screen.getAllByTitle('Редактировать урок')[1]) // ✎ урока B
    expect(window.confirm).toHaveBeenCalled()

    const form = screen.getByTestId('form')
    expect(form.getAttribute('data-lesson-id')).toBe('lB')
    // Ключевое: поле содержит название урока B, а не несохранённое «Переименованный A»
    expect((screen.getByLabelText('Название урока') as HTMLInputElement).value).toBe('Урок B')
  })

  it('отмена в confirm: редактирование остаётся на уроке A с правками', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    setup()

    fireEvent.click(screen.getAllByTitle('Редактировать урок')[0])
    const input = screen.getByLabelText('Название урока') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Переименованный A' } })

    fireEvent.click(screen.getAllByTitle('Редактировать урок')[1]) // ✎ урока B
    expect(window.confirm).toHaveBeenCalled()

    const form = screen.getByTestId('form')
    expect(form.getAttribute('data-lesson-id')).toBe('lA')
    expect((screen.getByLabelText('Название урока') as HTMLInputElement).value).toBe(
      'Переименованный A',
    )
  })

  it('«+ Урок» после редактирования открывает форму создания, а не данные урока', () => {
    setup()

    fireEvent.click(screen.getAllByTitle('Редактировать урок')[0])
    fireEvent.click(screen.getByText('✕')) // закрыть форму урока A
    fireEvent.click(screen.getByText('+ Урок'))

    const form = screen.getByTestId('form')
    expect(form.getAttribute('data-lesson-id')).toBe('new')
    expect((screen.getByLabelText('Название урока') as HTMLInputElement).value).toBe('')
  })
})
