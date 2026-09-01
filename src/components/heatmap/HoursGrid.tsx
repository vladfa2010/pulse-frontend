import { useMemo } from 'react'
import { HourCell } from './types'

interface HoursGridProps {
  cells: HourCell[]
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)

export default function HoursGrid({ cells }: HoursGridProps) {
  const data = useMemo(() => {
    const dayMap = new Map<string, Map<number, number>>()
    const days: string[] = []
    for (const cell of cells) {
      if (!dayMap.has(cell.day)) {
        dayMap.set(cell.day, new Map())
        days.push(cell.day)
      }
      dayMap.get(cell.day)!.set(cell.hour, cell.stories)
    }
    return { days, dayMap }
  }, [cells])

  const maxStories = useMemo(() => {
    return Math.max(...cells.map((c) => c.stories), 1)
  }, [cells])

  if (cells.length === 0) {
    return <div className="text-sm text-text-muted">Нет данных за выбранный период</div>
  }

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="min-w-[600px]">
        <div className="flex">
          <div className="w-12 flex-shrink-0" />
          {HOUR_LABELS.map((h) => (
            <div key={h} className="flex-1 text-[9px] text-text-muted text-center">
              {h}
            </div>
          ))}
        </div>
        {data.days.map((day) => (
          <div key={day} className="flex items-center py-0.5">
            <div className="w-12 text-[10px] text-text-muted flex-shrink-0">
              {day.slice(5)}
            </div>
            {Array.from({ length: 24 }, (_, hour) => {
              const stories = data.dayMap.get(day)?.get(hour) || 0
              const intensity = stories / maxStories
              return (
                <div
                  key={hour}
                  className="flex-1 h-5 mx-px rounded-sm"
                  title={`${day} ${String(hour).padStart(2, '0')}:00 — ${stories}`}
                  style={{
                    backgroundColor: stories > 0
                      ? `rgba(0, 212, 255, ${Math.max(0.15, intensity)})`
                      : 'rgba(255,255,255,0.04)',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
