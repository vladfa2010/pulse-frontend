/**
 * =============================================================================
 * PULSE — Вкладка «Динамика» страницы «Каскады» (ТЗ-186, задача 6)
 * =============================================================================
 *
 * Динамика эффективности источников по ночным срезам (таблица source_stats_daily,
 * прогон 05:40 МСК): GET /market/source-stats?days=30.
 *
 * Состав:
 *   - нейтральный дисклеймер скользящего окна 7 дней (§1 ТЗ-186: соседние срезы
 *     разделяют 6 из 7 дней — тренд сглаживает резкие изменения);
 *   - SVG-график топ-10 источников по доле последнего среза (полилинии по срезам,
 *     ось X — даты, Y — доля в %, легенда справа, title-атрибуты со значениями;
 *     echarts не подключаем — 10 линий × 30 точек, тривиальный SVG);
 *   - таблица дельт: все источники с first_count ≥ 2 в последнем срезе
 *     (доля сейчас / 7 дней назад / Δ п.п. цветом / первым / первоисточительность /
 *     медианный лаг), сортировка кликом по колонкам по образцу CascadesTable.
 *
 * Пустые состояния: срезов < 7 или sources пуст — «Накапливаю историю…»
 * (первые 7 дней после запуска cron истории нет — риск §4 ТЗ-186).
 * Окна 24ч/7д/30д страницы к вкладке неприменимы — у срезов своё окно 7 дней.
 */

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Info, Loader2 } from 'lucide-react'
import { useSourceStats, type SourceStatsEntry } from '@/lib/cascadesApi'
import { formatShare } from '@/lib/cascadeFormat'
import { formatDecimal } from '@/lib/format'

const EMPTY_STATE =
  'Накапливаю историю: для динамики нужно 7+ дней срезов (первый срез появится после ночного прогона)'

/** Минимум срезов для «трендового» вида (первые 7 дней — заглушка, §4 ТЗ-186) */
const MIN_SNAPSHOTS = 7

/** Порог окраски Δ: ±0.5 п.п. (share хранится дробью: 0.5 п.п. = 0.005) */
const DELTA_THRESHOLD = 0.5

/** 10 различимых цветов линий графика (ТЗ-186, задача 6 — хардкод-массив) */
const LINE_COLORS = [
  '#00D4FF',
  '#F59E0B',
  '#10B981',
  '#F472B6',
  '#A78BFA',
  '#F87171',
  '#38BDF8',
  '#FB923C',
  '#4ADE80',
  '#E879F9',
]

/** 'YYYY-MM-DD' → «дд.мм» без Date/tz — подписи оси X */
function dayShort(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`
}

function formatDelta(deltaPp: number): string {
  const sign = deltaPp >= 0 ? '+' : '−'
  return `${sign}${formatDecimal(Math.abs(deltaPp), 1)}`
}

// ─── График топ-10 ───────────────────────────────────────────────────────────

const CHART_W = 560
const CHART_H = 280
const PAD = { left: 42, right: 10, top: 12, bottom: 26 }

function DynamicsChart({ sources }: { sources: SourceStatsEntry[] }) {
  // Общая ось X — объединение дат срезов топ-10 (у источников срезы совпадают,
  // но допускаем пропуски: точку не ставим, линию рвём)
  const dates = useMemo(() => {
    const set = new Set<string>()
    sources.forEach((s) => s.points.forEach((p) => set.add(p.date)))
    return [...set].sort()
  }, [sources])

  const maxShare = useMemo(
    () => Math.max(0.01, ...sources.flatMap((s) => s.points.map((p) => p.share))),
    [sources],
  )
  // Ось Y в % с «красивым» потолком
  const yMax = Math.max(5, Math.ceil(maxShare * 100 / 5) * 5)
  const innerW = CHART_W - PAD.left - PAD.right
  const innerH = CHART_H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (dates.length > 1 ? (i / (dates.length - 1)) * innerW : innerW / 2)
  const y = (share: number) => PAD.top + innerH - (share * 100 / yMax) * innerH

  // Разреженные подписи дат: не чаще, чем ~7 подписей по оси
  const labelStep = Math.max(1, Math.ceil(dates.length / 7))
  const yTicks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="flex-1 w-full h-auto"
        role="img"
        aria-label="Динамика доли первых публикаций по источникам за 30 дней"
      >
        {/* Сетка и подписи оси Y — доля в % */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={CHART_W - PAD.right}
              y1={y((yMax * t) / 100)}
              y2={y((yMax * t) / 100)}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="3 4"
            />
            <text x={PAD.left - 6} y={y((yMax * t) / 100) + 3} textAnchor="end" fontSize="9" fill="#9CA3AF">
              {Math.round(yMax * t)}%
            </text>
          </g>
        ))}

        {/* Подписи оси X — разреженные даты срезов */}
        {dates.map((d, i) =>
          (i % labelStep === 0 && i !== dates.length - 1) || i === dates.length - 1 ? (
            <text
              key={d}
              x={x(i)}
              y={CHART_H - 8}
              textAnchor="middle"
              fontSize="9"
              fill="#9CA3AF"
            >
              {dayShort(d)}
            </text>
          ) : null,
        )}

        {/* Полилинии источников */}
        {sources.map((s, si) => {
          const color = LINE_COLORS[si % LINE_COLORS.length]
          const byDate = new Map(s.points.map((p) => [p.date, p.share]))
          // Разрываем линию на сегменты при пропуске среза у источника
          const segments: string[] = []
          let cur = ''
          dates.forEach((d, i) => {
            const share = byDate.get(d)
            if (share === undefined) {
              if (cur) segments.push(cur)
              cur = ''
            } else {
              cur += `${cur ? ' ' : ''}${x(i).toFixed(1)},${y(share).toFixed(1)}`
            }
          })
          if (cur) segments.push(cur)
          return (
            <g key={s.source}>
              {segments.map((seg, gi) => (
                <polyline
                  key={gi}
                  points={seg}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                />
              ))}
              {s.points.map((p) => (
                <circle
                  key={p.date}
                  cx={x(dates.indexOf(p.date))}
                  cy={y(p.share)}
                  r={2}
                  fill={color}
                >
                  <title>{`${s.source} · ${dayShort(p.date)}: ${formatDecimal(p.share * 100, 1)}% (${p.first_count} первым)`}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>

      {/* Легенда справа: цвет, источник, доля последнего среза */}
      <ul className="shrink-0 md:w-44 flex flex-col gap-1.5 self-start">
        {sources.map((s, i) => (
          <li key={s.source} className="flex items-baseline gap-2 text-xs">
            <span
              className="shrink-0 inline-block w-2.5 h-2.5 rounded-full translate-y-[1px]"
              style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }}
            />
            <span className="flex-1 min-w-0 text-text-secondary truncate" title={s.source}>
              {s.source}
            </span>
            <span className="shrink-0 text-text-muted">{formatShare(s.latest.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Таблица дельт ───────────────────────────────────────────────────────────

type SortKey =
  | 'source'
  | 'share'
  | 'share_week_ago'
  | 'delta'
  | 'first_count'
  | 'first_rate'
  | 'median_lag'
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: 'source', label: 'Источник', className: 'text-left' },
  { key: 'share', label: 'Доля сейчас', className: 'text-right' },
  { key: 'share_week_ago', label: 'Доля 7д назад', className: 'text-right' },
  { key: 'delta', label: 'Δ, п.п.', className: 'text-right' },
  { key: 'first_count', label: 'Первым', className: 'text-right' },
  { key: 'first_rate', label: 'Первоисточительность', className: 'text-right' },
  { key: 'median_lag', label: 'Медианный лаг', className: 'text-right' },
]

interface DeltaRow {
  source: string
  share: number
  shareWeekAgo: number | null
  deltaPp: number | null
  first_count: number
  participations: number
  median_lag: number | null
}

/** null (week_ago нет / лага нет) — на дно при desc, как у CascadesTable с -1 */
function getValue(row: DeltaRow, key: SortKey): string | number {
  switch (key) {
    case 'source': return row.source
    case 'share': return row.share
    case 'share_week_ago': return row.shareWeekAgo ?? -1
    case 'delta': return row.deltaPp ?? -Infinity
    case 'first_count': return row.first_count
    case 'first_rate': return row.participations > 0 ? row.first_count / row.participations : 0
    case 'median_lag': return row.median_lag ?? -1
  }
}

function DeltaTable({ sources }: { sources: SourceStatsEntry[] }) {
  // ТЗ-186, задача 6: все источники с first_count ≥ 2 в последнем срезе
  const rows = useMemo<DeltaRow[]>(
    () =>
      sources
        .filter((s) => s.latest.first_count >= 2)
        .map((s) => {
          const lastPoint = s.points[s.points.length - 1]
          return {
            source: s.source,
            share: s.latest.share,
            shareWeekAgo: s.week_ago?.share ?? null,
            deltaPp: s.week_ago !== null ? (s.latest.share - s.week_ago.share) * 100 : null,
            first_count: s.latest.first_count,
            participations: lastPoint?.participations ?? 0,
            median_lag: lastPoint?.median_lag_not_first_min ?? null,
          }
        }),
    [sources],
  )

  const [sortKey, setSortKey] = useState<SortKey>('share')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => {
      const va = getValue(a, sortKey)
      const vb = getValue(b, sortKey)
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'desc' ? -cmp : cmp
    })
    return arr
  }, [rows, sortKey, sortDir])

  if (rows.length === 0) {
    return <p className="text-sm text-text-muted py-6 text-center">Нет источников с 2+ первыми публикациями в последнем срезе</p>
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/[0.03]">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted ${col.className}`}
              >
                <button
                  onClick={() => handleSort(col.key)}
                  className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-text-primary ${sortKey === col.key ? 'text-accent-primary' : ''}`}
                >
                  {col.label}
                  {sortKey === col.key &&
                    (sortDir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {sorted.map((row) => (
            <tr key={row.source} className="hover:bg-white/[0.03] transition-colors">
              <td className="px-4 py-2.5 text-[13px] text-text-primary">{row.source}</td>
              <td className="px-4 py-2.5 text-right text-xs text-text-secondary">{formatShare(row.share)}</td>
              <td className="px-4 py-2.5 text-right text-xs text-text-secondary">
                {row.shareWeekAgo !== null ? formatShare(row.shareWeekAgo) : '—'}
              </td>
              <td
                className={`px-4 py-2.5 text-right text-xs font-semibold ${
                  row.deltaPp === null
                    ? 'text-text-muted'
                    : row.deltaPp >= DELTA_THRESHOLD
                      ? 'text-emerald-400'
                      : row.deltaPp <= -DELTA_THRESHOLD
                        ? 'text-red-400'
                        : 'text-text-secondary'
                }`}
              >
                {row.deltaPp !== null ? formatDelta(row.deltaPp) : '—'}
              </td>
              <td className="px-4 py-2.5 text-right text-sm font-semibold text-text-primary">{row.first_count}</td>
              <td className="px-4 py-2.5 text-right text-xs text-text-secondary">
                {row.participations > 0 ? formatShare(row.first_count / row.participations) : '—'}
              </td>
              <td className="px-4 py-2.5 text-right text-xs text-text-muted whitespace-nowrap">
                {row.median_lag !== null ? `${formatDecimal(row.median_lag, row.median_lag < 10 ? 1 : 0)} мин` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Вкладка ─────────────────────────────────────────────────────────────────

export default function SourceDynamicsTab() {
  const { data, isLoading, isError, refetch } = useSourceStats(true)

  // Срезов < 7 ни у одного источника — «трендовый» вид бессмысленен (риск §4 ТЗ-186)
  const maxSnapshots = Math.max(0, ...(data?.sources.map((s) => s.points.length) ?? []))
  const historyTooShort = (data?.sources.length ?? 0) === 0 || maxSnapshots < MIN_SNAPSHOTS

  return (
    <div className="space-y-6">
      {/* Дисклеймер скользящего окна (§1 ТЗ-186) — нейтральный, как в «Аналитике» */}
      <div className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
        <Info size={16} className="text-text-muted shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary leading-relaxed">
          Скользящее окно 7 дней: соседние срезы разделяют 6 из 7 дней, тренд сглаживает резкие изменения.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-accent-primary" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-6 py-10 text-center">
          <p className="text-sm text-text-secondary mb-4">Не удалось загрузить динамику. Попробуйте ещё раз.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary text-[#060606] hover:opacity-90 transition-opacity"
          >
            Повторить
          </button>
        </div>
      )}

      {data && historyTooShort && (
        <p className="text-sm text-text-muted py-10 text-center">{EMPTY_STATE}</p>
      )}

      {data && !historyTooShort && (
        <>
          {/* График: топ-10 по доле последнего среза */}
          <section className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              Доля первых публикаций — топ-10 источников
            </h3>
            <DynamicsChart sources={[...data.sources].sort((a, b) => b.latest.share - a.latest.share).slice(0, 10)} />
          </section>

          {/* Таблица дельт: все источники с first_count ≥ 2 */}
          <section>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Динамика за 7 дней</h3>
            <DeltaTable sources={data.sources} />
          </section>
        </>
      )}
    </div>
  )
}
