/**
 * =============================================================================
 * PULSE — Вкладка «Темы» страницы «Каскады» (ТЗ-115, задача 5)
 * =============================================================================
 *
 * Витрина фоновых тем: долгоживущих массивов новостей (недели–месяцы) из
 * HDBSCAN-кластеризации эмбеддингов (воркер 03:40 МСК, LLM-нейминг 04:10 МСК).
 * Видна только при VITE_TOPICS_ENABLED=true (VPS-сборка); бэк без флага
 * отвечает 404 { error: 'topics_disabled' } — показываем пустое состояние.
 *
 * Тема — это фон, а не лента событий: здесь нет «кто первый» и причинной
 * цепочки, размер раздут перепечатками (дисклеймер обязателен, §1 ТЗ-115).
 *
 * Состав:
 *   - шапка-статистика прогона (Тем / Новостей в темах / Окно / Вне тем);
 *   - янтарная плашка-дисклеймер;
 *   - сетка карточек (2 колонки десктоп / 1 мобайл): имя, summary, мета,
 *     бейдж тренда, SVG-спарклайн по daily;
 *   - клик → детальная панель под сеткой: большой спарклайн, новости,
 *     каскады (ссылки → вкладка «Каскады» через openCluster) и сюжеты
 *     (список без ссылок — страница не поддерживает deep-link на сюжет).
 */

import { useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import {
  useTopics,
  useTopic,
  type Topic,
  type TopicDailyPoint,
} from '@/lib/cascadesApi'
import { formatMskDate, formatMskDateTime } from '@/lib/cascadeFormat'

const EMPTY_STATE = 'Темы формируются: первый прогон — ближайшая ночь'
const UNNAMED_TOPIC = 'Тема без названия (формируется)'

/** Минимальная русская плюрализация: plural(5, ['день', 'дня', 'дней']) → «5 дней» */
function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(Math.round(n)) % 100
  const mod = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (mod > 1 && mod < 5) return forms[1]
  if (mod === 1) return forms[0]
  return forms[2]
}

const TREND_META: Record<Topic['trend'], { icon: string; label: string; cls: string }> = {
  growing: { icon: '▲', label: 'растёт', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  stable: { icon: '●', label: 'стабильна', cls: 'text-[#9CA3AF] bg-white/[0.04] border-white/[0.08]' },
  fading: { icon: '▼', label: 'затухает', cls: 'text-red-400 bg-red-400/10 border-red-400/20' },
}

/** Спарклайн барами по daily — простой SVG, echarts не подключаем (ТЗ-115) */
function DailySparkline({ daily, className }: { daily: TopicDailyPoint[]; className?: string }) {
  if (daily.length === 0) return null
  const W = 100
  const H = 32
  const max = Math.max(1, ...daily.map((p) => p.n))
  const bw = W / daily.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      {daily.map((p, i) => {
        const h = Math.max(1, (p.n / max) * (H - 2))
        return (
          <rect
            key={p.d}
            x={i * bw}
            y={H - h}
            width={Math.max(0.6, bw - 0.4)}
            height={h}
            rx={0.5}
            fill="#00D4FF"
            opacity={0.3 + 0.7 * (p.n / max)}
          />
        )
      })}
    </svg>
  )
}

function trendBadge(trend: Topic['trend']) {
  const meta = TREND_META[trend] ?? TREND_META.stable
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${meta.cls}`}>
      {meta.icon} {meta.label}
    </span>
  )
}

function topicMetaLine(t: Topic): string {
  const days = t.span_days !== null ? `${Math.round(t.span_days)} ${plural(t.span_days, ['день', 'дня', 'дней'])}` : '—'
  const sources = t.sources_count !== null ? `${t.sources_count} ${plural(t.sources_count, ['источник', 'источника', 'источников'])}` : '— источников'
  return `${t.news_count} ${plural(t.news_count, ['новость', 'новости', 'новостей'])} · ${days} · ${sources}`
}

interface TopicsTabProps {
  /** Клик по каскаду в деталке темы → вкладка «Каскады» с раскрытым кластером */
  onOpenCluster: (clusterId: string) => void
}

export default function TopicsTab({ onOpenCluster }: TopicsTabProps) {
  const { data, isLoading, isError, error, refetch } = useTopics(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 404 { error: 'topics_disabled' } — бэк без флага, хотя вкладка собрана с ним:
  // штатно для Render-сборки, показываем то же пустое состояние (ТЗ-115)
  const topicsDisabled =
    (error as { message?: string } | null)?.message?.includes('topics_disabled') === true ||
    (error as { status?: number } | null)?.status === 404

  const selected = selectedId ? (data?.topics.find((t) => t.id === selectedId) ?? null) : null

  const toggleTopic = (id: string) => setSelectedId((cur) => (cur === id ? null : id))

  return (
    <div>
      {/* Шапка-статистика прогона */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3.5">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Тем</div>
            <div className="text-xl font-semibold text-text-primary">{data.topics_total}</div>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3.5">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Новостей в темах</div>
            <div className="text-xl font-semibold text-text-primary">{data.news_covered}</div>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3.5">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Окно</div>
            <div className="text-xl font-semibold text-text-primary">{data.window_days} дней</div>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3.5">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Вне тем (шум)</div>
            <div className="text-xl font-semibold text-text-primary">{data.noise_count}</div>
          </div>
        </div>
      )}

      {/* Дисклеймер: тема — фон, а не лента событий (§1 ТЗ-115) */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 mb-5">
        <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200/80 leading-relaxed">
          Тема — это фон, а не лента событий: здесь нет «кто первый» и причинной цепочки;
          размер раздут перепечатками. События — во вкладке «Каскады».
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-accent-primary" />
        </div>
      )}

      {isError && !topicsDisabled && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-6 py-10 text-center">
          <p className="text-sm text-text-secondary mb-4">Не удалось загрузить темы. Попробуйте ещё раз.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary text-[#060606] hover:opacity-90 transition-opacity"
          >
            Повторить
          </button>
        </div>
      )}

      {(topicsDisabled || (data && data.topics.length === 0)) && (
        <p className="text-sm text-text-muted py-10 text-center">{EMPTY_STATE}</p>
      )}

      {/* Сетка карточек: 2 колонки десктоп / 1 мобайл */}
      {data && data.topics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.topics.map((t) => (
            <button
              key={t.id}
              onClick={() => toggleTopic(t.id)}
              aria-expanded={selectedId === t.id}
              className={`text-left rounded-2xl border px-4 py-4 transition-colors ${
                selectedId === t.id
                  ? 'bg-white/[0.05] border-accent-primary/40'
                  : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.045] hover:border-white/[0.1]'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <h3 className={`text-sm font-semibold leading-snug ${t.name ? 'text-text-primary' : 'text-text-muted italic'}`}>
                  {t.name ?? UNNAMED_TOPIC}
                </h3>
                {trendBadge(t.trend)}
              </div>
              {t.summary && (
                <p className="text-xs text-text-secondary leading-snug line-clamp-2 mb-2.5">{t.summary}</p>
              )}
              <div className="text-[11px] text-text-muted mb-3">{topicMetaLine(t)}</div>
              <DailySparkline daily={t.daily} className="w-full h-8" />
            </button>
          ))}
        </div>
      )}

      {/* Детальная панель под сеткой */}
      {selected && (
        <TopicDetailPanel topic={selected} onClose={() => setSelectedId(null)} onOpenCluster={onOpenCluster} />
      )}
    </div>
  )
}

// ─── Детальная панель темы ──────────────────────────────────────────────────

function TopicDetailPanel({
  topic,
  onClose,
  onOpenCluster,
}: {
  topic: Topic
  onClose: () => void
  onOpenCluster: (clusterId: string) => void
}) {
  const { data, isLoading, isError, refetch } = useTopic(topic.id)

  return (
    <section
      className="mt-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden scroll-mt-24"
      aria-label="Детали темы"
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent-primary mb-1">Тема</div>
          <h3 className={`text-sm font-semibold leading-snug ${topic.name ? 'text-text-primary' : 'text-text-muted italic'}`}>
            {topic.name ?? UNNAMED_TOPIC}
          </h3>
          {topic.summary && <p className="mt-1.5 text-xs text-text-muted leading-snug">{topic.summary}</p>}
          <div className="mt-2 flex items-center gap-2">
            <p className="text-xs text-text-muted">{topicMetaLine(topic)}</p>
            {trendBadge(topic.trend)}
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-colors"
          aria-label="Закрыть детали темы"
        >
          <X size={14} />
          Закрыть
        </button>
      </div>

      <div className="px-5 py-4">
        {/* Большой спарклайн — daily из списка тем (детальный ответ daily не несёт) */}
        <DailySparkline daily={topic.daily} className="w-full h-20 mb-1" />
        <div className="flex justify-between text-[10px] text-text-muted mb-4">
          <span>{topic.daily[0]?.d ? formatMskDate(topic.daily[0].d) : ''}</span>
          <span>{topic.daily[topic.daily.length - 1]?.d ? formatMskDate(topic.daily[topic.daily.length - 1].d) : ''}</span>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-accent-primary" />
          </div>
        )}

        {isError && (
          <div className="text-center py-8">
            <p className="text-sm text-text-secondary mb-3">Не удалось загрузить детали темы.</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary text-[#060606] hover:opacity-90 transition-opacity"
            >
              Повторить
            </button>
          </div>
        )}

        {data && (
          <>
            {/* Новости темы: время · источник · заголовок-ссылка */}
            {data.news.length > 0 && (
              <div className="mb-5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                  Новости в теме ({data.news.length})
                </div>
                <ol className="flex flex-col gap-2">
                  {data.news.map((n) => (
                    <li key={n.id} className="flex items-baseline gap-3">
                      <span className="shrink-0 text-xs text-text-muted w-[86px]">{formatMskDateTime(n.time)}</span>
                      <span className="shrink-0 text-xs text-text-secondary w-28 truncate">{n.source}</span>
                      <span className="flex-1 min-w-0 text-[13px] text-text-primary leading-snug">
                        {n.url ? (
                          <a href={n.url} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#00D4FF]">
                            {n.title}
                          </a>
                        ) : (
                          n.title
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Каскады темы — ссылки на вкладку «Каскады» через openCluster */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                  Каскады в теме ×{data.cascades.length}
                </div>
                {data.cascades.length === 0 ? (
                  <p className="text-xs text-text-muted">Каскадов в теме нет</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {data.cascades.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => onOpenCluster(c.id)}
                          className="text-left text-[13px] text-text-primary leading-snug transition-colors hover:text-[#00D4FF]"
                        >
                          {c.title}
                          <span className="block text-[10px] text-text-muted">
                            {c.news_count} {plural(c.news_count, ['новость', 'новости', 'новостей'])} · пересечение {c.overlap}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Сюжеты темы — список без ссылок: страница не поддерживает
                  deep-link на сюжет (есть только переход на lead-кластер, а в
                  ответе темы нет cluster_id сюжета) */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                  Сюжеты в теме ×{data.stories.length}
                </div>
                {data.stories.length === 0 ? (
                  <p className="text-xs text-text-muted">Сюжетов в теме нет</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {data.stories.map((s) => (
                      <li key={s.id} className="text-[13px] text-text-primary leading-snug">
                        {s.name}
                        <span className="block text-[10px] text-text-muted">пересечение {s.overlap}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
