/**
 * =============================================================================
 * PULSE — Еженедельный отчёт: 5-минутный график недели по тегу (ТЗ-191)
 * =============================================================================
 *
 * Блок «{TICKER} · M5 · 7 дней» внутри секции тега. Свечи и маркеры НЕ
 * рендерим сами — переиспользуем CascadeChart (ТЗ-93/97/98/106) как есть:
 * свечи, группировка маркеров по свече, пунктир вне сессии и разделители
 * дней уже внутри компонента. Маркеры привязываем через buildMarkerPoints.
 * ПРАВКА-2 к ТЗ-191: третий слой — новостной фон (сантимент) через проп
 * sentimentSeries; при null (<2 новостей за окно) панель скрыта, подпись не рисуется.
 *
 * Ленивая загрузка по viewport (IntersectionObserver + React Query, паттерн
 * LessonChartBlock/деталь-панели каскадов) — до 10 тегов на странице.
 * Деградация: chart null → блок скрыт целиком, секция тега без графика.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useWeeklyChart, type WeeklyScope } from '@/lib/reportsApi'
import type { NewsMarker } from '@/lib/cascadesApi'
import { buildMarkerPoints } from '@/components/cascades/CascadeChart'
import CascadeChart from '@/components/cascades/CascadeChart'
import { formatDayShort, formatNewsDateTime } from '@/lib/weeklyReportView'

interface Props {
  scope: WeeklyScope
  tagId: string
  /** Magic-токен гостя по ссылке (передаётся в запрос) */
  k: string | null
  /** В live week_change_pct подписываем «за прошедшие дни» */
  live: boolean
  /** ТЗ-192: клик по событию — разворот ленты/скролл к якорю (индекс в полном списке статей тега) */
  onEventClick?: (index: number) => void
}

export default function WeekChartBlock({ scope, tagId, k, live, onEventClick }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  // Ленивая загрузка: запрос только когда блок близко к вьюпорту
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const { data } = useWeeklyChart(scope, tagId, k, visible)
  const chart = data?.chart ?? null

  const markers = useMemo(() => data?.news_markers ?? [], [data?.news_markers])
  const markerPoints = useMemo(
    () => (chart ? buildMarkerPoints(chart, markers) : []),
    [chart, markers],
  )

  // Клик по маркеру графика — открываем статью источника первой новости группы
  const openMarkerNews = (group: NewsMarker[]) => {
    const url = group[0]?.url
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (data && !chart) return null

  const ticker = chart?.symbol.split('@')[0] ?? ''
  const change = data?.week_change_pct ?? null

  return (
    <div
      ref={wrapRef}
      className="rounded-2xl px-4 py-3.5 mb-3.5"
      style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-baseline justify-between mb-2.5">
        <div className="text-[12.5px] font-semibold">
          {chart ? (
            <>
              {ticker} · M5 ·{' '}
              <span className="text-text-muted font-normal">
                7 дней · {chart.exchange_name} · точки — новости тега
              </span>
            </>
          ) : (
            <span className="text-text-muted">График недели…</span>
          )}
        </div>
        {chart && change !== null && (
          <span
            className="text-[13px] font-semibold inline-flex items-center gap-1"
            style={{ color: change >= 0 ? 'var(--text-success)' : 'var(--text-error)' }}
          >
            {change >= 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            {change >= 0 ? '+' : '−'}
            {Math.abs(change)}% {live ? 'за прошедшие дни' : 'за неделю'}
          </span>
        )}
      </div>

      {chart && (
        <>
          <CascadeChart instrument={chart} markers={markerPoints} height={220} sentimentSeries={data?.sentiment ?? null} onMarkerGroupClick={openMarkerNews} />

          {/* ПРАВКА-2 к ТЗ-191: подпись панели фона по мокапу (.sent-panel) —
              только когда серия есть; null (<2 новостей) — панель скрыта целиком */}
          {data?.sentiment && data.sentiment.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-text-muted">
              <span>Новостной фон · сантимент · бакеты 4 ч, окно 12 ч</span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: 'rgba(52,211,153,0.6)' }}
                />
                позитив
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: 'rgba(239,68,68,0.6)' }}
                />
                негатив
              </span>
            </div>
          )}

          {/* Легенда дней — диапазон дат из свечей */}
          {chart.dates && chart.dates.length > 0 && (
            <div className="flex justify-between text-[11px] text-text-muted mt-2">
              <span>{formatDayShort(chart.dates[0])}</span>
              <span>{formatDayShort(chart.dates[chart.dates.length - 1])}</span>
            </div>
          )}

          {/* Список событий недели — клик по строке: скролл к новости в ленте тега;
              клик по заголовку: открыть статью источника в новой вкладке */}
          {markers.length > 0 && (
            <div className="mt-2.5 pt-2" style={{ borderTop: '1px dashed var(--border-subtle)' }}>
              {markers.map((m, i) => (
                <div
                  key={m.id || i}
                  onClick={() => onEventClick?.(i)}
                  className="flex gap-2 text-[12px] text-text-secondary mb-1 items-baseline hover:text-text-primary transition-colors cursor-pointer"
                >
                  <span
                    className="w-[7px] h-[7px] rounded-full shrink-0"
                    style={{ backgroundColor: 'var(--text-warning)', position: 'relative', top: -1 }}
                  />
                  <span className="text-text-muted min-w-[74px]">{formatNewsDateTime(m.published_at)}</span>
                  {m.url ? (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-text-secondary hover:text-text-primary hover:underline"
                    >
                      {m.title}
                    </a>
                  ) : (
                    <span>{m.title}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
