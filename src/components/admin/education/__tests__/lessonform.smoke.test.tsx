// Регрессия ТЗ-137-фикс: монтирование LessonForm целиком (lazy RichTextField
// в Suspense) — воспроизводило краш «Cannot read properties of null (reading
// 'cached')» в useEffect RichTextField на уничтоженном редакторе TipTap v3.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import LessonForm from '../LessonForm'
import type { CourseCard, Lesson } from '../types'

const course = {
  id: 1, title: 'Курс', subscription_unlock_mode: 'all', materials: [],
} as unknown as CourseCard

const lesson = {
  id: 10, course_id: 1, title: 'Урок 1', kind: 'video_text',
  text_content: '<p>Конспект</p><img src="/media/a.webp" width="50%" />',
  video_embed_url: 'https://www.youtube.com/embed/x', duration_min: 15,
  is_free_preview: false, unlock_after_days: 0, buttons: [], test: null,
} as unknown as Lesson

describe('LessonForm smoke', () => {
  it('монтируется с существующим уроком (lazy RichTextField)', async () => {
    const { container } = render(
      <LessonForm course={course} lesson={lesson}
        onSaved={() => {}} onClose={() => {}} toast={() => {}} />,
    )
    await waitFor(() => {
      expect(container.querySelector('.ProseMirror')).toBeTruthy()
    }, { timeout: 5000 })
  })
})
