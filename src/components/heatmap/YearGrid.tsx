import { useEffect, useMemo, useRef } from 'react'
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
  cells = [],
  quantiles = [],
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

  const gap = mini ? 2 : 3
  const radius = mini ? 1.5 : 3
  // Резиновая сетка (fix5): недели делят ширину карточки поровну (flex-1) —
  // сетка всегда ширины TopChart (приёмка мастер-ТЗ №2: «SVG = сетка»).
  // Ниже minWidth включается горизонтальный скролл (fix4).
  const minCell = mini ? 8 : 10
  const labelsW = mini ? 0 : 22 // колонка «Пн..Вс»: 14px + mr-2 (8px) = LEFT_PAD у TopChart
  const minWidth = labelsW + weeks.length * (minCell + gap) - gap

  const hoveredMonday = hoveredDate ? weekMondayOf(hoveredDate) : null

  // Сетка фиксированной ширины (≈923px / mini ≈530px) шире мобильного viewport:
  // горизонтальный скролл контейнера (мастер-ТЗ п.4.3). Закрывает и страницу,
  // и мини-блок на главной — один компонент.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // По умолчанию прокручиваем к правому краю — свежие дни видны сразу
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [cells])

  return (
    <div ref={scrollRef} className="w-full overflow-x-auto pb-1">
      {/* внутренняя обёртка: при скролле месяцы и сетка имеют общую ширину */}
      <div style={{ minWidth }}>
        {!mini && (
          <div
            className="relative mb-2 h-4"
            style={{ marginLeft: labelsW, width: `calc(100% - ${labelsW}px)` }}
          >
            {monthLabels.map((m) => (
              <span
                key={m.index + m.label}
                className="text-[10px] text-text-muted absolute top-0 whitespace-nowrap"
                style={{ left: `${(m.index / weeks.length) * 100}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
        )}

        <div className="flex w-full">
          {!mini && (
            <div
              className="grid flex-shrink-0 mr-2"
              style={{ width: 14, gridTemplateRows: 'repeat(7, minmax(0, 1fr))', gap }}
            >
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-[10px] text-text-muted flex items-center justify-center"
                >
                  {label}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-1" style={{ gap }}>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col flex-1" style={{ gap }}>
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
                      className="w-full aspect-square transition-transform duration-150 relative"
                      style={{
                        borderRadius: radius,
                        backgroundColor: color.bg,
                        boxShadow: isHovered ? color.glow || 'none' : 'none',
                        transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                        opacity: isDimmed ? 0.35 : 1,
                      }}
                    >
                      {/* Всплеск: янтарная точка в углу ячейки (мастер-ТЗ п.4.3), заливка остаётся частотной */}
                      {overlay === 'spikes' && cell.spike && (
                        <span
                          className="absolute rounded-full"
                          style={{
                            top: -3, right: -3, width: 6, height: 6,
                            background: '#F59E0B',
                            boxShadow: '0 0 6px rgba(245,158,11,.6)',
                          }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
