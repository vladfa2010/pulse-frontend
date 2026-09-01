import { useMemo } from 'react'
import { HeatmapCell, Instrument } from './types'
import { getOverlayColor, HeatmapOverlay } from './heatColors'
import { weekMondayOf } from './TopChart'

interface YearGridProps {
  cells: HeatmapCell[]
  quantiles: number[]
  instrument?: Instrument | null
  mini?: boolean
  overlay?: HeatmapOverlay
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
  overlay = 'sentiment',
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

  const hoveredMonday = hoveredDate ? weekMondayOf(hoveredDate) : null

  return (
    <div className="w-full">
      {!mini && (
        <div
          className="relative mb-2 h-4"
          style={{ width: weeks.length * (cellSize + gap) - gap }}
        >
          {monthLabels.map((m) => (
            <span
              key={m.index + m.label}
              className="text-[10px] text-text-muted absolute top-0 whitespace-nowrap"
              style={{ transform: `translateX(${m.index * (cellSize + gap)}px)` }}
            >
              {m.label}
            </span>
          ))}
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
                const color = getOverlayColor(cell, quantiles, overlay)
                const isHovered = hoveredMonday !== null && weekMondayOf(cell.date) === hoveredMonday
                const isDimmed = hoveredMonday !== null && weekMondayOf(cell.date) !== hoveredMonday
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
