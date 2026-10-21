import { describe, it, expect } from 'vitest'
import {
  isTopicsEnabled,
  cascadesTabs,
  parseCascadesParams,
  buildCascadesParams,
  CASCADE_TABS,
  TOPICS_ENABLED,
} from '@/lib/cascadeParams'

/**
 * ТЗ-115 задача 5: флаг VITE_TOPICS_ENABLED и вкладка «Темы».
 * Компонентный рендер не делаем (в проекте нет jsdom-сетупа) — проверяем
 * чистые функции. Vite встраивает снапшот import.meta.env при трансформе,
 * поэтому vi.stubEnv на VITE_* не работает: полярность флага гоняем через
 * isTopicsEnabled, состав массива вкладок — через cascadesTabs(enabled).
 */
describe('isTopicsEnabled — полярность флага VITE_TOPICS_ENABLED', () => {
  it("'true' → вкладка «Темы» включена", () => {
    expect(isTopicsEnabled('true')).toBe(true)
  })

  it("'false' → выключена", () => {
    expect(isTopicsEnabled('false')).toBe(false)
  })

  it('unset (undefined) → выключена (Render Static Site — дефолт)', () => {
    expect(isTopicsEnabled(undefined)).toBe(false)
  })

  it('пустая строка → выключена', () => {
    expect(isTopicsEnabled('')).toBe(false)
  })
})

describe('cascadesTabs — состав массива вкладок (ТЗ-115, ТЗ-185, ТЗ-186)', () => {
  it('TOPICS_ENABLED=true → «Темы» на позиции 3, «Аналитика» на 4, «Динамика» после «Ресерч»', () => {
    expect(cascadesTabs(true)).toEqual([
      'cascades', 'stories', 'topics', 'analytics', 'graph', 'research', 'dynamics', 'method',
    ])
  })

  it('TOPICS_ENABLED=false → вкладки «Темы» нет, «Аналитика» и «Динамика» всегда (ТЗ-185, ТЗ-186)', () => {
    expect(cascadesTabs(false)).toEqual(['cascades', 'stories', 'analytics', 'graph', 'research', 'dynamics', 'method'])
    expect(cascadesTabs(false)).not.toContain('topics')
    expect(cascadesTabs(false)).toContain('analytics')
    expect(cascadesTabs(false)).toContain('dynamics')
  })
})

describe('parseCascadesParams — вкладка topics (ТЗ-115)', () => {
  // Модульный CASCADE_TABS собран из TOPICS_ENABLED; в тестовом env флаг не
  // задан → false, вкладки 'topics' в массиве нет.
  it('CASCADE_TABS модуля = cascadesTabs(TOPICS_ENABLED)', () => {
    expect(CASCADE_TABS).toEqual(cascadesTabs(TOPICS_ENABLED))
  })

  it('TOPICS_ENABLED=false → ?tab=topics откатывается на cascades', () => {
    expect(TOPICS_ENABLED).toBe(false)
    expect(parseCascadesParams(new URLSearchParams('tab=topics')).tab).toBe('cascades')
  })

  it('при TOPICS_ENABLED=true ?tab=topics валидна: вкладка есть в массиве', () => {
    // parseCascadesParams принимает вкладку через CASCADE_TABS.includes(rawTab),
    // а CASCADE_TABS === cascadesTabs(TOPICS_ENABLED) — при включённом флаге
    // includes('topics') === true, и parse вернул бы 'topics'
    expect(cascadesTabs(true).includes('topics')).toBe(true)
    expect(CASCADE_TABS).toEqual(cascadesTabs(TOPICS_ENABLED))
  })

  it('известные вкладки парсятся независимо от флага', () => {
    expect(parseCascadesParams(new URLSearchParams('tab=stories')).tab).toBe('stories')
    expect(parseCascadesParams(new URLSearchParams('tab=analytics')).tab).toBe('analytics')
    expect(parseCascadesParams(new URLSearchParams('tab=dynamics')).tab).toBe('dynamics')
    expect(parseCascadesParams(new URLSearchParams('tab=method')).tab).toBe('method')
    expect(parseCascadesParams(new URLSearchParams()).tab).toBe('cascades')
    expect(parseCascadesParams(new URLSearchParams('tab=bogus')).tab).toBe('cascades')
  })
})

describe('параметр story — деталь-панель сюжета (ТЗ-187)', () => {
  it('парсится из ?story=<id>, пустое/отсутствующее значение → null', () => {
    expect(parseCascadesParams(new URLSearchParams('tab=stories&story=abc-123')).story).toBe('abc-123')
    expect(parseCascadesParams(new URLSearchParams('story=abc-123')).story).toBe('abc-123')
    expect(parseCascadesParams(new URLSearchParams('story=')).story).toBe(null)
    expect(parseCascadesParams(new URLSearchParams()).story).toBe(null)
  })

  it('собирается в URL через buildCascadesParams; null — не попадает', () => {
    const sp = buildCascadesParams({ tab: 'stories', window: '7d', cluster: null, story: 'abc-123' })
    expect(sp.get('story')).toBe('abc-123')
    const empty = buildCascadesParams({ tab: 'stories', window: '7d', cluster: null, story: null })
    expect(empty.get('story')).toBe(null)
  })

  it('круговой прогон: parse ∘ build — идемпотентно', () => {
    const params = { tab: 'stories' as const, window: '7d' as const, cluster: null, story: 'xyz' }
    expect(parseCascadesParams(buildCascadesParams(params))).toEqual(params)
  })
})
