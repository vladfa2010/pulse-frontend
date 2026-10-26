// ТЗ-197: поля «Длительность, мин» и «Открыть на день подписки» переведены с
// type="number" на type="text" + inputMode="numeric" — WebKit/iOS не поддерживает
// Selection API у number-инпутов: каретка ставилась «перед цифрой», Safari
// перезаписывал ввод нулём. Проверяем: атрибуты инпутов, фильтрацию нецифровых
// символов и контракт сохранения (пусто → null, «0» → 0, не null).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import LessonForm from '../LessonForm'
import type { CourseCard, Lesson } from '../types'

const updateLessonMock = vi.fn()
const saveTestMock = vi.fn()
const deleteTestMock = vi.fn()
const deleteLessonMock = vi.fn()

vi.mock('../api', () => ({
  updateLesson: (...args: unknown[]) => updateLessonMock(...args),
  createLesson: vi.fn(),
  saveTest: (...args: unknown[]) => saveTestMock(...args),
  deleteTest: (...args: unknown[]) => deleteTestMock(...args),
  deleteLesson: (...args: unknown[]) => deleteLessonMock(...args),
}))

vi.mock('../RichTextField', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="Текст урока" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))

vi.mock('../MaterialsEditor', () => ({ default: () => null }))

const lesson = {
  id: 'l1', course_id: 1, title: 'Урок 1', kind: 'text',
  text_content: '<p>Конспект</p>', video_embed_url: null, duration_min: 15,
  is_free_preview: false, unlock_after_days: 0, buttons: [], test: null,
} as unknown as Lesson

const makeCourse = (unlockMode: string) => ({
  id: 1, title: 'Курс', subscription_unlock_mode: unlockMode, lessons: [lesson],
} as unknown as CourseCard)

const setup = (unlockMode = 'all') => {
  const props = {
    onSaved: vi.fn(),
    onClose: vi.fn(),
    onTestSaved: vi.fn(),
    onTestDeleted: vi.fn(),
    onLessonPatched: vi.fn(),
    toast: vi.fn(),
  }
  const utils = render(<LessonForm course={makeCourse(unlockMode)} lesson={lesson} {...props} />)
  const durationInput = screen.getByPlaceholderText('14') as HTMLInputElement
  // Дрип-поле без placeholder — второй инпут с inputmode среди числовых полей.
  const numericInputs = Array.from(document.querySelectorAll('input[inputmode]'))
  const unlockInput = numericInputs.find(i => i !== durationInput) as HTMLInputElement
  return { ...props, ...utils, durationInput, unlockInput }
}

const save = () => fireEvent.click(screen.getByText('Сохранить'))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-test' })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ТЗ-197: числовые поля — text + inputMode вместо type="number"', () => {
  it('оба инпута — type="text" с inputMode="numeric" и pattern [0-9]*', () => {
    const { durationInput, unlockInput } = setup()
    for (const input of [durationInput, unlockInput]) {
      expect(input.type).toBe('text')
      expect(input.getAttribute('inputmode')).toBe('numeric')
      expect(input.getAttribute('pattern')).toBe('[0-9]*')
    }
  })

  it('длительность: ввод «45» — значение «45»', () => {
    const { durationInput } = setup()
    fireEvent.change(durationInput, { target: { value: '45' } })
    expect(durationInput.value).toBe('45')
  })

  it('длительность: нецифровые символы фильтруются («4a5» → «45»)', () => {
    const { durationInput } = setup()
    fireEvent.change(durationInput, { target: { value: '4a5.!-' } })
    expect(durationInput.value).toBe('45')
  })

  it('дрип-поле: ввод «30» — значение «30», нецифровые отброшены', () => {
    const { unlockInput } = setup('drip')
    fireEvent.change(unlockInput, { target: { value: '3x0д' } })
    expect(unlockInput.value).toBe('30')
  })
})

describe('ТЗ-197: контракт сохранения не изменился', () => {
  it('пустая длительность → duration_min: null в payload', async () => {
    updateLessonMock.mockResolvedValue({ id: 'l1', title: 'Урок 1' })
    const { durationInput, onSaved } = setup()
    fireEvent.change(durationInput, { target: { value: '' } })
    save()
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(updateLessonMock).toHaveBeenCalledWith('l1',
      expect.objectContaining({ duration_min: null }))
  })

  it('длительность «0» → duration_min: 0 (не null)', async () => {
    updateLessonMock.mockResolvedValue({ id: 'l1', title: 'Урок 1' })
    const { durationInput, onSaved } = setup()
    fireEvent.change(durationInput, { target: { value: '0' } })
    save()
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(updateLessonMock).toHaveBeenCalledWith('l1',
      expect.objectContaining({ duration_min: 0 }))
  })

  it('дрип «30» → unlock_after_days: 30 в payload', async () => {
    updateLessonMock.mockResolvedValue({ id: 'l1', title: 'Урок 1' })
    const { unlockInput, onSaved } = setup('drip')
    fireEvent.change(unlockInput, { target: { value: '30' } })
    save()
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(updateLessonMock).toHaveBeenCalledWith('l1',
      expect.objectContaining({ unlock_after_days: 30 }))
  })
})
