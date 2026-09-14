/**
 * ТЗ-100 §4 — тесты чистой логики карточки-стопки каскада.
 * Компонентный рендер не делаем (в проекте нет jsdom-сетапа для NewsCard:
 * useAuth/useQuery требуют провайдеров); логика вынесена в lib/cascadeStack.
 */
import { describe, it, expect } from 'vitest'
import {
  getStackLayout,
  getLayerGeom,
  getStackMarginBottom,
  MAX_STACK_LAYERS,
  PENDING_WINDOW_MS,
} from '@/lib/cascadeStack'
import type { NewsArticle } from '@/types/news'

const NOW = Date.parse('2026-09-14T12:00:00Z')

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'n1',
    slug: 'n1',
    title_ru: 'Новость',
    source: 'test',
    published_at: '2026-09-14T11:00:00Z',
    ...overrides,
  }
}

// Первоисточник каскада из 21 новости (как кластер a17f5bd1 в приёмке ТЗ-99)
const ORIGIN_21 = makeArticle({
  cluster_id: 'c1',
  cluster_size: 21,
  cluster_position: 1,
  cluster_growing: false,
})

describe('layersCount (ТЗ-100 §4)', () => {
  it.each([
    [2, 1],
    [4, 3],
    [7, 6],
    [20, 6], // мин(N−1, 6)
  ])('cluster_size=%i → %i слоёв', (size, expected) => {
    const layout = getStackLayout(
      makeArticle({ cluster_id: 'c', cluster_size: size, cluster_position: 1 }),
      'portrait', NOW,
    )
    expect(layout.layersCount).toBe(expected)
    expect(layout.showLayers).toBe(true)
  })

  it('поздняя новость (position > 1) — без слоёв, только чип', () => {
    const layout = getStackLayout(
      makeArticle({ cluster_id: 'c', cluster_size: 21, cluster_position: 7 }),
      'portrait', NOW,
    )
    expect(layout.isOrigin).toBe(false)
    expect(layout.showLayers).toBe(false)
    expect(layout.layersCount).toBe(0)
    expect(layout.wrapperClick).toBe('card')
  })

  it('landscape первоисточника — слои НЕ рисуем (хвост ломает сетку 16:9)', () => {
    const layout = getStackLayout(ORIGIN_21, 'landscape', NOW)
    expect(layout.isOrigin).toBe(true)
    expect(layout.showLayers).toBe(false)
    expect(layout.layersCount).toBe(0)
  })

  it('без cluster_id — рендер как раньше (нет ни слоёв, ни pending)', () => {
    const layout = getStackLayout(makeArticle(), 'portrait', NOW)
    expect(layout.showLayers).toBe(false)
    expect(layout.showPending).toBe(false)
    expect(layout.wrapperClick).toBe('card')
  })
})

describe('pending-чип «···» (ТЗ-100 §2)', () => {
  const fresh = '2026-09-14T11:50:00Z' // 10 минут от NOW
  const stale = '2026-09-14T11:30:00Z' // 30 минут от NOW

  it('pending и возраст < 15 мин → показываем', () => {
    const layout = getStackLayout(
      makeArticle({ cluster_pending: true, published_at: fresh }),
      'portrait', NOW,
    )
    expect(layout.showPending).toBe(true)
  })

  it('pending и возраст ≥ 15 мин → ничего', () => {
    const layout = getStackLayout(
      makeArticle({ cluster_pending: true, published_at: stale }),
      'portrait', NOW,
    )
    expect(layout.showPending).toBe(false)
  })

  it('cluster_pending=false — не показываем независимо от возраста', () => {
    const layout = getStackLayout(
      makeArticle({ cluster_pending: false, published_at: fresh }),
      'portrait', NOW,
    )
    expect(layout.showPending).toBe(false)
  })

  it('граница окна: ровно 15 минут — уже не показываем', () => {
    const exactly = new Date(NOW - PENDING_WINDOW_MS).toISOString()
    const layout = getStackLayout(
      makeArticle({ cluster_pending: true, published_at: exactly }),
      'portrait', NOW,
    )
    expect(layout.showPending).toBe(false)
  })
})

describe('архитектура клика (ТЗ-100 §2.4)', () => {
  it('position=1 → клик обёртки ведёт на каскад (NewsDetailModal НЕ открывается)', () => {
    expect(getStackLayout(ORIGIN_21, 'portrait', NOW).wrapperClick).toBe('cascade')
    expect(getStackLayout(ORIGIN_21, 'landscape', NOW).wrapperClick).toBe('cascade')
  })

  it('position>1 → обычный клик по карточке (чип внутри NewsCard ловит свой клик)', () => {
    const late = makeArticle({ cluster_id: 'c', cluster_size: 5, cluster_position: 3 })
    expect(getStackLayout(late, 'portrait', NOW).wrapperClick).toBe('card')
    expect(getStackLayout(late, 'landscape', NOW).wrapperClick).toBe('card')
  })

  it('без обработчика каскада первоисточник кликается как обычная карточка', () => {
    const layout = getStackLayout(ORIGIN_21, 'portrait', NOW, false)
    expect(layout.wrapperClick).toBe('card')
  })
})

describe('геометрия слоёв (ТЗ-103, мокап v2: l 1-based, шаг 4px)', () => {
  it('слой l (1…layersCount): height 14+l*4, inset l*5, opacity max(.25, 1−l·.1)', () => {
    expect(getLayerGeom(1)).toMatchObject({ height: 18, inset: 5, opacity: 0.9 })
    expect(getLayerGeom(4)).toMatchObject({ height: 30, inset: 20, opacity: 0.6 })
    expect(getLayerGeom(8).opacity).toBe(0.25) // ниже .25 не опускается
  })

  it('hover-веер: сдвиг min(1+l*.4, 3)px, поворот ±.5deg чередуется (1-based)', () => {
    expect(getLayerGeom(1).hoverShift).toBe(1.4)
    expect(getLayerGeom(1).hoverRotate).toBe(0.5)
    expect(getLayerGeom(2).hoverRotate).toBe(-0.5)
    expect(getLayerGeom(MAX_STACK_LAYERS).hoverShift).toBe(3)
  })

  it('margin-bottom обёртки: layersCount*4 + 2, без слоёв — undefined', () => {
    expect(getStackMarginBottom(6)).toBe(26)
    expect(getStackMarginBottom(1)).toBe(6)
    expect(getStackMarginBottom(0)).toBeUndefined()
  })
})

describe('ТЗ-103 §3.1 — граничный тест «размер 2 → видимый хвост»', () => {
  it('cluster_size=2, position=1 → 1 слой, хвост getLayerGeom(1).height − 14 = 4px (> 0)', () => {
    const layout = getStackLayout(
      makeArticle({ cluster_id: 'c', cluster_size: 2, cluster_position: 1 }),
      'portrait', NOW,
    )
    expect(layout.layersCount).toBe(1)
    expect(getLayerGeom(1).height - 14).toBe(4)
  })
})
