// ТЗ-147/149/150: регрессия — CTA «Следующий урок» существует ТОЛЬКО в читалке
// (reader-only; page-вариант со страницы урока убран ТЗ-150). Вилки доступности:
// 'ok'/undefined → ссылка на урок; 'no_access' → тоже ссылка на урок (гейт на
// странице урока, ТЗ-149); 'drip' → пилюля «через N дн.» без навигации;
// null → карточка «Курс пройден» с кнопкой к программе курса.
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import NextLessonCta from '@/components/education/NextLessonCta'

const wrap = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

// Шпион целевого роута: фиксирует флаг цепочки бесшовного чтения (ТЗ-151)
function ChainSpy() {
  const loc = useLocation()
  return (
    <div
      data-testid="chain-spy"
      data-keepreader={String((loc.state as any)?.keepReader === true)}
    />
  )
}

describe('NextLessonCta (ТЗ-147/149/150, только читалка)', () => {
  it("access 'ok' — ссылка на следующий урок с флагом цепочки (ТЗ-151)", async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={
            <NextLessonCta courseSlug="kurs"
              next={{ id: 'l2', position: 2, title: 'Спред', access: 'ok' }} />
          } />
          <Route path="/education/lesson/l2" element={<ChainSpy />} />
        </Routes>
      </MemoryRouter>,
    )
    const a = document.body.querySelector('a.nl-cta-btn.reader') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('/education/lesson/l2')
    expect(a.textContent).toBe('Следующий урок')
    fireEvent.click(a)
    await waitFor(() => {
      expect(document.body.querySelector('[data-testid="chain-spy"]')).toBeTruthy()
    }, { timeout: 3000 })
    expect(document.body.querySelector('[data-testid="chain-spy"]')?.getAttribute('data-keepreader'))
      .toBe('true')
  })

  it('старый бэк (access undefined) — ведёт себя как ok', () => {
    const { container } = wrap(
      <NextLessonCta courseSlug="kurs"
        next={{ id: 'l3', position: 3, title: 'Грексы' }} />,
    )
    expect((container.querySelector('a.nl-cta-btn.reader') as HTMLAnchorElement).getAttribute('href'))
      .toBe('/education/lesson/l3')
  })

  it("access 'no_access' — всё равно ссылка на урок (ТЗ-149: гейт на странице урока)", () => {
    const { container } = wrap(
      <NextLessonCta courseSlug="kurs"
        next={{ id: 'l2', position: 2, title: 'Свопы', access: 'no_access' }} />,
    )
    const a = container.querySelector('a.nl-cta-btn.reader') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('/education/lesson/l2')
  })

  it("access 'drip' — пилюля «через N дн.», ссылок нет", () => {
    const { container } = wrap(
      <NextLessonCta courseSlug="kurs"
        next={{ id: 'l2', position: 2, title: 'Хедж', access: 'drip', unlock_in_days: 5 }} />,
    )
    expect(container.querySelector('.rm-drip')).toBeTruthy()
    expect(container.querySelector('.rm-drip')?.textContent).toContain('через 5 дн.')
    expect(container.querySelector('a')).toBeNull()
  })

  it('next === null — «Курс пройден» с кнопкой к программе курса', () => {
    const { container } = wrap(
      <NextLessonCta courseSlug="kurs" next={null} />,
    )
    const a = container.querySelector('.rm-course-done a.nl-cta-btn') as HTMLAnchorElement
    expect(container.querySelector('.rm-course-done')).toBeTruthy()
    expect(container.textContent).toContain('последний урок курса')
    expect(a.getAttribute('href')).toBe('/education/kurs')
  })
})
