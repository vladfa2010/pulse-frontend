/**
 * =============================================================================
 * PULSE — График каскада: свечи + маркеры новостей (ТЗ-93, задача 4)
 * =============================================================================
 *
 * Переиспользует форму InstrumentChart из ТЗ-3 (та же, что /news-chart).
 * Построен по образцу CandleChart.tsx с добавлением:
 *   - scatter-маркеры новостей кластера: первая видимая новость — акцентная точка
 *     (первоисточник), дубли — меньшего размера; новость вне торговой сессии
 *     (нет свечи в момент публикации) — пунктирная «пустая» метка у ближайшей
 *     свечи (логика ближайшей свечи — на клиенте, по массиву times инструмента);
 *   - вертикальные markLine границ дней (как в мокапе), с подписью даты DD.MM
 *     в таймзоне биржи (ТЗ-97 §4.2);
 *   - ТЗ-97 §4.3 (уточнение): при truncated === true (каскад длиннее крышки 14 дней)
 *     маркеры вне [первая свеча − 30 мин; covered_until + 30 мин] не рисуются
 *     (считаются в чип «+N вне графика» в панели). Без truncated клиппинга нет —
 *     маркеры вне сессии пунктиром у ближайшей свечи, как обещает легенда;
 *   - ТЗ-97 §6: маркеры на одной свече группируются — один символ с числом,
 *     тултип — списком новостей группы.
 */

import React, { useEffect, useMemo, useRef } from 'react'
import type { ECharts } from 'echarts'
import type { InstrumentChart } from '@/lib/newsChart'
import type { NewsMarker } from '@/lib/cascadesApi'
import { findNearestTimeIndex } from '@/lib/marketTime'

/** Маркер, привязанный к свече: индекс, цена (close) и признак «внутри торговой сессии» */
export interface MarkerPoint {
  marker: NewsMarker
  index: number
  price: number
  inSession: boolean
  /** ТЗ-97 §4.3 (уточнение): новость вне охвата графика ([первая свеча − 30 мин; covered_until + 30 мин]) —
   *  не рисуется, учитывается в чипе «+N вне графика». Клиппинг применяется ТОЛЬКО при
   *  truncated === true (каскад длиннее крышки 14 дней). Без truncated маркеры вне сессии
   *  привязываются к ближайшей свече и рисуются пунктиром — как обещает легенда. */
  clipped: boolean
}

/** Максимальный зазор до ближайшей свечи (5-мин бар), при котором новость считается «в сессии» */
const IN_SESSION_MAX_GAP_MS = 5 * 60 * 1000

/** Запас за пределы крайних свечей, в пределах которого маркер ещё рисуется (ТЗ-97 §4.3) */
const CLIP_PADDING_MS = 30 * 60 * 1000

/** Привязывает новости каскада к свечам инструмента (ближайшая свеча по времени).
 *  При truncated === true маркеры вне [первая свеча − 30 мин; covered_until + 30 мин]
 *  помечаются clipped: true и отрисовываться не должны. Без truncated клиппинга нет. */
export function buildMarkerPoints(instrument: InstrumentChart, markers: NewsMarker[]): MarkerPoint[] {
  const { times, ohlc, covered_until, truncated } = instrument
  if (times.length === 0) return []
  const firstCandleMs = new Date(times[0]).getTime()
  const coveredMs = truncated && covered_until ? new Date(covered_until).getTime() : null
  return markers.map((marker) => {
    const index = findNearestTimeIndex(times, marker.published_at)
    const candleMs = new Date(times[index]).getTime()
    const newsMs = new Date(marker.published_at).getTime()
    const clipped =
      coveredMs !== null &&
      (newsMs < firstCandleMs - CLIP_PADDING_MS || newsMs > coveredMs + CLIP_PADDING_MS)
    return {
      marker,
      index,
      price: ohlc[index] ? ohlc[index][1] : 0, // close
      inSession: Math.abs(candleMs - newsMs) <= IN_SESSION_MAX_GAP_MS,
      clipped,
    }
  })
}

/** ТЗ-97 §6: маркеры, привязанные к одной свече, рисуются одним символом с числом,
 *  тултип — списком новостей группы. Порядок групп — по первому вхождению. */
export interface MarkerGroup {
  index: number
  price: number
  points: MarkerPoint[]
}

export function groupMarkersByCandle(points: MarkerPoint[]): MarkerGroup[] {
  const groups = new Map<number, MarkerGroup>()
  for (const p of points) {
    const g = groups.get(p.index)
    if (g) g.points.push(p)
    else groups.set(p.index, { index: p.index, price: p.price, points: [p] })
  }
  return [...groups.values()]
}

/** ТЗ-98: элементы scatter-серии маркеров. Вынесено в чистую функцию — регрессионный
 *  страж на форму данных (координата только в value-паре, поле coord запрещено:
 *  ECharts игнорирует coord у series.data и слепливает маркеры у левого края). */
export interface ScatterDataItem {
  value: [number, number]
  symbolSize: number
  label: { show: boolean; formatter?: string; color?: string; fontSize?: number; fontWeight?: 'bold' }
  itemStyle: Record<string, unknown>
}

export function buildScatterDataItems(
  groups: MarkerGroup[],
  firstVisibleMarker: MarkerPoint['marker'] | null,
  allMarkers: MarkerPoint[]
): ScatterDataItem[] {
  return groups.map((g) => {
    const single = g.points.length === 1
    const p = g.points[0]
    const isFirst = p.marker === firstVisibleMarker
    const order = allMarkers.indexOf(p)
    const allInSession = g.points.every((pt) => pt.inSession)
    return {
      // scatter-серия НЕ понимает поле coord (это только markPoint/markLine) —
      // координаты передаём в value: [индекс свечи, цена], иначе x молча
      // становится порядковым номером маркера и всё слепляется у левого края (ТЗ-98).
      value: [g.index, g.price],
      symbolSize: single ? (isFirst ? 12 : Math.max(5, 9 - order)) : 12,
      label: single
        ? { show: false }
        : { show: true, formatter: String(g.points.length), color: '#060606', fontSize: 9, fontWeight: 'bold' },
      itemStyle: isFirst
        ? { color: '#00D4FF', borderColor: '#FFFFFF', borderWidth: 1.5 }
        : allInSession
          ? { color: 'rgba(0,212,255,0.7)', borderColor: 'rgba(255,255,255,0.5)', borderWidth: 0.5 }
          : {
              color: single ? 'transparent' : 'rgba(10,10,10,0.55)',
              borderColor: '#00D4FF',
              borderWidth: 1.5,
              borderType: 'dashed',
            },
    }
  })
}

function timeLabel(iso: string, tz: string): string {
  if (iso.length <= 10) return iso.slice(5, 10)
  return new Date(iso).toLocaleTimeString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
}

/** Подпись границы дня — DD.MM в таймзоне биржи (ТЗ-97 §4.2, как в мокапе cascades.html) */
function dayLabel(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { timeZone: tz, day: '2-digit', month: '2-digit' })
}

// Кэшируем промис динамического импорта echarts (паттерн CandleChart.tsx)
let echartsPromise: Promise<typeof import('echarts')> | null = null
function loadECharts() {
  if (!echartsPromise) echartsPromise = import('echarts')
  return echartsPromise
}

interface Props {
  instrument: InstrumentChart
  markers: MarkerPoint[]
  height?: number
}

function CascadeChart({ instrument, markers, height = 300 }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const labels = useMemo(
    () => instrument.times.map((t) => timeLabel(t, instrument.timezone)),
    [instrument.times, instrument.timezone]
  )

  // Границы дней — вертикальные markLine (индексы свечей, где меняется дата в таймзоне биржи)
  const dayBoundaries = useMemo(() => {
    const bounds: number[] = []
    let prevDate = ''
    instrument.times.forEach((iso, i) => {
      const date = new Date(iso).toLocaleDateString('ru-RU', { timeZone: instrument.timezone })
      if (i > 0 && date !== prevDate) bounds.push(i)
      prevDate = date
    })
    return bounds
  }, [instrument.times, instrument.timezone])

  // Видимые маркеры, сгруппированные по свече (ТЗ-97 §6: дубликаты — один символ с числом)
  const markerGroups = useMemo(
    () => groupMarkersByCandle(markers.filter((p) => !p.clipped)),
    [markers]
  )
  // Акцентная точка — первый видимый маркер (первоисточник; первый маркер может быть clipped)
  const firstVisibleMarker = useMemo(
    () => markers.find((p) => !p.clipped)?.marker ?? null,
    [markers]
  )

  useEffect(() => {
    if (!ref.current || instrument.times.length === 0) return
    let disposed = false
    let instance: ECharts | null = null
    let ro: ResizeObserver | null = null

    loadECharts().then((echarts) => {
      if (disposed || !ref.current) return
      instance = echarts.init(ref.current, 'dark')
      instance.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          backgroundColor: 'rgba(10,10,10,0.95)',
          borderColor: '#333',
          textStyle: { color: '#D1D5DB', fontSize: 11 },
        },
        grid: [
          { left: 34, right: 6, top: 16, height: '62%' },
          { left: 34, right: 6, top: '82%', height: '14%' },
        ],
        xAxis: [
          { type: 'category', data: labels, scale: true, boundaryGap: false,
            axisLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#6B7280', fontSize: 10 } },
          { type: 'category', gridIndex: 1, data: labels,
            axisLine: { lineStyle: { color: '#333' } }, axisLabel: { show: false } },
        ],
        yAxis: [
          { scale: true, splitLine: { lineStyle: { color: '#1F2937' } }, axisLabel: { color: '#6B7280', fontSize: 10 } },
          { gridIndex: 1, splitLine: { show: false }, axisLabel: { show: false } },
        ],
        dataZoom: [{ type: 'inside', xAxisIndex: [0, 1], filterMode: 'none' }],
        series: [
          {
            type: 'candlestick',
            data: instrument.ohlc,
            itemStyle: {
              color: '#16a34a', color0: '#dc2626',
              borderColor: '#16a34a', borderColor0: '#dc2626',
            },
            markLine: {
              silent: true,
              symbol: 'none',
              label: { show: false },
              lineStyle: { color: 'rgba(255,255,255,0.08)', type: 'solid' as const },
              // Подпись границы — дата (DD.MM) первой свечи нового дня в таймзоне биржи (ТЗ-97 §4.2)
              data: dayBoundaries.map((i) => ({
                xAxis: i,
                label: {
                  show: true,
                  formatter: () => dayLabel(instrument.times[i], instrument.timezone),
                  color: '#555',
                  fontSize: 9,
                },
              })),
            },
          },
          {
            type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: instrument.volumes,
            itemStyle: { color: '#374151' },
          },
          {
            // Маркеры новостей: первая — акцентная (первоисточник), дубли меньше,
            // вне сессии — «пустой» кружок с пунктирной обводкой у ближайшей свечи.
            // ТЗ-97 §6: маркеры на одной свече группируются — один символ с числом,
            // тултип — списком новостей группы.
            type: 'scatter',
            data: buildScatterDataItems(markerGroups, firstVisibleMarker, markers),
            tooltip: {
              formatter: (params: any) => {
                const g = markerGroups[params.dataIndex]
                if (!g) return ''
                const lines = g.points.map((p) => {
                  const time = new Date(p.marker.published_at).toLocaleString('ru-RU', {
                    timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })
                  const suffix = p.inSession ? '' : ' · вне торговой сессии'
                  return `${p.marker.title}<br/>${p.marker.source} · ${time}${suffix}`
                })
                return lines.join(g.points.length > 1 ? '<br/><br/>' : '')
              },
            },
            z: 10,
          },
        ],
      })

      ro = new ResizeObserver(() => instance?.resize())
      ro.observe(ref.current)
    })

    return () => {
      disposed = true
      ro?.disconnect()
      instance?.dispose()
    }
  }, [instrument, labels, markers, dayBoundaries, markerGroups, firstVisibleMarker])

  if (instrument.times.length === 0) return null
  return <div ref={ref} style={{ width: '100%', height }} />
}

export default React.memo(CascadeChart)
