// ПРАВКА-1 к ТЗ-191: лента недель (week-strip) вместо стрелочного WeekNav.
// Проверяем: текущая неделя закрашена градиентом с пульсирующей точкой и
// «идёт, N из 7 дней»; архивные — ghost-пилюли, активная (открытый отчёт) с
// accent-бордером; после {snapshot_id} (live ушёл в архив) закрашенной пилюли
// нет; клик по пилюле ведёт на её роут; дроплист архива на месте.
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router'
import WeekStrip, { type WeekStripItem } from '../WeekStrip'

const LocationProbe = () => {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

const ITEMS: WeekStripItem[] = [
  { key: 'live', label: '', to: '/reports/weekly', live: true },
  { key: 'rep-1', label: '13 — 19 октября 2026', to: '/reports/weekly/rep-1' },
  { key: 'rep-2', label: '6 — 12 октября 2026', to: '/reports/weekly/rep-2' },
]

function setup(props: Partial<Parameters<typeof WeekStrip>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={['/reports/weekly']}>
      <WeekStrip items={ITEMS} currentKey="live" liveRange="20 — 26 октября 2026" liveDays={3} {...props} />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('WeekStrip (ПРАВКА-1 к ТЗ-191)', () => {
  afterEach(cleanup)

  it('текущая неделя первая, закрашена градиентом, с пульсирующей точкой и «идёт, N из 7 дней»', () => {
    setup()
    const strip = screen.getByTestId('week-strip')
    const current = screen.getByTestId('week-chip-current')
    // Первая пилюля в ленте — текущая неделя
    expect(strip.firstElementChild).toBe(current)
    // Закраска по мокапу: градиент + тёмный текст + свечение
    expect(current.style.background).toContain('linear-gradient(135deg')
    expect(current.style.color).toBe('rgb(6, 6, 6)')
    expect(current.style.boxShadow).toContain('rgba(0,212,255,0.25)')
    // Пульсирующая точка и счётчик дней
    expect(screen.getByTestId('live-dot')).toBeTruthy()
    expect(current.textContent).toContain('Текущая неделя · 20 — 26 октября 2026')
    expect(current.textContent).toContain('идёт, 3 из 7 дней')
  })

  it('архивные пилюли ghost; активная (открытый отчёт) с accent-бордером и белым текстом', () => {
    setup({ currentKey: 'rep-1' })
    const active = screen.getByTestId('week-chip-rep-1')
    const inactive = screen.getByTestId('week-chip-rep-2')
    expect(active.dataset.active).toBe('true')
    expect(active.style.borderColor).toBe('var(--border-active)')
    expect(active.style.color).toBe('var(--text-primary)')
    expect(inactive.dataset.active).toBe('false')
    expect(inactive.style.borderColor).toBe('')
  })

  it('после {snapshot_id} (live ушёл в архив) закрашенной пилюли нет', () => {
    setup({ items: ITEMS.filter((it) => !it.live), currentKey: 'rep-1' })
    expect(screen.queryByTestId('week-chip-current')).toBeNull()
    // Первой теперь идёт свежая архивная неделя
    expect(screen.getByTestId('week-strip').firstElementChild).toBe(
      screen.getByTestId('week-chip-rep-1'),
    )
  })

  it('клик по архивной пилюле ведёт на её роут', () => {
    setup()
    fireEvent.click(screen.getByTestId('week-chip-rep-2'))
    expect(screen.getByTestId('location').textContent).toBe('/reports/weekly/rep-2')
  })

  it('дроплист «Архив недель» содержит все недели', () => {
    setup()
    const select = screen.getByTestId('week-archive-select')
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
    expect(options).toContain('Текущая неделя · идёт')
    expect(options).toContain('13 — 19 октября 2026')
    expect(options).toContain('6 — 12 октября 2026')
  })

  it('пустой список (magic-link гость) — лента не рендерится', () => {
    setup({ items: [] })
    expect(screen.queryByTestId('week-strip')).toBeNull()
  })
})
