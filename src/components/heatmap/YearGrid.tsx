import { useMemo } from 'react'
import { HeatmapCell, Instrument } from './types'
import { getHeatColor } from './heatColors'

interface YearGridProps {
  cells: HeatmapCell[]
  quantiles: number[]
  instrument?: Instrument | null
  mini?: boolean
  hoveredDate?: string | null
  onHoverDate?: (date: string | null) => void
  onSelectDate?: (date: string) => void
}

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTH_LABELS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

export default function YearGrid({
  cells,
  quantiles,
  mini = false,
  hoveredDate,
  onHoverDate,
  onSelectDate,
}: YearGridProps) {
  const weeks = useMemo(() => {
    const result: HeatmapCell[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7))
    }
    return result
  }, [cells])

  const monthLabels = useMemo(() => {
    const labels: { index: number; label: string }[] = []
    let lastMonth = -1
    cells.forEach((cell, index) => {
      const d = new Date(cell.date + 'T00:00:00')
      const m = d.getMonth()
      if (m !== lastMonth && index % 7 === 0) {
        labels.push({ index: Math.floor(index / 7), label: MONTH_LABELS[m] })
        lastMonth = m
      }
    })
    return labels
  }, [cells])

  const cellSize = mini ? 8 : 14
  const gap = mini ? 2 : 3
  const radius = mini ? 1.5 : 3

  return (
    <div className="w-full">
      {!mini && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1.5">
            {monthLabels.map((m) => (
              <span
                key={m.index + m.label}
                className="text-[10px] text-text-muted absolute"
                style={{ transform: `translateX(${m.index * (cellSize + gap)}px)` }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex">
        {!mini && (
          <div className="flex flex-col mr-2" style={{ gap }}>
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-[10px] text-text-muted flex items-center justify-center"
                style={{ width: cellSize, height: cellSize }}
              >
                {label}
              </div>
            ))}
          </div>
        )}

        <div className="flex" style={{ gap }}>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col" style={{ gap }}>
              {week.map((cell) => {
                const color = getHeatColor(cell.stories, quantiles, cell.sentiment_sign)
                const isHovered = hoveredDate === cell.date
                const isDimmed = hoveredDate && hoveredDate !== cell.date
                return (
                  <button
                    key={cell.date}
                    type="button"
                    title={`${cell.date}: ${cell.stories} новостей`}
                    onMouseEnter={() => onHoverDate?.(cell.date)}
                    onMouseLeave={() => onHoverDate?.(null)}
                    onClick={() => onSelectDate?.(cell.date)}
                    className="transition-transform duration-150"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: radius,
                      backgroundColor: color.bg,
                      boxShadow: isHovered ? color.glow || 'none' : 'none',
                      transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                      opacity: isDimmed ? 0.35 : 1,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
