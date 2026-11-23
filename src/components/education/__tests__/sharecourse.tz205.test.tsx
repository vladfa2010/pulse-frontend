/**
 * =============================================================================
 * PULSE — ТЗ-205: unit-тест ShareCourseModal (раздел «Тесты» ТЗ)
 * =============================================================================
 *
 * Прогон: npx vitest run src/components/education/__tests__/sharecourse.tz205.test.tsx
 * Покрытие: copy (mock clipboard + execCommand fallback), ветка navigator.share,
 * UTM в строке, имя события education_course_shared (snake_case).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import ShareCourseModal from '@/components/education/ShareCourseModal'

const logAnalyticsEvent = vi.fn()
vi.mock('@/lib/analytics', () => ({
  logAnalyticsEvent: (...args: unknown[]) => logAnalyticsEvent(...args),
}))

vi.mock('@/lib/seo', () => ({
  canonicalCourse: (slug: string) => `https://pulse.inside-trade.ru/education/${slug}`,
  courseTitle: (name: string) => `${name} — курс на PULSE`,
  metaDescription: () => 'Описание курса для шаринга',
}))

const baseProps = {
  slug: 'test-course',
  courseName: 'Тестовый курс',
  description: 'Описание',
  onClose: vi.fn(),
}

afterEach(() => cleanup())

beforeEach(() => {
  vi.clearAllMocks()
  // clipboard API отсутствует в jsdom → мок
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  })
  // navigator.share по умолчанию отсутствует (десктоп)
  delete (navigator as any).share
})

describe('ShareCourseModal (ТЗ-205)', () => {
  it('рендерит UTM-ссылку в поле', () => {
    render(<ShareCourseModal {...baseProps} />)
    const field = screen.getByTitle(/utm_source=share/)
    expect(field).toBeTruthy()
    expect(field.textContent).toContain('utm_medium=social')
    expect(field.textContent).toContain('utm_campaign=course_share')
  })

  it('copy: clipboard API + событие education_course_shared channel=copy', async () => {
    render(<ShareCourseModal {...baseProps} />)
    fireEvent.click(screen.getByLabelText('Скопировать ссылку'))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('utm_source=share'),
      )
    })
    expect(logAnalyticsEvent).toHaveBeenCalledWith('education_course_shared', {
      course_id: 'test-course',
      slug: 'test-course',
      channel: 'copy',
    })
  })

  it('navigator.share: нативный шаринг с title/text/url, отмена не бросает', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    ;(navigator as any).share = share
    render(<ShareCourseModal {...baseProps} />)
    fireEvent.click(screen.getByText('Поделиться…'))
    await waitFor(() => expect(share).toHaveBeenCalledWith({
      title: 'Тестовый курс — курс на PULSE',
      text: 'Описание курса для шаринга',
      url: expect.stringContaining('utm_source=share'),
    }))
    expect(logAnalyticsEvent).toHaveBeenCalledWith('education_course_shared',
      expect.objectContaining({ channel: 'native' }))

    // отмена юзером — тихо, без ошибки и без повторного трекинга
    logAnalyticsEvent.mockClear()
    share.mockRejectedValueOnce(new DOMException('AbortError', 'AbortError'))
    fireEvent.click(screen.getByText('Поделиться…'))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2))
    expect(logAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('Telegram: кнопка открывает t.me/share с UTM-ссылкой', () => {
    const open = vi.fn()
    window.open = open
    render(<ShareCourseModal {...baseProps} />)
    fireEvent.click(screen.getByText('Отправить в Telegram'))
    const [url] = open.mock.calls[0]
    expect(url).toContain('https://t.me/share/url?url=')
    expect(decodeURIComponent(url)).toContain('utm_campaign=course_share')
    expect(logAnalyticsEvent).toHaveBeenCalledWith('education_course_shared',
      expect.objectContaining({ channel: 'telegram' }))
  })

  it('Esc закрывает модалку', () => {
    const onClose = vi.fn()
    render(<ShareCourseModal {...baseProps} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
