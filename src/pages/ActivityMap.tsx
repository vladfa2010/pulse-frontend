/**
 * =============================================================================
 * PULSE — News activity heatmap page (TZ 11.11)
 * =============================================================================
 */

import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useHeatmapState } from '@/components/heatmap/useHeatmapState'
import YearGrid from '@/components/heatmap/YearGrid'
import TopChart from '@/components/heatmap/TopChart'
import TickerRows from '@/components/heatmap/TickerRows'
import HoursGrid from '@/components/heatmap/HoursGrid'
import DayDigest from '@/components/heatmap/DayDigest'
import EmptyStub from '@/components/heatmap/EmptyStub'
import type { Scope, Scale } from '@/components/heatmap/types'

const SCOPE_LABELS: Record<Scope, string> = {
  all: 'Весь рынок',
  portfolio: 'Мой портфель',
  tag: 'Тег',
}

const SCALE_LABELS: Record<Scale, string> = {
  year: 'Год',
  day: 'День',
  day_hours: 'Часы',
}

export default function ActivityMap() {
  const { isLoggedIn, portfolio } = useAuth()
  const {
    state,
    setScope,
    setScale,
    setTagId,
    setDate,
    setHoveredDate,
  } = useHeatmapState()

  const portfolioTagIds = useMemo(
    () => portfolio.map((p) => p.tag_id),
    [portfolio]
  )

  const canShowChart = state.scope === 'tag'
    ? Boolean(state.year?.instrument)
    : true

  const availableScopes: Scope[] = isLoggedIn
    ? ['all', 'portfolio', 'tag']
    : ['all']

  return (
    <div className="min-h-screen px-4 md:px-6 pt-24 pb-16 max-w-[1200px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Новостная активность</h1>
        <p className="text-sm text-text-muted">
          Тепловая карта новостей по вашему портфелю, тегу или всему рынку.
        </p>
      </header>

      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div className="flex items-center gap-2 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
          {availableScopes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                state.scope === s
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {SCOPE_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
          {(Object.keys(SCALE_LABELS) as Scale[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScale(s)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                state.scale === s
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {SCALE_LABELS[s]}
            </button>
          ))}
        </div>

        {state.scope === 'tag' && (
          <input
            type="text"
            value={state.tagId}
            onChange={(e) => setTagId(e.target.value.toLowerCase())}
            placeholder="ticker или tag_id"
            className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary"
          />
        )}

        {state.scale === 'day' && (
          <input
            type="date"
            value={state.date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-text-primary focus:outline-none focus:border-accent-primary"
          />
        )}
      </div>

      {state.loading && (
        <div className="space-y-4">
          <div className="h-48 rounded-xl bg-white/5 animate-pulse" />
          <div className="h-64 rounded-xl bg-white/5 animate-pulse" />
        </div>
      )}

      {state.error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-text-error mb-4">
          {state.error}
        </div>
      )}

      {!state.loading && !state.error && state.year?.meta.empty && (
        <EmptyStub scope={state.scope} />
      )}

      {!state.loading && !state.error && !state.year?.meta.empty && (
        <>
          {state.scale === 'year' && state.year && (
            <div className="space-y-6">
              {/* Top chart */}
              {canShowChart && state.candles && (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                  <TopChart
                    candles={state.candles}
                    yearCells={state.year.cells}
                    onHoverWeek={setHoveredDate}
                  />
                </div>
              )}

              {/* Year grid */}
              <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                <YearGrid
                  cells={state.year.cells}
                  quantiles={state.year.quantiles}
                  instrument={state.year.instrument}
                  hoveredDate={state.hoveredDate}
                  onHoverDate={setHoveredDate}
                  onSelectDate={(d) => {
                    setDate(d)
                    setScale('day')
                  }}
                />
              </div>

              {/* Per-tag rows for portfolio */}
              {state.scope === 'portfolio' && portfolioTagIds.length > 0 && (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                  <TickerRows
                    tagIds={portfolioTagIds}
                    onSelectTag={(tagId) => {
                      setTagId(tagId)
                      setScope('tag')
                      setScale('year')
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {state.scale === 'day' && state.day && (
            <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
              <DayDigest date={state.day.date} stories={state.day.stories} />
            </div>
          )}

          {state.scale === 'day_hours' && state.hours && (
            <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
              <HoursGrid cells={state.hours.cells} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
