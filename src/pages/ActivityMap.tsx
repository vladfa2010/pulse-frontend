/**
 * =============================================================================
 * PULSE — News activity heatmap page (TZ 11.11)
 * =============================================================================
 */

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { api } from '@/lib/api'
import { useHeatmapState } from '@/components/heatmap/useHeatmapState'
import YearGrid from '@/components/heatmap/YearGrid'
import TopChart from '@/components/heatmap/TopChart'
import TickerRows from '@/components/heatmap/TickerRows'
import HoursGrid from '@/components/heatmap/HoursGrid'
import DayDigest from '@/components/heatmap/DayDigest'
import EmptyStub from '@/components/heatmap/EmptyStub'
import type { Scope, Scale, IndexChoice, DayPayload } from '@/components/heatmap/types'
import type { HeatmapOverlay } from '@/components/heatmap/heatColors'

const SCOPE_LABELS: Record<Scope, string> = {
  all: 'Весь рынок',
  portfolio: 'Весь портфель',
  tag: 'Тег',
}

const SCALE_LABELS: Record<Scale, string> = {
  year: 'Год',
  day: 'День',
  day_hours: 'Часы',
}

const INDEX_LABELS: Record<IndexChoice, string> = {
  none: 'Без индекса',
  IMOEX: 'IMOEX',
  SPY: 'SPY',
}

const OVERLAY_LABELS: Record<HeatmapOverlay, string> = {
  sentiment: 'Тональность',
  freq: 'Частота',
  spikes: 'Всплески',
}

export default function ActivityMap() {
  const { isLoggedIn, portfolio } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const {
    state,
    setScope,
    setScale,
    setTagId,
    setDate,
    setIndex,
    setHoveredDate,
  } = useHeatmapState()

  const [overlay, setOverlay] = useState<HeatmapOverlay>('sentiment')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayDigest, setDayDigest] = useState<DayPayload | null>(null)
  const [dayError, setDayError] = useState(false)

  // Гость: сразу модалка входа с возвратом на страницу (TZ 11.11 п.3.0).
  useEffect(() => {
    if (!isLoggedIn) {
      openAuthModal('login', { returnUrl: '/activity-map' })
    }
  }, [isLoggedIn, openAuthModal])

  // Сброс выбранной даты при смене scope/tag.
  useEffect(() => {
    setSelectedDate(null)
  }, [state.scope, state.tagId])

  // Загрузка дайджеста выбранного дня.
  useEffect(() => {
    if (!selectedDate) {
      setDayDigest(null)
      return
    }
    const params = new URLSearchParams({ scope: state.scope, scale: 'day', date: selectedDate })
    if (state.scope === 'tag') params.set('tag_id', state.tagId)
    setDayError(false)
    api.get(`/news_heatmap?${params.toString()}`)
      .then((d) => { setDayDigest(d); setDayError(false) })
      .catch(() => { setDayDigest(null); setDayError(true) })
  }, [selectedDate, state.scope, state.tagId])

  const portfolioTagIds = useMemo(
    () => portfolio.map((p) => p.tag_id),
    [portfolio]
  )

  const canShowChart = state.scope === 'tag'
    ? Boolean(state.year?.instrument)
    : true

  const shiftSelected = (days: number) => {
    if (!selectedDate) return
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + days)
    const next = d.toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    if (next <= today) setSelectedDate(next)
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen px-4 md:px-6 pt-24 pb-16 max-w-[1200px] mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-1">Новостная активность</h1>
          <p className="text-sm text-text-muted">
            Тепловая карта новостей по вашему портфелю, тегу или всему рынку.
          </p>
        </header>
        <div className="rounded-2xl p-8 bg-white/[0.03] border border-white/[0.06] text-center">
          <p className="text-sm text-text-secondary mb-4">
            Карта новостной активности доступна после входа.
          </p>
          <button
            type="button"
            onClick={() => openAuthModal('login', { returnUrl: '/activity-map' })}
            className="px-4 py-2 rounded-xl bg-accent-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Войти
          </button>
        </div>
      </div>
    )
  }

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
          {(['all', 'portfolio', 'tag'] as Scope[]).map((s) => (
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

      {/* Portfolio tag chips */}
      {portfolioTagIds.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-6 -mt-3">
          <span className="text-xs text-text-muted flex-shrink-0 mr-1">Теги портфеля:</span>
          {portfolio.map((p) => {
            const active = state.scope === 'tag' && state.tagId === p.tag_id
            return (
              <button
                key={p.tag_id}
                type="button"
                onClick={() => {
                  setTagId(p.tag_id)
                  setScope('tag')
                }}
                className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-colors border ${
                  active
                    ? 'bg-white/10 text-white border-white/20 font-medium'
                    : 'bg-white/[0.03] text-text-secondary border-white/[0.06] hover:text-text-primary'
                }`}
              >
                {p.tag_id}
              </button>
            )
          })}
        </div>
      )}

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
              {canShowChart && (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                  <TopChart
                    candles={state.candles}
                    yearCells={state.year.cells}
                    hoveredWeek={state.hoveredDate}
                    onHoverWeek={setHoveredDate}
                    title={`Новостная плотность · ${SCOPE_LABELS[state.scope].toLowerCase()}`}
                    headerRight={state.scope !== 'tag' ? (
                      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                        {(['none', 'IMOEX', 'SPY'] as IndexChoice[]).map((ix) => (
                          <button
                            key={ix}
                            type="button"
                            onClick={() => setIndex(ix)}
                            className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                              state.index === ix
                                ? 'bg-white/10 text-white font-medium'
                                : 'text-text-secondary hover:text-text-primary'
                            }`}
                          >
                            {INDEX_LABELS[ix]}
                          </button>
                        ))}
                      </div>
                    ) : undefined}
                  />
                </div>
              )}

              {/* Year grid */}
              <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="text-sm font-medium text-text-primary">Годовая карта</div>
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06] flex-shrink-0">
                    {(Object.keys(OVERLAY_LABELS) as HeatmapOverlay[]).map((ov) => (
                      <button
                        key={ov}
                        type="button"
                        onClick={() => setOverlay(ov)}
                        className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                          overlay === ov
                            ? 'bg-white/10 text-white font-medium'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {OVERLAY_LABELS[ov]}
                      </button>
                    ))}
                  </div>
                </div>
                <YearGrid
                  cells={state.year.cells}
                  quantiles={state.year.quantiles}
                  instrument={state.year.instrument}
                  overlay={overlay}
                  hoveredDate={state.hoveredDate}
                  onHoverDate={setHoveredDate}
                  onSelectDate={setSelectedDate}
                />
                {/* Легенда (мастер-ТЗ п.4.3) */}
                <div className="flex items-center gap-1.5 mt-3 text-[11px] text-text-muted">
                  <span>Меньше</span>
                  {['rgba(255,255,255,.045)', 'rgba(0,212,255,.18)', 'rgba(0,212,255,.38)', 'rgba(0,212,255,.65)', '#00D4FF'].map((c) => (
                    <span key={c} className="inline-block rounded-[3px]" style={{ width: 12, height: 12, background: c }} />
                  ))}
                  <span>Больше</span>
                  {overlay === 'sentiment' && (
                    <span className="ml-3">
                      <span style={{ color: '#34D399' }}>■</span> тон позитивный&ensp;
                      <span style={{ color: '#EF4444' }}>■</span> тон негативный&ensp;· без перевеса — нейтрально
                    </span>
                  )}
                  {overlay === 'spikes' && (
                    <span className="ml-3">
                      <span style={{ color: '#F59E0B' }}>●</span> всплеск ≥ 3× медианы среза
                    </span>
                  )}
                </div>
              </div>

              {/* Selected day digest card */}
              {selectedDate && (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => shiftSelected(-1)}
                        className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] text-text-secondary hover:text-text-primary transition-colors"
                        aria-label="Предыдущий день"
                      >
                        ‹
                      </button>
                      <div className="text-sm font-medium text-text-primary min-w-[110px] text-center">
                        {selectedDate}
                      </div>
                      <button
                        type="button"
                        onClick={() => shiftSelected(1)}
                        disabled={selectedDate >= new Date().toISOString().slice(0, 10)}
                        className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30"
                        aria-label="Следующий день"
                      >
                        ›
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(null)}
                      className="text-text-muted hover:text-text-primary text-sm transition-colors"
                      aria-label="Закрыть"
                    >
                      ✕
                    </button>
                  </div>
                  {dayDigest ? (
                    <DayDigest date={dayDigest.date} stories={dayDigest.stories} />
                  ) : dayError ? (
                    <div className="py-6 text-center text-sm text-text-muted">
                      Не удалось загрузить новости дня. Попробуйте выбрать день ещё раз.
                    </div>
                  ) : (
                    <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
                  )}
                </div>
              )}

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
