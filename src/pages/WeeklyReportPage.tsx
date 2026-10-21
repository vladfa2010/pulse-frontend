/**
 * =============================================================================
 * PULSE — Еженедельный отчёт: /reports/weekly (live) и /reports/weekly/:id (архив)
 * =============================================================================
 * ТЗ-191, Задача 4. Два режима одного компонента: различия — только в источнике
 * данных (GET /reports/weekly/current vs /reports/weekly/:id) и подписях,
 * разметка общая, перенос блок-в-блок из мокапа мокап-weekly-report/index.html.
 *
 * Ключевые решения:
 *   - AI-саммари рендерятся ТОЛЬКО текстовыми узлами React (dangerouslySetInnerHTML
 *     в этом коде отсутствует — вывод LLM никогда не исполняется как разметка);
 *   - 5-минутные графики — переиспользуем CascadeChart как есть (свой рендер
 *     свечей не пишем), ленивая загрузка по viewport;
 *   - magic-link ?k=: первый запрос без токена, при 401 — повтор с ?k=, после
 *     успеха токен стирается из адресной строки (history.replaceState), но
 *     продолжает использоваться для chart/ahead-запросов гостя;
 *   - live {snapshot_id} (воскресенье после генерации) → редирект в архив.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Brain,
  CalendarDays,
  Check,
  Download,
  Loader2,
  Lock,
  Minus,
  Share2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import WeekStrip, { type WeekStripItem } from '@/components/weekly/WeekStrip'
import {
  isSnapshotRedirect,
  useWeeklyAhead,
  useWeeklyArchive,
  useWeeklyCurrent,
  useWeeklyReportList,
  useUserDailySummary,
  type WeeklyReportContent,
  type WeeklyReportTagSummary,
  type WeeklyScope,
} from '@/lib/reportsApi'
import {
  buildKpis,
  currentWeekStartMsk,
  elapsedDaysOfWeekMsk,
  formatDayLabel,
  formatDayShort,
  formatMetaDateTime,
  formatNewsDateTime,
  formatWeekRange,
  newsAnchorId,
  pluralNews,
  sentimentClass,
  sentimentRatio,
  summaryParagraphs,
  topSources,
  uniqueArticles,
  weekDayDates,
  SENTIMENT_COLORS,
  type KpiView,
} from '@/lib/weeklyReportView'
import WeekChartBlock from '@/components/weekly/WeekChartBlock'
import { KIND_COLORS } from '@/components/CalendarBlock'
import type { EventKind } from '@/types/calendar'

// ─── Константы визуала (§3.1 типов тегов, sentiment-токены §3.2 NewsCard) ───

const TAG_TYPE_COLORS: Record<string, string> = {
  company: '#00D4FF',
  sector: '#A78BFA',
  person: '#FBBF24',
  trend: '#34D399',
}

const NEWS_PER_TAG = 5

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
}

function tagColor(tagTypes: Map<string, string>, tagId: string): string {
  const type = tagTypes.get(tagId)
  return (type && TAG_TYPE_COLORS[type]) || '#6B7280'
}

// ─── Состояния страницы ─────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-[1120px] mx-auto px-6 md:px-12 pt-24 pb-16 space-y-4 animate-pulse">
      <div className="h-7 w-64 rounded-lg bg-white/5" />
      <div className="h-4 w-96 rounded bg-white/5" />
      <div className="h-12 rounded-2xl bg-white/5" />
      <div className="h-24 rounded-2xl bg-white/5" />
      <div className="grid grid-cols-3 max-[900px]:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[92px] rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="grid grid-cols-2 max-[900px]:grid-cols-1 gap-3">
        <div className="h-[300px] rounded-2xl bg-white/5" />
        <div className="h-[300px] rounded-2xl bg-white/5" />
      </div>
      <div className="h-[220px] rounded-2xl bg-white/5" />
    </div>
  )
}

function CenteredState({ icon, title, sub, action }: {
  icon: React.ReactNode
  title: string
  sub?: string
  action?: React.ReactNode
}) {
  return (
    <div className="max-w-[1120px] mx-auto px-6 md:px-12 pt-32 pb-24 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}>
        {icon}
      </div>
      <h1 className="text-lg font-semibold text-white mb-2">{title}</h1>
      {sub && <p className="text-sm text-text-secondary max-w-md mb-6">{sub}</p>}
      {action}
    </div>
  )
}

// ─── Шапка-действия ─────────────────────────────────────────────────────────

function TopActions() {
  const [copied, setCopied] = useState(false)
  const [pdfHint, setPdfHint] = useState(false)

  // Ссылка без токена: путь страницы, query (utm и пр.) не копируем
  const shareUrl = `${window.location.origin}${window.location.pathname}`

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // clipboard недоступен (небезопасный контекст) — fallback через prompt
      window.prompt('Ссылка на отчёт:', shareUrl)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const ghostBtn =
    'inline-flex items-center gap-[7px] rounded-pill px-[18px] py-2 text-[13px] font-medium transition-all duration-200'

  return (
    <div className="flex gap-2.5">
      <button
        onClick={share}
        className={`${ghostBtn} text-text-primary hover:border-[var(--border-active)]`}
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {copied ? <Check size={15} style={{ color: 'var(--text-success)' }} /> : <Share2 size={15} />}
        {copied ? 'Скопировано' : 'Поделиться'}
      </button>
      <button
        onClick={() => {
          setPdfHint(true)
          setTimeout(() => setPdfHint(false), 2000)
        }}
        className={`${ghostBtn} text-text-primary hover:border-[var(--border-active)]`}
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        title="Экспорт PDF — скоро"
      >
        <Download size={15} />
        {pdfHint ? 'Скоро' : 'Экспорт PDF'}
      </button>
    </div>
  )
}

// ─── AI-саммари (только текстовые узлы React) ───────────────────────────────

function AiSummaryBlock({ label, text, meta }: {
  label: string
  text: string
  meta?: string
}) {
  return (
    <div
      className="rounded-2xl px-5 py-4 mb-4"
      style={{
        background: 'rgba(0,212,255,0.04)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        border: '1px solid rgba(0,212,255,0.18)',
        borderLeft: '3px solid var(--accent-primary)',
      }}
    >
      <div className="text-[11px] font-semibold tracking-[0.1em] uppercase mb-2 flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
        <Brain size={14} />
        {label}
      </div>
      <div className="text-sm leading-[1.65] text-[#E5E7EB]">
        {summaryParagraphs(text).map((p, i) => (
          <p key={i} className="mb-2 last:mb-0">{p}</p>
        ))}
      </div>
      {meta && <div className="text-[11px] text-text-muted mt-2.5">{meta}</div>}
    </div>
  )
}

function PremiumLock() {
  return (
    <div
      className="flex items-center gap-2 text-[12.5px] text-text-muted rounded-2xl px-3.5 py-2.5 mb-3.5"
      style={{ border: '1px dashed rgba(156,163,175,0.45)' }}
    >
      <Lock size={14} />
      <span>
        AI-саммари по этому тегу доступно на тарифах с «AI-саммари по портфелю» —{' '}
        <Link to="/pricing" className="text-accent-primary hover:underline">подробнее</Link>
      </span>
    </div>
  )
}

// ─── KPI ────────────────────────────────────────────────────────────────────

function DeltaView({ delta }: { delta: KpiView['delta'] }) {
  if (!delta) return null
  const cls =
    delta.dir === 'up' ? 'text-text-success' : delta.dir === 'down' ? 'text-text-error' : 'text-text-muted'
  return (
    <div className={`text-[12px] mt-1 font-semibold inline-flex items-center gap-[3px] ${cls}`}>
      {delta.dir === 'up' && <ArrowUp size={11} />}
      {delta.dir === 'down' && <ArrowDown size={11} />}
      <span className={delta.dir === 'flat' ? 'font-normal' : ''}>{delta.text}</span>
    </div>
  )
}

function KpiCard({ kpi }: { kpi: KpiView }) {
  const LabelIcon = kpi.labelIcon === 'up' ? TrendingUp : kpi.labelIcon === 'down' ? TrendingDown : kpi.labelIcon === 'minus' ? Minus : null
  return (
    <div
      className="rounded-2xl px-4 py-3.5 transition-colors duration-300"
      style={{
        ...cardStyle,
        ...(kpi.glow ? { borderColor: 'rgba(0,212,255,0.35)', boxShadow: '0 0 24px rgba(0,212,255,0.07)' } : {}),
      }}
    >
      <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text-secondary mb-1.5 flex items-center gap-1.5">
        {LabelIcon && (
          <LabelIcon
            size={13}
            style={{ color: kpi.valueColor }}
          />
        )}
        {kpi.label}
      </div>
      <div
        className={`font-semibold ${kpi.smallValue ? 'text-[17px] pt-[3px]' : 'text-2xl'}`}
        style={kpi.valueColor ? { color: kpi.valueColor } : undefined}
      >
        {kpi.value}
      </div>
      <DeltaView delta={kpi.delta} />
    </div>
  )
}

// ─── Аналитические карточки ─────────────────────────────────────────────────

function TagHistogramCard({ content, tagTypes }: { content: WeeklyReportContent; tagTypes: Map<string, string> }) {
  const rows = useMemo(() => {
    if (content.stats) {
      return [...content.stats.perTag].sort((a, b) => b.current - a.current || b.prevWeek - a.prevWeek).slice(0, 10)
    }
    // Деградация без агрегатов: счётчики из списка статей, без сравнения
    return content.tagSummaries
      .map((t) => ({ tagId: t.tagId, tagName: t.tagName, current: t.articles.length, prevWeek: 0, monthAvg: 0 }))
      .sort((a, b) => b.current - a.current)
      .slice(0, 10)
  }, [content])

  const max = Math.max(...rows.map((r) => Math.max(r.current, r.prevWeek)), 1)
  const hiddenTags = content.tagSummaries.length - rows.length

  return (
    <div className="rounded-2xl p-5" style={cardStyle}>
      <h3 className="text-[15px] font-semibold mb-0.5">Новости по тегам</h3>
      <div className="text-[12px] text-text-muted mb-4">
        Топ-{rows.length} тегов · сравнение с прошлой неделей
        {hiddenTags > 0 && ` · …и ещё ${hiddenTags} ${pluralNews(hiddenTags)}`}
      </div>
      <div className="flex gap-4 text-[12px] text-text-secondary mb-3.5">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: 'linear-gradient(90deg,#0099CC,#00D4FF)' }} />
          Текущая неделя
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: '#2A2A2E' }} />
          Прошлая неделя
        </span>
      </div>
      <div>
        {rows.map((r) => {
          const dd = r.current - r.prevWeek
          return (
            <div key={r.tagId} className="grid items-center gap-2.5 mb-2" style={{ gridTemplateColumns: '110px 1fr 62px' }}>
              <span
                className="inline-flex items-center gap-[7px] text-[13px] rounded-pill pl-2 pr-2.5 py-[3px] max-w-full"
                style={{ backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tagColor(tagTypes, r.tagId) }} />
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">{r.tagName}</span>
              </span>
              <span className="flex flex-col gap-[3px]">
                <span className="block h-[9px] rounded-[3px] transition-all duration-400" style={{ width: `${(r.current / max) * 100}%`, minWidth: 2, background: 'linear-gradient(90deg,#0099CC,#00D4FF)' }} />
                <span className="block h-[9px] rounded-[3px] transition-all duration-400" style={{ width: `${(r.prevWeek / max) * 100}%`, minWidth: 2, background: '#2A2A2E' }} />
              </span>
              <span className="text-[12px] text-text-secondary text-right">
                {r.current}
                {content.stats && (
                  <>
                    {' '}
                    <span className="text-text-muted text-[11px]">/ {r.prevWeek}</span>
                    {dd !== 0 && (
                      <span className={`text-[11px] font-semibold ml-1 inline-flex items-center gap-[1px] ${dd > 0 ? 'text-text-success' : 'text-text-error'}`}>
                        {dd > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                        {Math.abs(dd)}
                      </span>
                    )}
                  </>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DaysCard({ content, weekStart, live, elapsedDays }: {
  content: WeeklyReportContent
  weekStart: string
  live: boolean
  elapsedDays: number | null
}) {
  const stats = content.stats
  if (!stats) return null // без агрегатов колонки по дням не построить — карточка скрыта

  const counts = new Map(stats.perDay.map((d) => [d.date, d.count]))
  const dates = weekDayDates(weekStart)
  const elapsed = live ? (elapsedDays ?? 7) : 7
  const max = Math.max(...dates.map((d) => counts.get(d) ?? 0), 1)
  const peak = Math.max(...dates.map((d) => counts.get(d) ?? 0))

  return (
    <div className="rounded-2xl p-5" style={cardStyle}>
      <h3 className="text-[15px] font-semibold mb-0.5">Динамика по дням</h3>
      <div className="text-[12px] text-text-muted mb-4">
        {live ? `Идёт день ${elapsedDays ?? elapsed} · заполнены прошедшие дни` : `Всего ${dates.reduce((s, d) => s + (counts.get(d) ?? 0), 0)} ${pluralNews(dates.reduce((s, d) => s + (counts.get(d) ?? 0), 0))}`}
      </div>
      <div className="flex items-end gap-2.5 h-[150px] pt-2.5">
        {dates.map((date, i) => {
          const n = counts.get(date) ?? 0
          const future = live && i >= elapsed
          const isPeak = !future && n === peak && peak > 0
          return (
            <div key={date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              {!future && <span className="text-[12px] font-semibold">{n}</span>}
              <span
                className="w-[70%] rounded-t-md transition-all duration-400"
                style={{
                  height: future ? 3 : `${(n / max) * 100}%`,
                  minHeight: 3,
                  visibility: future ? 'hidden' : 'visible',
                  background: future ? 'transparent' : 'linear-gradient(180deg,#00D4FF,#0099CC)',
                  boxShadow: isPeak ? '0 0 16px rgba(0,212,255,0.35)' : undefined,
                }}
              />
              <span className="text-[11px] text-text-muted">{formatDayLabel(date)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SentimentCard({ content, live }: { content: WeeklyReportContent; live: boolean }) {
  const stats = content.stats
  const s = stats
    ? stats.sentiment
    : {
        positive: content.sentimentBreakdown.positive,
        negative: content.sentimentBreakdown.negative,
        neutral: content.sentimentBreakdown.neutral,
        prevPositive: 0,
        prevNegative: 0,
        prevNeutral: 0,
      }
  const total = s.positive + s.negative + s.neutral || 1
  const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`
  const posDelta = stats && s.prevPositive > 0 ? Math.round((s.positive / s.prevPositive - 1) * 100) : null
  const ratio = sentimentRatio(s.positive, s.negative)

  return (
    <div className="rounded-2xl p-5" style={cardStyle}>
      <h3 className="text-[15px] font-semibold mb-0.5">Тональность недели</h3>
      <div className="text-[12px] text-text-muted mb-4">
        {!live && stats && posDelta !== null && (
          <>Позитив {posDelta >= 0 ? '+' : '−'}{Math.abs(posDelta)}% к прошлой неделе · </>
        )}
        соотношение позитив/негатив{' '}
        <b className="text-text-primary">{ratio ?? '—'}</b>
      </div>
      <div className="flex h-[26px] rounded-lg overflow-hidden mb-2.5">
        <div className="flex items-center justify-center text-[12px] font-semibold" style={{ width: pct(s.positive), background: 'rgba(52,211,153,0.55)' }}>{s.positive}</div>
        <div className="flex items-center justify-center text-[12px] font-semibold" style={{ width: pct(s.neutral), background: 'rgba(255,255,255,0.18)' }}>{s.neutral}</div>
        <div className="flex items-center justify-center text-[12px] font-semibold" style={{ width: pct(s.negative), background: 'rgba(239,68,68,0.55)' }}>{s.negative}</div>
      </div>
      <div className="flex gap-3.5 text-[12px] text-text-secondary flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <TrendingUp size={13} className="text-text-success" />
          Позитив <b className="text-text-primary">{s.positive}</b>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Minus size={13} className="text-text-muted" />
          Нейтрально <b className="text-text-primary">{s.neutral}</b>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <TrendingDown size={13} className="text-text-error" />
          Негатив <b className="text-text-primary">{s.negative}</b>
        </span>
      </div>
    </div>
  )
}

function SourcesCard({ content }: { content: WeeklyReportContent }) {
  const sources = useMemo(() => topSources(uniqueArticles(content.tagSummaries)), [content])
  if (sources.length === 0) return null
  const max = sources[0].count || 1
  return (
    <div className="rounded-2xl p-5" style={cardStyle}>
      <h3 className="text-[15px] font-semibold mb-0.5">Топ-источники</h3>
      <div className="text-[12px] text-text-muted mb-4">Откуда пришли новости вашего портфеля</div>
      <div>
        {sources.map(({ source, count }) => (
          <div key={source} className="flex items-center gap-2.5 mb-2.5">
            <div className="w-[130px] text-[13px] whitespace-nowrap overflow-hidden text-ellipsis">{source}</div>
            <div className="flex-1 h-2 rounded overflow-hidden" style={{ backgroundColor: 'var(--bg-hover)' }}>
              <div className="h-full rounded transition-all duration-400" style={{ width: `${(count / max) * 100}%`, background: '#3B82F6' }} />
            </div>
            <div className="w-[30px] text-right text-[12px] text-text-secondary">{count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Секция тега ────────────────────────────────────────────────────────────

function TagSection({ tag, live, scope, k, tagTypes, ai }: {
  tag: WeeklyReportTagSummary
  live: boolean
  scope: WeeklyScope
  k: string | null
  tagTypes: Map<string, string>
  ai: { perTag: Array<{ tagId: string; summary: string | null }> } | null
}) {
  const [expanded, setExpanded] = useState(false)
  const color = tagColor(tagTypes, tag.tagId)
  const shown = expanded ? tag.articles : tag.articles.slice(0, NEWS_PER_TAG)
  const aiEntry = ai?.perTag.find((t) => t.tagId === tag.tagId)
  // summary null при <3 новостях — не фича-гейт, плашку не показываем
  const showPremiumLock = !live && aiEntry && !aiEntry.summary && tag.articles.length >= 3

  // ТЗ-192: событие графика ведёт к новости в ленте; если она за пределами
  // свёрнутого списка — сначала разворачиваем, потом скроллим к якорю
  const scrollToArticle = (i: number) => {
    const jump = () =>
      document.getElementById(newsAnchorId(tag.tagId, i))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (i < NEWS_PER_TAG) {
      jump()
    } else {
      setExpanded(true)
      setTimeout(jump, 60)
    }
  }

  return (
    <section className="rounded-2xl px-5 py-[18px] mb-3" style={cardStyle}>
      <h4 className="text-[15px] font-semibold flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
        {tag.tagName}
        <span className="text-text-muted font-normal text-[13px]">
          · {tag.articles.length} {pluralNews(tag.articles.length)} за неделю
        </span>
      </h4>

      {!live && aiEntry?.summary && (
        <AiSummaryBlock label="Итоги по тегу · AI" text={aiEntry.summary} />
      )}
      {showPremiumLock && <PremiumLock />}

      <WeekChartBlock scope={scope} tagId={tag.tagId} k={k} live={live} onEventClick={scrollToArticle} />

      {shown.map((a, i) => {
        const cls = sentimentClass(a.sentiment)
        return (
          <div
            key={`${a.url || a.title}-${i}`}
            id={newsAnchorId(tag.tagId, i)}
            className="flex gap-2.5 px-3 py-2.5 rounded-xl mb-1.5 scroll-mt-24 transition-colors duration-200"
            style={{
              backgroundColor: cls === 'pos' ? 'rgba(52,211,153,0.03)' : cls === 'neg' ? 'rgba(239,68,68,0.03)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${cls === 'pos' ? 'rgba(52,211,153,0.12)' : cls === 'neg' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: SENTIMENT_COLORS[cls] }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium leading-[1.4]">{a.title}</div>
              <div className="text-[12px] text-text-muted mt-[3px]">
                {a.source} · {formatNewsDateTime(a.publishedAt)}
              </div>
            </div>
          </div>
        )
      })}

      {tag.articles.length > shown.length && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-accent-primary text-[13px] bg-transparent border-0 cursor-pointer px-3 py-1.5"
        >
          {expanded ? 'Свернуть' : `…и ещё ${tag.articles.length - shown.length} ${pluralNews(tag.articles.length - shown.length)}`}
        </button>
      )}
    </section>
  )
}

// ─── «Что впереди» ──────────────────────────────────────────────────────────

function AheadBlock({ scope, k }: { scope: WeeklyScope; k: string | null }) {
  const { data } = useWeeklyAhead(scope, k, true)
  const days = data?.ahead?.days
  if (!days || days.length === 0) return null

  return (
    <section className="rounded-2xl px-5 py-[18px] mb-3" style={{ ...cardStyle, borderColor: 'rgba(0,212,255,0.18)' }}>
      <h4 className="text-[15px] font-semibold flex items-center gap-2 mb-3">
        <CalendarDays size={16} style={{ color: 'var(--accent-primary)' }} />
        Что впереди
        <span className="text-text-muted font-normal text-[13px]">· по вашим тегам</span>
      </h4>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
        {days.map((day) => (
          <div
            key={day.date}
            className="rounded-xl px-3 py-2.5"
            style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="text-[12px] font-semibold text-text-muted mb-1.5">
              {formatDayLabel(day.date)}, {formatDayShort(day.date)}
            </div>
            {day.groups.map((g, gi) => {
              const color = KIND_COLORS[g.kind as EventKind] ?? '#9CA3AF'
              return (
                <div key={gi} className="text-[13px] mb-1 leading-[1.4]">
                  <span
                    className="inline-block text-[10px] font-semibold tracking-[0.04em] rounded-pill px-2 py-px mr-1.5"
                    style={{ border: `1px solid ${color}66`, color }}
                  >
                    {g.kind}
                  </span>
                  {g.title}
                  {g.status === 'expected' && <span className="text-text-warning"> (ожидается)</span>}
                  {g.companies.length > 0 && (
                    <span className="text-text-muted">
                      {' '}·{' '}
                      {/* ТЗ-192: подсветка matched убрана — бэкенд отдаёт matched:true всегда
                          (фильтр события уже по тегам портфеля), флаг оставлен в контракте */}
                      {g.companies.map((c, ci) => (
                        <span key={ci}>
                          {c.name}
                          {ci < g.companies.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="text-[11.5px] text-text-muted mt-2.5">
        Данные календаря инвестора · обновляются по мере подтверждения провайдерами
      </div>
    </section>
  )
}

// ─── Страница ───────────────────────────────────────────────────────────────

export default function WeeklyReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isLoggedIn, portfolio } = useAuth()
  const { open: openAuthModal } = useAuthModal()

  // Magic-токен из URL: читаем один раз; replaceState после успешной загрузки
  // не меняет location в роутере, но на случай перерендера держим в ref
  const [searchParams] = useSearchParams()
  const magicKRef = useRef<string | null>(searchParams.get('k'))
  const magicK = magicKRef.current

  const live = !id
  // Архив по magic-link открывается без сессии; live — сессия only
  const canView = isLoggedIn || Boolean(id && magicK)

  // Гость без токена: AuthModal вместо 401-«Отчёт не найден»
  useEffect(() => {
    if (!isLoggedIn && !(id && magicK)) {
      openAuthModal('login', { returnUrl: id ? `/reports/weekly/${id}` : '/reports/weekly' })
    }
  }, [isLoggedIn, id, magicK, openAuthModal])

  const listQ = useWeeklyReportList(isLoggedIn)
  const liveQ = useWeeklyCurrent(isLoggedIn && live)
  const archiveQ = useWeeklyArchive(id ?? null, magicK, Boolean(id) && canView)

  // Воскресенье после генерации: live-вид материализовался → редирект в архив
  const redirectId = liveQ.data && isSnapshotRedirect(liveQ.data) ? liveQ.data.snapshot_id : null
  useEffect(() => {
    if (redirectId) {
      navigate(`/reports/weekly/${redirectId}`, { replace: true })
    }
  }, [redirectId, navigate])

  // После успешной загрузки архива стираем ?k= из адресной строки
  // (против утечки через referer/скриншоты); chart/ahead продолжают использовать magicK
  useEffect(() => {
    if (!id || !archiveQ.data) return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('k')) return
    url.searchParams.delete('k')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [id, archiveQ.data])

  const tagTypes = useMemo(
    () => new Map(portfolio.map((t) => [t.tag_id, t.tag_type])),
    [portfolio],
  )

  // Live-блок «Итоги дня · AI» — из существующего /api/user/summary (кэш той фичи)
  const dailySummaryQ = useUserDailySummary(live && isLoggedIn)

  if (!canView) {
    return (
      <CenteredState
        icon={<BarChart3 size={26} style={{ color: 'var(--accent-primary)' }} />}
        title="Еженедельный отчёт"
        sub="Войдите, чтобы увидеть отчёт по вашему портфелю"
        action={<Link to="/" className="text-sm text-accent-primary hover:underline">На главную</Link>}
      />
    )
  }

  const query = live ? liveQ : archiveQ
  // Редирект по snapshot_id идёт через navigate — пока не случился, не флешим пустые состояния
  if (query.isLoading || redirectId) return <PageSkeleton />

  if (query.isError) {
    const status = (query.error as any)?.status
    if (!live && (status === 404 || status === 401)) {
      return (
        <CenteredState
          icon={<BarChart3 size={26} style={{ color: 'var(--accent-primary)' }} />}
          title="Отчёт не найден"
          sub="Возможно, ссылка устарела, а отчёт этой недели ещё не сгенерирован — отчёты появляются в воскресенье после 13:00"
          action={<Link to="/reports/weekly" className="text-sm text-accent-primary hover:underline">К текущей неделе</Link>}
        />
      )
    }
    if (live && status === 403) {
      return (
        <CenteredState
          icon={<Lock size={26} style={{ color: 'var(--accent-primary)' }} />}
          title="Еженедельный отчёт — платная функция"
          sub="Доступно на тарифах с еженедельной аналитикой портфеля"
          action={<Link to="/pricing" className="text-sm text-accent-primary hover:underline">Смотреть тарифы</Link>}
        />
      )
    }
    return (
      <CenteredState
        icon={<Loader2 size={26} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />}
        title="Не удалось загрузить отчёт"
        sub="Проверьте соединение и попробуйте снова"
        action={
          <button onClick={() => query.refetch()} className="text-sm text-accent-primary hover:underline">
            Повторить
          </button>
        }
      />
    )
  }

  const livePayload = liveQ.data && !isSnapshotRedirect(liveQ.data) ? liveQ.data : null
  const content: WeeklyReportContent | null = live
    ? livePayload?.content ?? null
    : archiveQ.data?.content ?? null
  const weekStart = live
    ? livePayload?.week_start ?? null
    : archiveQ.data?.week_start ?? null
  const ai = live ? null : archiveQ.data?.ai ?? null

  // «Новостей не было»: контент пуст (нет тегов/новостей за окно)
  if (!content || content.tagSummaries.length === 0 || !weekStart) {
    const hasTags = portfolio.length > 0
    return (
      <CenteredState
        icon={<CalendarDays size={26} style={{ color: 'var(--accent-primary)' }} />}
        title={hasTags ? 'Пока новостей не было' : 'В портфеле нет тегов'}
        sub={
          hasTags
            ? 'За эту неделю по вашим тегам новостей не нашлось — готовый отчёт появится в воскресенье после 13:00'
            : 'Отчёт собирается по тегам портфеля — добавьте теги, и с воскресенья здесь будет еженедельная аналитика'
        }
        action={
          hasTags ? undefined : (
            <Link to="/profile" className="text-sm text-accent-primary hover:underline">Настроить портфель</Link>
          )
        }
      />
    )
  }

  const scope: WeeklyScope = live ? { kind: 'live' } : { kind: 'archive', id: id! }
  const kpis = buildKpis({
    content,
    live,
    pace: livePayload?.pace ?? null,
    elapsedDays: livePayload?.elapsed_days ?? null,
  })

  // Лента недель (ПРАВКА-1 к ТЗ-191): live первым, дальше архив свежие первыми.
  // Границы и «N из 7 дней» текущей недели считаем локально (МСК) — в архивном
  // режиме live-пейлоад не загружен, а пилюля текущей недели всё равно есть.
  const reports = listQ.data?.reports ?? []
  const navItems: WeekStripItem[] = [
    ...(isLoggedIn ? [{ key: 'live', label: '', to: '/reports/weekly', live: true }] : []),
    ...reports.map((r) => ({ key: r.id, label: formatWeekRange(r.week_start), to: `/reports/weekly/${r.id}` })),
  ]
  const navCurrentKey = live ? 'live' : id!

  // Общий AI-блок: архив — снапшотное саммари; live — /api/user/summary
  const overallText = ai?.overall ?? null
  const overallMeta = ai?.meta
    ? `Сгенерировано по ${ai.meta.articles_count} ${pluralNews(ai.meta.articles_count)} · ${formatMetaDateTime(ai.meta.generated_at)}`
    : undefined
  const dailyText = dailySummaryQ.data?.summary ?? null
  const dailyMeta = dailySummaryQ.data
    ? `Сгенерировано по ${dailySummaryQ.data.articles_count} ${pluralNews(dailySummaryQ.data.articles_count)} · ${formatMetaDateTime(dailySummaryQ.data.generated_at)}`
    : undefined

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <div className="max-w-[1120px] mx-auto px-6 md:px-12 pt-24 pb-16">
        {/* Шапка: logo-конвенция страницы + действия */}
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-2.5 font-bold text-lg tracking-[0.02em]">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--accent-primary)', boxShadow: '0 0 12px var(--accent-primary)' }} />
            PULSE
          </div>
          <TopActions />
        </div>

        <h1 className="text-[22px] font-semibold mb-1 flex items-center gap-2">
          <BarChart3 size={22} style={{ color: 'var(--accent-primary)' }} />
          Еженедельный отчёт
        </h1>
        <p className="text-sm text-text-secondary mb-6">
          Новостная картина вашего портфеля — что произошло за неделю и как это соотносится с прошлым
        </p>

        <WeekStrip
          items={navItems}
          currentKey={navCurrentKey}
          liveRange={formatWeekRange(currentWeekStartMsk())}
          liveDays={livePayload?.elapsed_days ?? elapsedDaysOfWeekMsk()}
        />

        {/* AI-саммари: архив — «Итоги недели · AI», live — «Итоги дня · AI» из /user/summary */}
        {overallText && (
          <AiSummaryBlock label="Итоги недели · AI" text={overallText} meta={overallMeta} />
        )}
        {live && dailyText && (
          <AiSummaryBlock label="Итоги дня · AI" text={dailyText} meta={dailyMeta} />
        )}

        {/* KPI */}
        <div className="grid grid-cols-6 max-[900px]:grid-cols-3 gap-3 mb-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} />
          ))}
        </div>

        {/* Ряд 1: гистограмма тегов + дни */}
        <div className="grid gap-3 mb-3 max-[900px]:grid-cols-1" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
          <TagHistogramCard content={content} tagTypes={tagTypes} />
          <DaysCard
            content={content}
            weekStart={weekStart}
            live={live}
            elapsedDays={livePayload?.elapsed_days ?? null}
          />
        </div>

        {/* Ряд 2: тональность + источники */}
        <div className="grid grid-cols-2 gap-3 mb-3 max-[900px]:grid-cols-1">
          <SentimentCard content={content} live={live} />
          <SourcesCard content={content} />
        </div>

        {/* Секции по тегам */}
        {content.tagSummaries.map((tag) => (
          <TagSection
            key={tag.tagId}
            tag={tag}
            live={live}
            scope={scope}
            k={magicK}
            tagTypes={tagTypes}
            ai={ai}
          />
        ))}

        {/* Что впереди: события следующей недели по активным тегам портфеля */}
        <AheadBlock scope={scope} k={magicK} />

        {isLoggedIn && (
          <p className="text-center text-text-muted text-xs mt-7">
            Отчёт составлен автоматически сервисом PULSE · Настроить теги и каналы доставки →{' '}
            <Link to="/profile" className="text-accent-primary hover:underline">профиль</Link>
          </p>
        )}
      </div>
    </div>
  )
}
