/**
 * =============================================================================
 * PULSE — Деталь-панель сюжета (ТЗ-187)
 * =============================================================================
 *
 * Раскрывается кликом по строке таблицы «Сюжеты» или deep link ?story=<id>
 * (живёт только на вкладке stories — параметр в URL переживает F5/шеру).
 * Данные — уже загруженный /market/stories (каскады сюжета приходят с ним,
 * отдельного эндпоинта не нужно; first_title каскада — ТЗ-187 в бэкенде).
 *
 * Состав:
 *   - шапка: заголовок сюжета, summary, период (МСК), мета-строка
 *     (кластеров · новостей), кнопка закрытия (паттерн CascadeDetailPanel);
 *   - SVG-таймлайн: шкала от самого раннего first_published_at до самого
 *     позднего last_seen_at; строка = каскад: слева подпись first_title
 *     (обрезка ~50 симв.), полоска first→last, толщина/непрозрачность ∝ size;
 *     вертикальная сетка подписанных тиков; клик по строке → деталь-панель
 *     каскада на месте (?cluster=<id> под этой панелью);
 *   - список каскадов под таймлайном (first_title | size | жизнь | период,
 *     сортировка по first_published_at ASC) — те же клики.
 *   - состояния: данные грузятся (undefined), сюжет не найден (null).
 */

import { useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { Story } from '@/lib/cascadesApi'
import { formatLifeMin, formatMskDateTime, formatMskDayShort, formatMskPeriod } from '@/lib/cascadeFormat'

interface Props {
  /** undefined — /market/stories ещё грузится; null — сюжета нет в ответе */
  story: Story | null | undefined
  onOpenCluster: (clusterId: string) => void
  onClose: () => void
}

const LABEL_MAX = 50
const ROW_H = 34
const AXIS_H = 22

function truncate(s: string, max = LABEL_MAX): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/** Подпись каскада на таймлайне: заголовок первой новости, без него — эмодаш */
function clusterLabel(firstTitle: string | null): string {
  return firstTitle ? truncate(firstTitle) : '—'
}

export default function StoryDetailPanel({ story, onOpenCluster, onClose }: Props) {
  const [hoverRow, setHoverRow] = useState<number | null>(null)

  const newsCount = useMemo(
    () => story?.clusters.reduce((sum, c) => sum + c.size, 0) ?? 0,
    [story]
  )

  // ─── Геометрия таймлайна ──────────────────────────────────────────────────
  const timeline = useMemo(() => {
    if (!story) return null
    const rows = [...story.clusters]
      .filter((c) => c.first_published_at)
      .sort((a, b) => (a.first_published_at ?? '').localeCompare(b.first_published_at ?? ''))
    if (rows.length === 0) return null

    const t0 = Math.min(...rows.map((c) => Date.parse(c.first_published_at!)))
    // Защита от нулевого спана (все каскады — одна точка): минимум 30 минут,
    // иначе полоски схлопываются в вертикальную линию
    const rawEnd = Math.max(...rows.map((c) => Date.parse(c.last_seen_at ?? c.first_published_at!)))
    const span = Math.max(rawEnd - t0, 30 * 60 * 1000)
    const end = t0 + span
    const x = (t: number) => ((t - t0) / span) * 100

    // Шаг сетки: ближайший «красивый» интервал, дающий ≤8 тиков на шкале
    const steps = [
      30 * 60 * 1000, 60 * 60 * 1000, 3 * 3600 * 1000, 6 * 3600 * 1000,
      12 * 3600 * 1000, 24 * 3600 * 1000, 2 * 24 * 3600 * 1000, 7 * 24 * 3600 * 1000,
    ]
    const step = steps.find((s) => span / s <= 8) ?? 7 * 24 * 3600 * 1000
    const ticks: { t: number; label: string }[] = []
    for (let t = Math.ceil(t0 / step) * step; t <= end; t += step) {
      const iso = new Date(t).toISOString()
      ticks.push({ t, label: step >= 24 * 3600 * 1000 ? formatMskDayShort(iso) : formatMskDateTime(iso) })
    }

    const chartH = AXIS_H + rows.length * ROW_H
    return { rows, x, ticks, chartH }
  }, [story])

  return (
    <section
      className="mt-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden scroll-mt-24"
      aria-label="Детали сюжета"
    >
      {/* Шапка панели — паттерн CascadeDetailPanel */}
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent-primary mb-1">
            Сюжет
          </div>
          <h3 className="text-sm font-semibold text-text-primary leading-snug">
            {story ? story.title : story === undefined ? 'Загрузка сюжета…' : 'Сюжет не найден'}
          </h3>
          {story && (
            <>
              <p className="mt-1.5 text-xs text-text-muted">
                {story.clusters.length} {story.clusters.length === 1 ? 'каскад' : 'каскадов'}
                {' · '}{newsCount} новостей
                {' · '}{formatMskPeriod(story.started_at, story.last_seen_at)}
              </p>
              {story.summary && (
                <p className="mt-1.5 text-xs text-text-secondary leading-snug line-clamp-3">
                  {story.summary}
                </p>
              )}
            </>
          )}
          {story === null && (
            <p className="mt-1.5 text-xs text-text-muted">
              Сюжет не найден — возможно, он вышел из окна или ссылка устарела.
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-colors"
          aria-label="Закрыть детали сюжета"
        >
          <X size={14} />
          Закрыть
        </button>
      </div>

      <div className="px-5 py-4">
        {story === undefined && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-accent-primary" />
          </div>
        )}

        {story && !timeline && (
          <p className="text-sm text-text-muted py-6 text-center">
            У сюжета пока нет каскадов — таймлайн недоступен.
          </p>
        )}

        {story && timeline && (
          <>
            {/* SVG-таймлайн: строка = каскад, полоска first→last, ∝ size */}
            <svg
              width="100%"
              height={timeline.chartH}
              role="img"
              aria-label="Таймлайн каскадов сюжета"
            >
              {/* Сетка тиков */}
              {timeline.ticks.map((tick) => (
                <g key={tick.t}>
                  <line
                    x1={`${timeline.x(tick.t)}%`}
                    x2={`${timeline.x(tick.t)}%`}
                    y1={AXIS_H - 4}
                    y2={timeline.chartH}
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <text
                    x={`${timeline.x(tick.t)}%`}
                    y={12}
                    textAnchor="middle"
                    fontSize={10}
                    fill="rgba(255,255,255,0.35)"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}

              {/* Строки-каскады */}
              {timeline.rows.map((c, i) => {
                const first = Date.parse(c.first_published_at!)
                const last = Date.parse(c.last_seen_at ?? c.first_published_at!)
                const x1 = timeline.x(first)
                const x2 = Math.max(timeline.x(last), x1 + 0.6)
                // Толщина/непрозрачность ∝ size (модель §2.5: size = число новостей)
                const barH = 6 + Math.min(8, c.size)
                const barOpacity = 0.35 + Math.min(0.55, c.size * 0.06)
                const y = AXIS_H + i * ROW_H
                return (
                  <g
                    key={c.cluster_id}
                    onClick={() => onOpenCluster(c.cluster_id)}
                    onMouseEnter={() => setHoverRow(i)}
                    onMouseLeave={() => setHoverRow(null)}
                    className="cursor-pointer"
                  >
                    <title>{`${c.first_title ?? 'Каскад'} · ${c.size} новостей`}</title>
                    {/* Подпись слева */}
                    <text
                      x={0}
                      y={y + ROW_H / 2 + 3}
                      fontSize={11}
                      fill={hoverRow === i ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)'}
                    >
                      {clusterLabel(c.first_title)}
                    </text>
                    {/* Полоска жизни каскада */}
                    <rect
                      x={`${x1}%`}
                      y={y + (ROW_H - barH) / 2}
                      width={`${x2 - x1}%`}
                      height={barH}
                      rx={barH / 2}
                      fill="#00D4FF"
                      opacity={hoverRow === i ? Math.min(1, barOpacity + 0.2) : barOpacity}
                    />
                  </g>
                )
              })}
            </svg>

            {/* Список каскадов — те же клики, подробные поля */}
            <div className="mt-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                Каскады сюжета ({timeline.rows.length})
              </div>
              <ol className="flex flex-col gap-1.5">
                {timeline.rows.map((c, i) => {
                  const lifeMin =
                    c.first_published_at && c.last_seen_at
                      ? (Date.parse(c.last_seen_at) - Date.parse(c.first_published_at)) / 60000
                      : null
                  return (
                    <li key={c.cluster_id}>
                      <button
                        onClick={() => onOpenCluster(c.cluster_id)}
                        className="w-full flex items-baseline gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="shrink-0 w-5 text-xs text-text-muted">{i + 1}</span>
                        <span className="flex-1 min-w-0 text-[13px] text-text-primary leading-snug truncate">
                          {c.first_title ?? '—'}
                        </span>
                        <span className="shrink-0 text-xs text-text-secondary">{c.size} нов.</span>
                        <span className="shrink-0 text-xs text-text-muted w-14 text-right">
                          {formatLifeMin(lifeMin)}
                        </span>
                        <span className="shrink-0 text-xs text-text-muted whitespace-nowrap">
                          {formatMskPeriod(c.first_published_at, c.last_seen_at)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
