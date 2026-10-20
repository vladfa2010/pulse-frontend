/**
 * =============================================================================
 * PULSE — Еженедельный отчёт: 5-минутный график недели по тегу (ТЗ-191)
 * =============================================================================
 *
 * Блок «{TICKER} · M5 · 7 дней» внутри секции тега. Свечи и маркеры НЕ
 * рендерим сами — переиспользуем CascadeChart (ТЗ-93/97/98/106) как есть:
 * свечи, группировка маркеров по свече, пунктир вне сессии и разделители
 * дней уже внутри компонента. Маркеры привязываем через buildMarkerPoints.
 *
 * Ленивая загрузка по viewport (IntersectionObserver + React Query, паттерн
 * LessonChartBlock/деталь-панели каскадов) — до 10 тегов на странице.
 * Деградация: chart null → блок скрыт целиком, секция тега без графика.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useWeeklyChart, type WeeklyScope } from '@/lib/reportsApi'
import { buildMarkerPoints } from '@/components/cascades/CascadeChart'
import CascadeChart from '@/components/cascades/CascadeChart'
import { formatDayShort, formatNewsDateTime, newsAnchorId } from '@/lib/weeklyReportView'

interface Props {
  scope: WeeklyScope
  tagId: string
  /** Magic-токен гостя по ссылке (передаётся в запрос) */
  k: string | null
  /** В live week_change_pct подписываем «за прошедшие дни» */
  live: boolean
}

export default function WeekChartBlock({ scope, tagId, k, live }: Props) {
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
          <CascadeChart instrument={chart} markers={markerPoints} height={220} />

          {/* Легенда дней — диапазон дат из свечей */}
          {chart.dates && chart.dates.length > 0 && (
            <div className="flex justify-between text-[11px] text-text-muted mt-2">
              <span>{formatDayShort(chart.dates[0])}</span>
              <span>{formatDayShort(chart.dates[chart.dates.length - 1])}</span>
            </div>
          )}

          {/* Список событий недели — якоря на новости в ленте тега */}
          {markers.length > 0 && (
            <div className="mt-2.5 pt-2" style={{ borderTop: '1px dashed var(--border-subtle)' }}>
              {markers.map((m, i) => (
                <a
                  key={m.id || i}
                  href={`#${newsAnchorId(tagId, i)}`}
                  className="flex gap-2 text-[12px] text-text-secondary mb-1 items-baseline hover:text-text-primary transition-colors"
                >
                  <span
                    className="w-[7px] h-[7px] rounded-full shrink-0"
                    style={{ backgroundColor: 'var(--text-warning)', position: 'relative', top: -1 }}
                  />
                  <span className="text-text-muted min-w-[74px]">{formatNewsDateTime(m.published_at)}</span>
                  <span>{m.title}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
