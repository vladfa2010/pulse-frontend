// ТЗ-195: облако тегов на странице недельного отчёта.
// Пилюли = ровно stats.perTag; размер 11–17px по максимуму недели; клик —
// scrollIntoView к секции tagId; тег без секции приглушён и не кликабелен;
// пустой perTag → карточки нет; компонент чистый — сетевых вызовов нет.
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import TagCloud from '../TagCloud'
import type { WeeklyStatsTagRow } from '@/lib/reportsApi'

const row = (tagId: string, tagName: string, current: number): WeeklyStatsTagRow => ({
  tagId, tagName, current, prevWeek: 0, monthAvg: 0,
})

const ROWS: WeeklyStatsTagRow[] = [
  row('spacex', 'SpaceX', 24),
  row('trump', 'Трамп', 10),
  row('ai', 'AI', 5),
]

const colorOf = () => '#00D4FF'

describe('TagCloud (ТЗ-195)', () => {
  afterEach(cleanup)

  it('содержит ровно теги perTag со счётчиками current', () => {
    render(<TagCloud perTag={ROWS} sectionTagIds={new Set(['spacex', 'trump', 'ai'])} colorOf={colorOf} />)
    const cloud = screen.getByTestId('tag-cloud')
    const chips = cloud.querySelectorAll('[data-testid^="tag-cloud-chip-"]')
    expect(chips).toHaveLength(3)
    expect(screen.getByTestId('tag-cloud-chip-spacex').textContent).toContain('24')
    expect(screen.getByTestId('tag-cloud-chip-trump').textContent).toContain('10')
    expect(screen.getByTestId('tag-cloud-chip-ai').textContent).toContain('5')
  })

  it('размер: минимум 11px, максимум 17px', () => {
    render(
      <TagCloud
        perTag={[row('min-tag', 'Мелкий', 0), row('max-tag', 'Крупный', 10)]}
        sectionTagIds={new Set(['min-tag', 'max-tag'])}
        colorOf={colorOf}
      />,
    )
    // CSSOM нормализует «11.0px» → «11px» — сравниваем числом
    expect(parseFloat(screen.getByTestId('tag-cloud-chip-min-tag').style.fontSize)).toBe(11)
    expect(parseFloat(screen.getByTestId('tag-cloud-chip-max-tag').style.fontSize)).toBe(17)
  })

  it('клик по пилюле скроллит к секции её tagId', () => {
    const spy = vi.fn()
    // jsdom не реализует scrollIntoView — ставим шпиона на конкретный элемент
    const { container } = render(
      <div>
        <TagCloud perTag={ROWS} sectionTagIds={new Set(['spacex', 'trump', 'ai'])} colorOf={colorOf} />
        <section id="trump">разбор трампа</section>
      </div>,
    )
    const section = container.querySelector('section#trump') as HTMLElement
    section.scrollIntoView = spy
    fireEvent.click(screen.getByTestId('tag-cloud-chip-trump'))
    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('пилюля тега без секции — span, приглушена, без обработчика клика', () => {
    render(<TagCloud perTag={ROWS} sectionTagIds={new Set(['spacex'])} colorOf={colorOf} />)
    const dead = screen.getByTestId('tag-cloud-chip-trump')
    expect(dead.tagName).toBe('SPAN')
    expect(dead.style.opacity).toBe('0.45')
    expect(dead.style.cursor).toBe('default')
    expect(dead.getAttribute('role')).toBeNull()
    // кликабельная пилюля — button
    expect(screen.getByTestId('tag-cloud-chip-spacex').tagName).toBe('BUTTON')
  })

  it('perTag пуст → карточки нет в DOM', () => {
    render(<TagCloud perTag={[]} sectionTagIds={new Set()} colorOf={colorOf} />)
    expect(screen.queryByTestId('tag-cloud')).toBeNull()
  })

  it('компонент не делает сетевых запросов (данные из payload отчёта)', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      render(<TagCloud perTag={ROWS} sectionTagIds={new Set(ROWS.map((r) => r.tagId))} colorOf={colorOf} />)
      expect(screen.getByTestId('tag-cloud')).toBeTruthy()
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
