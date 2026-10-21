// ТЗ-183: сохранение теста не затирает правки урока и не закрывает форму;
// единая кнопка «Сохранить» пишет урок + тест (в т.ч. для нового урока);
// dirty-guard: confirm при выходе с несохранёнными изменениями, beforeunload.
// TestEditor реальный (проверяем onDirty/validate/markSaved), RichTextField
// и MaterialsEditor заменены стабами — не тянем TipTap.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import LessonForm from '../LessonForm'
import type { CourseCard, Lesson } from '../types'

const updateLessonMock = vi.fn()
const createLessonMock = vi.fn()
const saveTestMock = vi.fn()
const deleteTestMock = vi.fn()
const deleteLessonMock = vi.fn()

vi.mock('../api', () => ({
  updateLesson: (...args: unknown[]) => updateLessonMock(...args),
  createLesson: (...args: unknown[]) => createLessonMock(...args),
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

const course = {
  id: 1, title: 'Курс', subscription_unlock_mode: 'all', lessons: [lesson],
} as unknown as CourseCard

const setup = (editing: Lesson | null = lesson) => {
  const toasts: string[] = []
  const props = {
    onSaved: vi.fn(),
    onClose: vi.fn(),
    onTestSaved: vi.fn(),
    onTestDeleted: vi.fn(),
    onLessonPatched: vi.fn(),
    toast: (msg: string) => {
      toasts.push(msg)
    },
  }
  const utils = render(<LessonForm course={course} lesson={editing} {...props} />)
  return { ...props, ...utils, toasts }
}

const editTitle = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText('Например: Дивидендные ловушки'), {
    target: { value },
  })

const enableTest = () => fireEvent.click(screen.getByText('Тест в конце урока'))

// Включаем тест и заполняем минимально валидный вопрос (ТЗ-101: текст +
// 2 непустых варианта, правильный — радио по умолчанию).
const enableTestWithQuestion = () => {
  enableTest()
  fireEvent.change(screen.getByPlaceholderText('Текст вопроса'), { target: { value: 'Вопрос' } })
  fireEvent.change(screen.getByPlaceholderText('Вариант 1'), { target: { value: 'А' } })
  fireEvent.change(screen.getByPlaceholderText('Вариант 2'), { target: { value: 'Б' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  // crypto.randomUUID — для idempotency_key (ТЗ-157) и id теста при быстром сохранении
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-test' })
})

// RTL auto-cleanup в проекте не зарегистрирован (setup-файла нет) — без этого
// рендеры накапливаются между тестами и screen дёргает чужие (протухшие) деревья.
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ТЗ-183: сохранение теста без потери правок урока', () => {
  it('«Сохранить тест» — форма открыта, правки урока на месте, updateLesson не вызывался', async () => {
    saveTestMock.mockResolvedValue({ ok: true })
    const { onSaved, onClose, onTestSaved } = setup()
    editTitle('Переименованный урок')
    enableTestWithQuestion()
    fireEvent.click(screen.getByText('Сохранить тест'))
    await waitFor(() => expect(saveTestMock).toHaveBeenCalledTimes(1))
    expect(saveTestMock).toHaveBeenCalledWith('l1', expect.objectContaining({ pass_score: 70 }))
    // Задача 1: форма не закрывается, список не перезапрашивается —
    // точечно поднимаем сохранённый тест наружу.
    expect(updateLessonMock).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(onTestSaved).toHaveBeenCalledWith('l1', expect.objectContaining({ id: 'uuid-test', pass_score: 70 }))
    // Инвариант: несохранённые правки урока остались в полях.
    expect((screen.getByPlaceholderText('Например: Дивидендные ловушки') as HTMLInputElement).value)
      .toBe('Переименованный урок')
  })
})

describe('ТЗ-183: единая кнопка «Сохранить» (урок + тест)', () => {
  it('грязные урок и тест — один клик, updateLesson затем saveTest', async () => {
    updateLessonMock.mockResolvedValue({ id: 'l1', title: 'Новое название' })
    saveTestMock.mockResolvedValue({ ok: true })
    const { onSaved } = setup()
    editTitle('Новое название')
    enableTestWithQuestion()
    // правим тест — TestEditor поднимает dirty, validate отдаёт свежие данные
    fireEvent.change(screen.getByDisplayValue('70'), { target: { value: '80' } })
    fireEvent.click(screen.getByText('Сохранить'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(updateLessonMock).toHaveBeenCalledTimes(1)
    expect(saveTestMock).toHaveBeenCalledTimes(1)
    expect(saveTestMock).toHaveBeenCalledWith('l1', expect.objectContaining({ pass_score: 80 }))
    expect(updateLessonMock.mock.invocationCallOrder[0]).toBeLessThan(
      saveTestMock.mock.invocationCallOrder[0],
    )
  })

  it('ошибка saveTest — урок сохранён, тост о частичной ошибке, форма открыта', async () => {
    updateLessonMock.mockResolvedValue({ id: 'l1', title: 'Новое название' })
    saveTestMock.mockRejectedValue(new Error('бэкенд недоступен'))
    const { onSaved, onLessonPatched, toasts } = setup()
    editTitle('Новое название')
    enableTestWithQuestion()
    fireEvent.change(screen.getByDisplayValue('70'), { target: { value: '80' } })
    fireEvent.click(screen.getByText('Сохранить'))
    await waitFor(() => expect(onLessonPatched).toHaveBeenCalledTimes(1))
    expect(updateLessonMock).toHaveBeenCalledTimes(1)
    expect(saveTestMock).toHaveBeenCalledTimes(1)
    expect(onSaved).not.toHaveBeenCalled() // форма не закрывается — правки теста в полях
    expect(toasts.some(m => m.includes('Урок сохранён, тест не сохранён: бэкенд недоступен'))).toBe(true)
    expect((screen.getByPlaceholderText('Например: Дивидендные ловушки') as HTMLInputElement).value)
      .toBe('Новое название')
  })

  it('новый урок + тест создаются одним нажатием (createLesson → saveTest)', async () => {
    createLessonMock.mockResolvedValue({ id: 'l9', position: 1 })
    saveTestMock.mockResolvedValue({ ok: true })
    const { onSaved } = setup(null)
    editTitle('Свежий урок')
    enableTestWithQuestion()
    fireEvent.click(screen.getByText('Добавить урок'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(createLessonMock).toHaveBeenCalledTimes(1)
    expect(createLessonMock.mock.calls[0][1]).toEqual(expect.objectContaining({ idempotency_key: 'uuid-test' }))
    expect(saveTestMock).toHaveBeenCalledTimes(1)
    expect(saveTestMock).toHaveBeenCalledWith('l9', expect.objectContaining({ pass_score: 70 }))
  })
})

describe('ТЗ-183: dirty-guard несохранённых изменений', () => {
  it('грязная форма — «Отмена» спрашивает confirm, отказ оставляет форму', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    const { onClose } = setup()
    editTitle('Черновик')
    fireEvent.click(screen.getByText('Отмена'))
    expect(window.confirm).toHaveBeenCalledWith('Есть несохранённые изменения. Выйти без сохранения?')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('confirm подтверждён — форма закрывается', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    const { onClose } = setup()
    editTitle('Черновик')
    fireEvent.click(screen.getByText('Отмена'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('чистая форма — закрытие молча, без confirm', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    const { onClose } = setup()
    fireEvent.click(screen.getByText('Отмена'))
    expect(window.confirm).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('beforeunload: слушатель вешается при dirty и снимается при анмаунте', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    try {
      const { unmount } = setup()
      expect(addSpy.mock.calls.some(c => c[0] === 'beforeunload')).toBe(false)
      editTitle('Черновик')
      expect(addSpy.mock.calls.some(c => c[0] === 'beforeunload')).toBe(true)
      unmount()
      expect(removeSpy.mock.calls.some(c => c[0] === 'beforeunload')).toBe(true)
    } finally {
      addSpy.mockRestore()
      removeSpy.mockRestore()
    }
  })
})
