// ТЗ-147: регрессия — CTA «Следующий урок» по вилкам доступности из бэка:
// 'ok'/undefined → ссылка на урок; 'drip' → карточка «через N дн.» без навигации;
// 'no_access' → карточка «в полной версии курса» + ссылка на курс; null → «Курс пройден».
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import NextLessonCta from '@/components/education/NextLessonCta'

const wrap = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

describe('NextLessonCta (ТЗ-147)', () => {
  it("access 'ok' — ссылка на следующий урок", () => {
    const { container } = wrap(
      <NextLessonCta variant="page" courseSlug="kurs"
        next={{ id: 'l2', position: 2, title: 'Спред', access: 'ok' }} />,
    )
    const a = container.querySelector('a.nl-cta-btn') as HTMLAnchorElement
    expect(a).toBeTruthy()
    expect(a.getAttribute('href')).toBe('/education/lesson/l2')
    expect(a.textContent).toContain('Следующий урок: 2. Спред')
  })

  it('старый бэк (access undefined) — ведёт себя как ok', () => {
    const { container } = wrap(
      <NextLessonCta variant="page" courseSlug="kurs"
        next={{ id: 'l3', position: 3, title: 'Грексы' }} />,
    )
    expect((container.querySelector('a.nl-cta-btn') as HTMLAnchorElement).getAttribute('href'))
      .toBe('/education/lesson/l3')
  })

  it("access 'drip' — карточка с числом дней, ссылок нет", () => {
    const { container } = wrap(
      <NextLessonCta variant="page" courseSlug="kurs"
        next={{ id: 'l2', position: 2, title: 'Хедж', access: 'drip', unlock_in_days: 5 }} />,
    )
    expect(container.querySelector('.nl-cta.locked')).toBeTruthy()
    expect(container.textContent).toContain('откроется через 5 дн.')
    expect(container.querySelector('a')).toBeNull()
  })

  it("access 'no_access' — всё равно ссылка на урок (ТЗ-149: гейт на странице урока)", () => {
    const { container } = wrap(
      <NextLessonCta variant="page" courseSlug="kurs"
        next={{ id: 'l2', position: 2, title: 'Свопы', access: 'no_access' }} />,
    )
    const a = container.querySelector('a.nl-cta-btn') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('/education/lesson/l2')
  })

  it('variant reader — короткий лейбл «Следующий урок» без номера и названия (ТЗ-149)', () => {
    const { container } = wrap(
      <NextLessonCta variant="reader" courseSlug="kurs"
        next={{ id: 'l2', position: 12, title: 'Очень длинное название урока' }} />,
    )
    const a = container.querySelector('a.nl-cta-btn') as HTMLAnchorElement
    expect(a.textContent).toBe('Следующий урок')
    expect(a.textContent).not.toContain('12')
  })

  it('next === null — «Курс пройден» с кнопкой к программе курса', () => {
    const { container } = wrap(
      <NextLessonCta variant="page" courseSlug="kurs" next={null} />,
    )
    const a = container.querySelector('.done-course a.nl-cta-btn') as HTMLAnchorElement
    expect(container.textContent).toContain('последний урок курса')
    expect(a.getAttribute('href')).toBe('/education/kurs')
  })
})
