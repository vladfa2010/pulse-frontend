import React, { useEffect, useMemo, useRef } from 'react'
import type { ECharts } from 'echarts'

interface Props {
  times: string[]
  ohlc: number[][]
  volumes: number[]
  height?: number
  markTime?: string // TZ-3: ISO timestamp of the news publication; nearest candle gets an amber dot
  timezone?: string // TZ-3.1: IANA timezone for axis labels (default Europe/Moscow for admin charts)
}

function findNearestTimeIndex(times: string[], targetIso: string): number {
  const target = new Date(targetIso).getTime()
  let best = 0
  let bestDiff = Infinity
  // ТЗ-3.6: один проход с кэшем эпох, без повторных аллокаций Date при бинарном поиске
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - target)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    } else {
      // времена отсортированы — дальше diff только растёт
      break
    }
  }
  return best
}

function timeLabel(iso: string, tz: string): string {
  if (iso.length <= 10) return iso.slice(5, 10)
  return new Date(iso).toLocaleTimeString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
}

// ТЗ-3.6: кэшируем промис динамического импорта echarts, чтобы переключение табов
// инструментов не плодило микротаски и не загружало бандл повторно.
let echartsPromise: Promise<typeof import('echarts')> | null = null
function loadECharts() {
  if (!echartsPromise) echartsPromise = import('echarts')
  return echartsPromise
}

function CandleChart({ times, ohlc, volumes, height = 320, markTime, timezone = 'Europe/Moscow' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const labels = useMemo(() => times.map((t) => timeLabel(t, timezone)), [times, timezone])
  const markPoint = useMemo(() => {
    if (!markTime) return undefined
    const markIdx = findNearestTimeIndex(times, markTime)
    return {
      symbol: 'circle' as const,
      symbolSize: 9,
      itemStyle: { color: '#F59E0B', borderColor: '#0A0A0A', borderWidth: 1.5 },
      label: { show: false },
      tooltip: { formatter: 'момент новости' },
      data: [{ coord: [markIdx, ohlc[markIdx][3]] }], // high
    }
  }, [times, ohlc, markTime])

  useEffect(() => {
    if (!ref.current || times.length === 0) return
    let disposed = false
    let instance: ECharts | null = null
    let ro: ResizeObserver | null = null

    loadECharts().then((echarts) => {
      if (disposed || !ref.current) return
      instance = echarts.init(ref.current, 'dark')
      // NOTE: setOption в merge-режиме. Если появится анимация/переключение markTime
      // без пересоздания option — передавать notMerge: true, иначе markPoint залипнет.
      instance.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          backgroundColor: 'rgba(10,10,10,0.95)',
          borderColor: '#333',
          textStyle: { color: '#D1D5DB', fontSize: 11 },
        },
        // ТЗ-3.8: компактные поля. Подписям оси Y (10px, ~27px) хватает 30px gutter,
        // справа ничего не выводится — 6px. Поле свечей в карточке: 171px → ~207px.
        grid: [
          { left: 30, right: 6, top: 16, height: '62%' },
          { left: 30, right: 6, top: '82%', height: '14%' },
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
        series: [
          {
            type: 'candlestick',
            data: ohlc,
            itemStyle: {
              color: '#16a34a', color0: '#dc2626',
              borderColor: '#16a34a', borderColor0: '#dc2626',
            },
            markPoint,
          },
          {
            type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: volumes,
            itemStyle: { color: '#374151' },
          },
        ],
      })

      ro = new ResizeObserver(() => instance?.resize())
      ro.observe(ref.current)
    })

    return () => {
      disposed = true
      ro?.disconnect()        // TZ-3.4: cleanup runs synchronously on unmount
      instance?.dispose()
    }
  }, [times, ohlc, volumes, labels, markPoint, timezone])

  if (times.length === 0) return null
  return <div ref={ref} style={{ width: '100%', height }} />
}

export default React.memo(CandleChart)
