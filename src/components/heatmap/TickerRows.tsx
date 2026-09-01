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

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
    >
      <span className="text-xs font-medium text-text-primary w-20 text-left uppercase">
        {grid.tag_id}
      </span>
      <div className="flex flex-wrap gap-0.5">
        {grid.cells.map((cell) => {
          const color = getHeatColor(cell.stories, grid.quantiles, cell.sentiment_sign)
          return (
            <div
              key={cell.date}
              title={`${cell.date}: ${cell.stories}`}
              style={{
                width: 6,
                height: 6,
                borderRadius: 1,
                backgroundColor: color.bg,
              }}
            />
          )
        })}
      </div>
      <span className="text-[10px] text-text-muted ml-auto">
        {nonzero} дней
      </span>
    </button>
  )
}
