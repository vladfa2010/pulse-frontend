import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lastActivityLabel } from '../lastActivity'

// ТЗ-154: «Изучали …» — сегодня/вчера/N дней/N месяцев со склонениями.
// Фиксируем Date.now, чтобы метки были детерминированы.

const DAY = 86400000

function isoDaysAgo(days: number, extraMs = 0): string {
  return new Date(Date.now() - days * DAY - extraMs).toISOString()
}

describe('lastActivityLabel (ТЗ-154)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('сегодня (0 дней, метка пару часов назад)', () => {
    expect(lastActivityLabel(isoDaysAgo(0, 2 * 3600_000))).toBe('Изучали сегодня')
  })

  it('вчера (1 день)', () => {
    expect(lastActivityLabel(isoDaysAgo(1))).toBe('Изучали вчера')
  })

  it('2 дня', () => {
    expect(lastActivityLabel(isoDaysAgo(2))).toBe('Изучали 2 дня назад')
  })

  it('5 дней', () => {
    expect(lastActivityLabel(isoDaysAgo(5))).toBe('Изучали 5 дней назад')
  })

  it('11 дней (исключение)', () => {
    expect(lastActivityLabel(isoDaysAgo(11))).toBe('Изучали 11 дней назад')
  })

  it('21 день (дд%10=1, но не 11)', () => {
    expect(lastActivityLabel(isoDaysAgo(21))).toBe('Изучали 21 день назад')
  })

  it('1 месяц', () => {
    expect(lastActivityLabel(isoDaysAgo(30))).toBe('Изучали 1 месяц назад')
  })

  it('2 месяца', () => {
    expect(lastActivityLabel(isoDaysAgo(61))).toBe('Изучали 2 месяца назад')
  })

  it('5 месяцев', () => {
    expect(lastActivityLabel(isoDaysAgo(153))).toBe('Изучали 5 месяцев назад')
  })

  it('11 месяцев (исключение для месяцев)', () => {
    expect(lastActivityLabel(isoDaysAgo(334))).toBe('Изучали 11 месяцев назад')
  })

  it('больше года', () => {
    expect(lastActivityLabel(isoDaysAgo(400))).toBe('Изучали больше года назад')
  })
})
