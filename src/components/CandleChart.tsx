import { useEffect, useRef } from 'react'

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
  times.forEach((t, i) => {
    const diff = Math.abs(new Date(t).getTime() - target)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  })
  return best
}

function timeLabel(iso: string, tz: string): string {
  if (iso.length <= 10) return iso.slice(5, 10)
  return new Date(iso).toLocaleTimeString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
}

export default function CandleChart({ times, ohlc, volumes, height = 320, markTime, timezone = 'Europe/Moscow' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || times.length === 0) return
    let disposed = false
    let instance: any = null

    const labels = times.map((t) => timeLabel(t, timezone))
    const markPoint = markTime
      ? {
          symbol: 'circle' as const,
          symbolSize: 9,
          itemStyle: { color: '#F59E0B', borderColor: '#0A0A0A', borderWidth: 1.5 },
          label: { show: false },
          tooltip: { formatter: 'момент новости' },
          data: [
            {
              coord: [
                findNearestTimeIndex(times, markTime),
                ohlc[findNearestTimeIndex(times, markTime)][3], // high
              ],
            },
          ],
        }
      : undefined

    import('echarts').then((echarts) => {
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
          { left: 56, right: 16, top: 16, height: '62%' },
          { left: 56, right: 16, top: '82%', height: '14%' },
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
      const onResize = () => instance?.resize()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    })

    return () => { disposed = true; instance?.dispose() }
  }, [times, ohlc, volumes, markTime, timezone])

  if (times.length === 0) return null
  return <div ref={ref} style={{ width: '100%', height }} />
}
