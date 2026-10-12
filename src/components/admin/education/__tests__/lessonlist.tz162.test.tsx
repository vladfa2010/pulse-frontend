// ТЗ-162: после сохранения урока список обновляется точечно (patch из ответа
// PUT / лёгкий GET /courses/:id/lessons), а не полным refetch карточки
// (GET /courses/:id) — полный refetch перерендеривал все вкладки редактора
// («моргание»).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
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

// LessonForm заменяем стабом: кнопки имитируют сохранение с patch (редактирование)
// и без patch (создание/удаление) — не тянем lazy RichTextField/TipTap.
vi.mock('../LessonForm', () => ({
  default: ({ onSaved, lesson }: { onSaved: (saved?: Lesson) => void; lesson: Lesson | null }) => (
    <div>
      <button onClick={() => onSaved({ id: 'l10', title: 'Переименованный урок' } as unknown as Lesson)}>
        stub-save-edit
      </button>
      <button onClick={() => onSaved()}>{lesson ? 'stub-delete' : 'stub-save-create'}</button>
    </div>
  ),
}))

vi.mock('../ImportMdModal', () => ({ default: () => null }))

const lesson10 = {
  id: 'l10', course_id: 1, title: 'Урок 1', kind: 'text', buttons: [], test: null,
  unlock_after_days: 0, is_free_preview: false, duration_min: 15,
} as unknown as Lesson

const lesson20 = {
  id: 'l20', course_id: 1, title: 'Урок 2', kind: 'video', buttons: [], test: null,
  unlock_after_days: 0, is_free_preview: true, duration_min: null,
} as unknown as Lesson

const course = {
  id: 1, title: 'Курс', subscription_unlock_mode: 'all',
  lessons: [lesson10, lesson20],
} as unknown as CourseCard

const setup = () => {
  const updatedCards: CourseCard[] = []
  render(
    <LessonList
      course={course}
      onUpdated={(card) => updatedCards.push(card)}
      toast={() => {}}
    />,
  )
  return updatedCards
}

beforeEach(() => {
  vi.clearAllMocks()
})

// RTL auto-cleanup в проекте не зарегистрирован (setup-файла нет) — без этого
// рендеры накапливаются между тестами и screen дёргает чужие (протухшие) деревья.
afterEach(() => {
  cleanup()
})

describe('ТЗ-162: точечное обновление списка уроков', () => {
  it('onSaved(saved) — patch без единого сетевого вызова', () => {
    const updatedCards = setup()
    fireEvent.click(screen.getAllByTitle('Редактировать урок')[0])
    fireEvent.click(screen.getByText('stub-save-edit'))
    expect(updatedCards).toHaveLength(1)
    const card = updatedCards[0]
    expect(card.lessons.find(l => l.id === 'l10')?.title).toBe('Переименованный урок')
    expect(card.lessons.find(l => l.id === 'l20')?.title).toBe('Урок 2')
    expect(fetchLessonsMock).not.toHaveBeenCalled()
    expect(fetchCourseMock).not.toHaveBeenCalled()
  })

  it('onSaved() без аргумента — лёгкий fetchLessons, fetchCourse не дёргается', async () => {
    fetchLessonsMock.mockResolvedValue([lesson10, lesson20, { id: 'l30', title: 'Новый' } as Lesson])
    const updatedCards = setup()
    fireEvent.click(screen.getAllByTitle('Редактировать урок')[0])
    fireEvent.click(screen.getByText('stub-delete'))
    await waitFor(() => expect(updatedCards).toHaveLength(1))
    expect(fetchLessonsMock).toHaveBeenCalledTimes(1)
    expect(fetchCourseMock).not.toHaveBeenCalled()
    const card = updatedCards[0]
    expect(card.lessons).toHaveLength(3)
    expect(card.lessons[2].title).toBe('Новый')
  })

  it('reorder ↑↓ — тоже лёгкий fetchLessons', async () => {
    fetchLessonsMock.mockResolvedValue([lesson20, lesson10])
    reorderLessonsMock.mockResolvedValue({ ok: true })
    const updatedCards = setup()
    fireEvent.click(screen.getAllByTitle('Урок ниже')[0])
    await waitFor(() => expect(updatedCards).toHaveLength(1))
    expect(fetchLessonsMock).toHaveBeenCalledTimes(1)
    expect(fetchCourseMock).not.toHaveBeenCalled()
    expect(reorderLessonsMock).toHaveBeenCalledWith(1, ['l20', 'l10'])
    expect(updatedCards[0].lessons.map(l => l.id)).toEqual(['l20', 'l10'])
  })
})
