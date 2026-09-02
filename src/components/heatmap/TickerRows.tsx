import { useEffect, useState, useMemo } from 'react'
import { api } from '@/lib/api'
import { HeatmapCell } from './types'
import { getHeatColor } from './heatColors'

interface TickerGrid {
  tag_id: string
  cells: HeatmapCell[]
  quantiles: number[]
}

interface TickerRowsProps {
  tagIds: string[]
  onSelectTag?: (tagId: string) => void
}

export default function TickerRows({ tagIds, onSelectTag }: TickerRowsProps) {
  const [grids, setGrids] = useState<TickerGrid[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (tagIds.length === 0) {
      setGrids([])
      return
    }
    setLoading(true)
    api
      .get(`/news_heatmap/mini-grids?tag_ids=${encodeURIComponent(tagIds.join(','))}`)
      .then((data) => {
        setGrids(data.grids || [])
      })
      .catch((err) => {
        setError(err.message || 'Failed to load ticker grids')
      })
      .finally(() => setLoading(false))
  }, [tagIds.join(',')])

  if (tagIds.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">Плотность ваших тегов</h3>
      {loading && <div className="h-20 rounded-xl bg-white/5 animate-pulse" />}
      {error && <div className="text-xs text-text-error">{error}</div>}
      <div className="space-y-2">
        {grids.map((grid) => (
          <TickerRow key={grid.tag_id} grid={grid} onClick={() => onSelectTag?.(grid.tag_id)} />
        ))}
      </div>
    </div>
  )
}

function TickerRow({ grid, onClick }: { grid: TickerGrid; onClick?: () => void }) {
  const nonzero = useMemo(
    () => grid.cells.filter((c) => c.stories > 0).length,
    [grid.cells]
  )

  // Мини-сетка 7×53 (fix8): колонки = недели (Пн–Вс), как основная сетка (мастер-ТЗ п.4.4).
  // cells начинаются с понедельника (backend buildYearDates) — чанкуем по 7.
  const weeks = useMemo(() => {
    const result: HeatmapCell[][] = []
    for (let i = 0; i < grid.cells.length; i += 7) {
      result.push(grid.cells.slice(i, i + 7))
    }
    return result
  }, [grid.cells])

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-0 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
    >
      {/* fix9: тикер + счётчик дней одной строкой НАД сеткой (как в мокапе).
          Справа от сетки ничего нет — ширина мини-сетки = ширине основной. */}
      <div className="flex items-baseline gap-2 mb-1.5 px-2">
        <span className="text-xs font-medium text-text-primary uppercase">{grid.tag_id}</span>
        <span className="text-[10px] text-text-muted">{nonzero} дней</span>
      </div>
      {/* marginLeft = колонке «Пн..Вс» основной сетки (14 + mr-2 = 22) → колонки совпадают по оси X */}
      <div className="overflow-x-auto" style={{ marginLeft: 22 }}>
        <div className="flex gap-0.5" style={{ minWidth: weeks.length * 10 }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5 flex-1">
              {week.map((cell) => {
                const color = getHeatColor(cell.stories, grid.quantiles, cell.sentiment_sign)
                return (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.stories}`}
                    className="w-full"
                    style={{ height: 9, borderRadius: 2, backgroundColor: color.bg }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </button>
  )
}
