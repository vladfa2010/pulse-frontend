// ТЗ-188: живое превью видео в форме урока.
// Появление/исчезновение превью, конвертация YouTube-ссылки, карточка ошибки
// по onError (таймаут 15 с в jsdom не гоняем — тот же setter состояния),
// «Повторить» перемонтирует iframe, для kind='text' блока нет.
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LessonForm from '../LessonForm'
import type { CourseCard, Lesson } from '../types'

const course = {
  id: 1, title: 'Курс', subscription_unlock_mode: 'all', materials: [],
} as unknown as CourseCard

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 10, course_id: 1, title: 'Урок 1', kind: 'video_text',
    text_content: '<p>Конспект</p>', video_embed_url: '',
    duration_min: 15, is_free_preview: false, unlock_after_days: 0,
    buttons: [], test: null,
    ...overrides,
  } as unknown as Lesson
}

function renderForm(lesson: Lesson) {
  return render(
    <LessonForm course={course} lesson={lesson}
      onSaved={() => {}} onClose={() => {}} toast={() => {}} />,
  )
}

describe('LessonForm: превью видео (ТЗ-188)', () => {
  it('пустой embed-URL → превью не рендерится', () => {
    const { container } = renderForm(makeLesson())
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.textContent).not.toContain('Предпросмотр')
  })

  it('ввод YouTube-ссылки из адресной строки → превью с embed-src и капшном', async () => {
    const { container } = renderForm(makeLesson())
    const input = container.querySelector('input[type="url"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=abc123' } })
    await waitFor(() => {
      expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube.com/embed/abc123')
    })
    expect(container.textContent).toContain('Предпросмотр — так увидит ученик · YouTube')
  })

  it('очистил инпут → превью исчезло', async () => {
    const lesson = makeLesson()
    lesson.video_embed_url = 'https://rutube.ru/play/embed/123'
    const { container } = renderForm(lesson)
    await waitFor(() => { expect(container.querySelector('iframe')).toBeTruthy() })
    fireEvent.change(container.querySelector('input[type="url"]') as HTMLInputElement, { target: { value: '' } })
    await waitFor(() => { expect(container.querySelector('iframe')).toBeNull() })
  })

  // jsdom/React 19 не делегируют error/load с iframe (проверено отдельным
  // прогоном), поэтому недоступность гоняем через таймаут 15 с — тот же
  // setter setPreviewFailed(true), что и в onError. kind='video' — без
  // lazy-редактора, чтобы fake timers не цепляли Suspense.
  it('таймаут 15 с без загрузки → карточка ошибки; «Повторить» возвращает iframe', () => {
    vi.useFakeTimers()
    try {
      const lesson = makeLesson()
      lesson.kind = 'video' as Lesson['kind']
      const { container } = renderForm(lesson)
      fireEvent.change(container.querySelector('input[type="url"]') as HTMLInputElement, {
        target: { value: 'https://rutube.ru/play/embed/deadbeef' },
      })
      expect(container.querySelector('iframe')).toBeTruthy()
      act(() => { vi.advanceTimersByTime(15000) })
      expect(container.textContent).toContain('Видео с площадки Rutube недоступно')
      // «Открыть оригинал» ведёт на исходный URL
      const original = container.querySelector('a[target="_blank"]') as HTMLAnchorElement
      expect(original.getAttribute('href')).toBe('https://rutube.ru/play/embed/deadbeef')
      // «Повторить» — сброс и перемонтирование
      fireEvent.click(screen.getByText('↻ Повторить'))
      expect(container.querySelector('iframe')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it("kind='text' → ни инпута, ни превью", () => {
    const lesson = makeLesson()
    lesson.kind = 'text' as Lesson['kind']
    const { container } = renderForm(lesson)
    expect(container.querySelector('input[type="url"]')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
  })
})
