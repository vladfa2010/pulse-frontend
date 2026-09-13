/**
 * ТЗ-97 §4.3 / §6 — клиппинг маркеров по covered_until и группировка дубликатов на одной свече.
 */
import { describe, it, expect } from 'vitest'
import { buildMarkerPoints, groupMarkersByCandle, buildScatterDataItems } from '@/components/cascades/CascadeChart'
import type { InstrumentChart } from '@/lib/newsChart'
import type { NewsMarker } from '@/lib/cascadesApi'

function makeInstrument(overrides: Partial<InstrumentChart> = {}): InstrumentChart {
  return {
    tag_id: 't1',
    tag_name: 'IMOEX',
    symbol: 'IMOEXF@RTSX',
    date: '2026-09-07',
    shifted: false,
    timezone: 'UTC',
    exchange_mic: 'RTSX',
    exchange_name: 'RTS',
    // 3 свечи 06:55–07:05 UTC
    times: ['2026-09-07T06:55:00Z', '2026-09-07T07:00:00Z', '2026-09-07T07:05:00Z'],
    ohlc: [
      [100, 101, 99, 100.5],
      [101, 102, 100, 101.5],
      [102, 103, 101, 102.5],
    ],
    volumes: [10, 20, 30],
    ...overrides,
  }
}

function makeMarker(published_at: string): NewsMarker {
  return { published_at, title: `Новость ${published_at}`, source: 'test' }
}

describe('buildMarkerPoints (ТЗ-97 §4.3, уточнение: клиппинг только при truncated)', () => {
  it('без covered_until (однодневный payload) клиппинга нет — всегда clipped=false', () => {
    const instrument = makeInstrument()
    const markers = [
      makeMarker('2026-09-07T06:56:00Z'), // в сессии
      makeMarker('2026-09-08T20:00:00Z'), // далеко за пределами дня
    ]
    const points = buildMarkerPoints(instrument, markers)
    expect(points).toHaveLength(2)
    expect(points.every((p) => !p.clipped)).toBe(true)
    expect(points[0].inSession).toBe(true)
    expect(points[0].index).toBe(0)
    // дальняя новость привязывается к ближайшей свече, как раньше
    expect(points[1].index).toBe(2)
    expect(points[1].inSession).toBe(false)
  })

  it('каскад целиком вне сессии (сб–вс, covered_until = пятница): без truncated клиппинга НЕТ — маркеры у крайних свечей', () => {
    // Репродукция прода: свечей только за пятницу, covered_until — пятничный вечер,
    // но truncated отсутствует → все маркеры видны (пунктир у крайней свечи), чип пустой
    const instrument = makeInstrument({ covered_until: '2026-09-07T07:05:00Z' })
    const markers = [
      makeMarker('2026-09-05T12:00:00Z'), // суббота — до первой свечи
      makeMarker('2026-09-06T15:00:00Z'), // воскресенье
      makeMarker('2026-09-08T10:00:00Z'), // понедельник — после covered_until
    ]
    const points = buildMarkerPoints(instrument, markers)
    expect(points.every((p) => !p.clipped)).toBe(true)
    // привязка — к ближайшей свече: суббота и воскресенье → свеча 0, понедельник → свеча 2
    expect(points.map((p) => p.index)).toEqual([0, 0, 2])
    expect(points.every((p) => !p.inSession)).toBe(true)
  })

  it('с truncated маркеры вне [первая свеча − 30 мин; covered_until + 30 мин] клиппятся', () => {
    const instrument = makeInstrument({ covered_until: '2026-09-07T07:05:00Z', truncated: true })
    const markers = [
      makeMarker('2026-09-07T06:25:00Z'), // ровно на −30 мин от первой свечи — виден
      makeMarker('2026-09-07T06:24:59Z'), // на минуту раньше — скрыт
      makeMarker('2026-09-07T06:40:00Z'), // между свечами — виден (вне сессии)
      makeMarker('2026-09-07T07:35:00Z'), // ровно на +30 мин от covered_until — виден
      makeMarker('2026-09-07T07:35:01Z'), // дальше — скрыт
    ]
    const points = buildMarkerPoints(instrument, markers)
    expect(points.map((p) => p.clipped)).toEqual([false, true, false, false, true])
    // клиппинг не ломает привязку видимых маркеров
    expect(points[0].index).toBe(0)
    expect(points[2].index).toBe(0) // 06:40 ближе к 06:55
    expect(points[3].index).toBe(2)
  })
})

describe('groupMarkersByCandle (ТЗ-97 §6)', () => {
  it('группирует маркеры одной свечи, сохраняя порядок первого вхождения', () => {
    const instrument = makeInstrument()
    const markers = [
      makeMarker('2026-09-07T06:55:00Z'), // свеча 0
      makeMarker('2026-09-07T07:00:00Z'), // свеча 1
      makeMarker('2026-09-07T06:57:00Z'), // свеча 0 (дубликат)
    ]
    const groups = groupMarkersByCandle(buildMarkerPoints(instrument, markers))
    expect(groups).toHaveLength(2)
    expect(groups[0].index).toBe(0)
    expect(groups[0].points).toHaveLength(2)
    expect(groups[1].index).toBe(1)
    expect(groups[1].points).toHaveLength(1)
    expect(groups[0].points[0].marker.title).toBe('Новость 2026-09-07T06:55:00Z')
  })

  it('clipped-маркеры исключаются из группировки до вызова (контракт вызывающего)', () => {
    const instrument = makeInstrument({ covered_until: '2026-09-07T07:05:00Z', truncated: true })
    const markers = [
      makeMarker('2026-09-07T06:55:00Z'),
      makeMarker('2026-09-08T10:00:00Z'), // скрыт
    ]
    const visible = buildMarkerPoints(instrument, markers).filter((p) => !p.clipped)
    const groups = groupMarkersByCandle(visible)
    expect(groups).toHaveLength(1)
    expect(groups[0].points).toHaveLength(1)
  })
})

describe('buildScatterDataItems (ТЗ-98: регрессионный страж формы scatter-данных)', () => {
  it('позиция только в value-паре [index, price]; поле coord отсутствует', () => {
    const instrument = makeInstrument()
    const markers = [
      makeMarker('2026-09-07T06:55:00Z'), // свеча 0
      makeMarker('2026-09-07T06:57:00Z'), // свеча 0 (дубликат — группа)
      makeMarker('2026-09-07T07:00:00Z'), // свеча 1
    ]
    const points = buildMarkerPoints(instrument, markers)
    const groups = groupMarkersByCandle(points)
    const items = buildScatterDataItems(groups, points[0].marker, points)

    expect(items).toHaveLength(2)
    for (const item of items) {
      // ТЗ-98: ECharts series.scatter игнорирует coord и берёт X из value —
      // value обязан быть массивом-парой [индекс свечи, цена].
      expect(Array.isArray(item.value)).toBe(true)
      expect(item.value).toHaveLength(2)
      expect('coord' in item).toBe(false)
    }
    expect(items[0].value[0]).toBe(0) // группа на свече 0
    expect(items[0].value[1]).toBe(groups[0].price)
    expect(items[1].value[0]).toBe(1)
    // у группы (>1 маркер) label с числом
    expect(items[0].label.show).toBe(true)
    expect(items[0].label.formatter).toBe('2')
    expect(items[1].label.show).toBe(false)
  })
})
