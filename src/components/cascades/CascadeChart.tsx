/**
 * =============================================================================
 * PULSE — График каскада: свечи + маркеры новостей (ТЗ-93, задача 4)
 * =============================================================================
 *
 * Переиспользует форму InstrumentChart из ТЗ-3 (та же, что /news-chart).
 * Построен по образцу CandleChart.tsx с добавлением:
 *   - scatter-маркеры новостей кластера: первая новость — акцентная точка
 *     (первоисточник), дубли — меньшего размера; новость вне торговой сессии
 *     (нет свечи в момент публикации) — пунктирная «пустая» метка у ближайшей
 *     свечи (логика ближайшей свечи — на клиенте, по массиву times инструмента);
 *   - вертикальные markLine границ дней (как в мокапе).
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
}

/** Максимальный зазор до ближайшей свечи (5-мин бар), при котором новость считается «в сессии» */
const IN_SESSION_MAX_GAP_MS = 5 * 60 * 1000

/** Привязывает новости каскада к свечам инструмента (ближайшая свеча по времени) */
export function buildMarkerPoints(instrument: InstrumentChart, markers: NewsMarker[]): MarkerPoint[] {
  const { times, ohlc } = instrument
  if (times.length === 0) return []
  return markers.map((marker) => {
    const index = findNearestTimeIndex(times, marker.published_at)
    const candleMs = new Date(times[index]).getTime()
    const newsMs = new Date(marker.published_at).getTime()
    return {
      marker,
      index,
      price: ohlc[index] ? ohlc[index][1] : 0, // close
      inSession: Math.abs(candleMs - newsMs) <= IN_SESSION_MAX_GAP_MS,
    }
  })
}

function timeLabel(iso: string, tz: string): string {
  if (iso.length <= 10) return iso.slice(5, 10)
  return new Date(iso).toLocaleTimeString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
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
              data: dayBoundaries.map((i) => ({ xAxis: i })),
            },
          },
          {
            type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: instrument.volumes,
            itemStyle: { color: '#374151' },
          },
          {
            // Маркеры новостей: первая — акцентная (первоисточник), дубли меньше,
            // вне сессии — «пустой» кружок с пунктирной обводкой у ближайшей свечи
            type: 'scatter',
            data: markers.map((p, i) => ({
              coord: [p.index, p.price],
              value: p.price,
              symbolSize: i === 0 ? 12 : Math.max(5, 9 - i),
              itemStyle: i === 0
                ? { color: '#00D4FF', borderColor: '#FFFFFF', borderWidth: 1.5 }
                : p.inSession
                  ? { color: 'rgba(0,212,255,0.7)', borderColor: 'rgba(255,255,255,0.5)', borderWidth: 0.5 }
                  : { color: 'transparent', borderColor: '#00D4FF', borderWidth: 1.5, borderType: 'dashed' as const },
            })),
            tooltip: {
              formatter: (params: any) => {
                const p = markers[params.dataIndex]
                if (!p) return ''
                const time = new Date(p.marker.published_at).toLocaleString('ru-RU', {
                  timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })
                const suffix = p.inSession ? '' : ' · вне торговой сессии'
                return `${p.marker.title}<br/>${p.marker.source} · ${time}${suffix}`
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
  }, [instrument, labels, markers, dayBoundaries])

  if (instrument.times.length === 0) return null
  return <div ref={ref} style={{ width: '100%', height }} />
}

export default React.memo(CascadeChart)
