import { describe, it, expect } from 'vitest'
import { isCascadeExpandEnabled, nextExpandedCluster } from '@/lib/cascadeExpand'

/**
 * ТЗ-101 задача 5: флаг VITE_CASCADE_EXPAND и логика открытия/сворачивания.
 * Компонентный рендер не делаем (в проекте нет jsdom-сетапа) — проверяем
 * чистые функции, на которых построен разъезд.
 */
describe('isCascadeExpandEnabled — полярность флага VITE_CASCADE_EXPAND', () => {
  it('unset (undefined) → разъезд включён', () => {
    expect(isCascadeExpandEnabled(undefined)).toBe(true)
  })

  it('null → разъезд включён', () => {
    expect(isCascadeExpandEnabled(null)).toBe(true)
  })

  it("'true' → разъезд включён", () => {
    expect(isCascadeExpandEnabled('true')).toBe(true)
  })

  it("пустая строка → разъезд включён", () => {
    expect(isCascadeExpandEnabled('')).toBe(true)
  })

  it("'false' → разъезд выключен (interim-navigate ТЗ-100)", () => {
    expect(isCascadeExpandEnabled('false')).toBe(false)
  })
})

describe('nextExpandedCluster — один открытый каскад на карусель', () => {
  it('клик по закрытой стопке открывает панель', () => {
    expect(nextExpandedCluster(null, 'c1')).toBe('c1')
  })

  it('повторный клик по открытой стопке сворачивает', () => {
    expect(nextExpandedCluster('c1', 'c1')).toBe(null)
  })

  it('клик по другой стопке переключает панель', () => {
    expect(nextExpandedCluster('c1', 'c2')).toBe('c2')
  })

  it('после переключения повторный клик по той же сворачивает', () => {
    expect(nextExpandedCluster('c2', 'c2')).toBe(null)
  })
})
