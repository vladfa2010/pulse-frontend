import { describe, it, expect } from 'vitest'
import { daysUntil, relDayLabel, eventKindColor, moscowDateString } from '../educationMatch'

// ТЗ-103: чистые хелперы календарного мэтчинга LMS.

describe('daysUntil', () => {
  it('0 — сегодня, 1 — завтра', () => {
    expect(daysUntil('2026-10-01', '2026-10-01')).toBe(0)
    expect(daysUntil('2026-10-02', '2026-10-01')).toBe(1)
  })

  it('отрицательные — прошедшие события', () => {
    expect(daysUntil('2026-09-30', '2026-10-01')).toBe(-1)
  })

  it('переход через месяц/год считается по календарю', () => {
    expect(daysUntil('2026-11-01', '2026-10-01')).toBe(31)
    expect(daysUntil('2027-10-01', '2026-10-01')).toBe(365)
  })

  it('мусор — NaN, не валит рендер', () => {
    expect(daysUntil('не-дата', '2026-10-01')).toBeNaN()
  })
})

describe('relDayLabel', () => {
  it('только сегодня/завтра получают ярлык', () => {
    expect(relDayLabel('2026-10-01', '2026-10-01')).toBe('Сегодня')
    expect(relDayLabel('2026-10-02', '2026-10-01')).toBe('Завтра')
    expect(relDayLabel('2026-10-03', '2026-10-01')).toBeNull()
    expect(relDayLabel('2026-09-30', '2026-10-01')).toBeNull()
  })
})

describe('eventKindColor', () => {
  it('цвета по DESIGN_SYSTEM (ТЗ-103)', () => {
    expect(eventKindColor('Дивиденды')).toBe('#FBBF24') // amber
    expect(eventKindColor('СД')).toBe('#A78BFA') // violet
    expect(eventKindColor('СА')).toBe('#A78BFA')
    expect(eventKindColor('МСФО')).toBe('#00D4FF') // cyan
    expect(eventKindColor('РСБУ')).toBe('#00D4FF')
    expect(eventKindColor('Другое')).toBe('#9CA3AF')
  })
})

describe('moscowDateString', () => {
  it('формат YYYY-MM-DD', () => {
    expect(moscowDateString(new Date('2026-10-01T12:00:00'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
