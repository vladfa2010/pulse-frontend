import { useMemo, useState } from 'react'
import { CandlesPayload, HeatmapCell } from './types'
import { getVolumeDeltaColor } from './heatColors'

interface TopChartProps {
  candles: CandlesPayload
  yearCells: HeatmapCell[]
  onHoverWeek?: (date: string | null) => void
}

export default function TopChart({ candles, yearCells, onHoverWeek }: TopChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const chartHeight = 180
  const chartPadding = { top: 24, right: 8, bottom: 24, left: 40 }

  const data = useMemo(() => {
    const cellMap = new Map(yearCells.map((c) => [c.date, c]))
    return candles.full_dates.map((date, i) => {
      const weekDates: string[] = []
      const monday = new Date(date + 'T00:00:00')
      for (let d = 0; d < 7; d++) {
        const cur = new Date(monday)
        cur.setDate(monday.getDate() + d)
        weekDates.push(cur.toISOString().slice(0, 10))
      }
      const weekCells = weekDates.map((d) => cellMap.get(d)).filter(Boolean) as HeatmapCell[]
      const pos = weekCells.reduce((s, c) => s + c.pos, 0)
      const neg = weekCells.reduce((s, c) => s + c.neg, 0)
      const stories = weekCells.reduce((s, c) => s + c.stories, 0)
      return {
        date,
        ohlc: candles.ohlc[i],
        volume: candles.volumes[i],
        pos,
        neg,
        stories,
      }
    })
  }, [candles, yearCells])

  if (data.length === 0) return null

  const prices = data.flatMap((d) => d.ohlc)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const priceRange = Math.max(maxPrice - minPrice, 0.0001)

  const maxStories = Math.max(...data.map((d) => d.stories), 1)

  const chartWidth = data.length * 10 + chartPadding.left + chartPadding.right

  function yPrice(price: number) {
    return chartPadding.top + (1 - (price - minPrice) / priceRange) * (chartHeight - chartPadding.top - chartPadding.bottom)
  }

  function yVolume(stories: number) {
    return chartHeight - chartPadding.bottom - (stories / maxStories) * (chartHeight - chartPadding.top - chartPadding.bottom) * 0.35
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null
  const last = data[data.length - 1]

  return (
    <div className="w-full">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-sm font-bold text-white">{candles.ticker}</div>
          {last && (
            <div className="text-[10px] text-text-muted">
              {last.ohlc[1].toFixed(2)}
            </div>
          )}
        </div>
        {hovered && (
          <div className="text-[10px] text-text-secondary text-right">
            <div className="text-white">
              {hovered.date} · {hovered.ohlc[1].toFixed(2)}
            </div>
            <div className="text-text-muted">
              О {hovered.ohlc[0]} · М {hovered.ohlc[2]} · Мин {hovered.ohlc[3]} · З {hovered.ohlc[1]}
            </div>
            <div>
              {hovered.stories} новостей · поз {hovered.pos} / нег {hovered.neg}
            </div>
          </div>
        )}
      </div>

      <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
        {/* zero / grid line */}
        <line
          x1={chartPadding.left}
          y1={yPrice(minPrice)}
          x2={chartWidth - chartPadding.right}
          y2={yPrice(minPrice)}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />

        {data.map((d, i) => {
          const x = chartPadding.left + i * 10 + 5
          const [open, close, low, high] = d.ohlc
          const delta = d.pos - d.neg
          const color = getVolumeDeltaColor(delta)

          return (
            <g
              key={d.date}
              onMouseEnter={() => {
                setHoverIndex(i)
                onHoverWeek?.(d.date)
              }}
              onMouseLeave={() => {
                setHoverIndex(null)
                onHoverWeek?.(null)
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* volume / stories bar (pale) */}
              <rect
                x={x - 3}
                y={yVolume(d.stories)}
                width={6}
                height={chartHeight - chartPadding.bottom - yVolume(d.stories)}
                fill={color}
                opacity={0.15}
                rx={1}
              />
              {/* delta bar */}
              <rect
                x={x - 3}
                y={delta >= 0 ? yVolume(Math.abs(delta)) : yVolume(0)}
                width={6}
                height={Math.abs(yVolume(0) - yVolume(Math.abs(delta)))}
                fill={color}
                opacity={0.85}
                rx={1}
              />
              {/* candle wick */}
              <line
                x1={x}
                y1={yPrice(high)}
                x2={x}
                y2={yPrice(low)}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth={1}
              />
              {/* candle body */}
              <rect
                x={x - 2}
                y={yPrice(Math.max(open, close))}
                width={4}
                height={Math.max(1, Math.abs(yPrice(open) - yPrice(close)))}
                fill={open > close ? '#F87171' : '#34D399'}
                rx={1}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
