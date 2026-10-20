/**
 * =============================================================================
 * PULSE — Еженедельный отчёт: маппинг payload → view-модель (ТЗ-191, Задача 4)
 * =============================================================================
 *
 * Чистые функции между ответом API (reportsApi.ts) и рендером WeeklyReportPage:
 * форматирование дат ru-RU, дедуп новостей между тегами, счётчики KPI,
 * темп live-режима (будни-к-будням). Вынесено отдельно — регрессионные тесты
 * на формы данных без рендера.
 */

import type {
  WeeklyReportArticle,
  WeeklyReportContent,
  WeeklyReportTagSummary,
  WeeklyStats,
} from '@/lib/reportsApi'

// ─── Тональность ────────────────────────────────────────────────────────────

export type SentimentClass = 'pos' | 'neg' | 'neu'

/** Статьи хранят сырой sentiment ('positive'|'negative'|прочее) → класс §3.2 */
export function sentimentClass(sentiment: string | null | undefined): SentimentClass {
  if (sentiment === 'positive') return 'pos'
  if (sentiment === 'negative') return 'neg'
  return 'neu'
}

export const SENTIMENT_COLORS: Record<SentimentClass, string> = {
  pos: '#34D399',
  neg: '#EF4444',
  neu: '#6B7280',
}

// ─── Плюрализация ───────────────────────────────────────────────────────────

/** plural(5, ['новость', 'новости', 'новостей']) → 'новостей' */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const d = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (d > 1 && d < 5) return forms[1]
  if (d === 1) return forms[0]
  return forms[2]
}

export function pluralNews(n: number): string {
  return plural(n, ['новость', 'новости', 'новостей'])
}

function pluralDays(n: number): string {
  return plural(n, ['день', 'дня', 'дней'])
}

// ─── Даты (ru-RU, неделя привязана к МСК) ───────────────────────────────────

const MSK = 'Europe/Moscow'

/** '2026-10-13' → «13 — 19 октября 2026» (пн — вс отчётной недели) */
export function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart.slice(0, 10)}T12:00:00`)
  const end = new Date(start.getTime() + 6 * 24 * 3600 * 1000)
  const fmt = (d: Date) =>
    d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: MSK })
  // Месяц/год у границ недели совпадают — берём у конца, день у начала
  const endParts = fmt(end).split(' ')
  const startDay = start.toLocaleDateString('ru-RU', { day: 'numeric', timeZone: MSK })
  return `${startDay} — ${endParts.slice(0, 2).join(' ')} ${endParts[2]}`
}

/** '2026-10-19' → 'Пн' (подписи колонок динамики по дням) */
export function formatDayLabel(date: string): string {
  const short = new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU', {
    weekday: 'short',
    timeZone: MSK,
  })
  return short.charAt(0).toUpperCase() + short.slice(1)
}

/** ISO → «14 окт, 09:41» (МСК) — мета-строка новости */
export function formatNewsDateTime(iso: string): string {
  const parts = new Date(iso)
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: MSK })
    .replace(/\.$/, '') // ICU отдаёт «окт.» — в UI подпись без точки (мокап)
  const time = new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MSK,
  })
  return `${parts}, ${time}`
}

/** ISO → «19 окт, 13:05» (МСК) — подпись meta AI-саммари */
export function formatMetaDateTime(iso: string): string {
  return formatNewsDateTime(iso)
}

/** '2026-10-13' → '13 окт' (легенда графика) */
export function formatDayShort(date: string): string {
  return new Date(`${date.slice(0, 10)}T12:00:00`)
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: MSK })
    .replace(/\.$/, '')
}

/** Даты пн..вс недели от week_start (YYYY-MM-DD) — подписи 7 колонок дней */
export function weekDayDates(weekStart: string): string[] {
  const start = new Date(`${weekStart.slice(0, 10)}T12:00:00`)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getTime() + i * 24 * 3600 * 1000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}

// ─── Источники ──────────────────────────────────────────────────────────────

/**
 * Статья входит в КАЖДЫЙ тег, которому сматчилась — для «Топ-источников»
 * дедупим по url (фолбэк title), иначе многотеговые новости считались бы
 * несколько раз.
 */
export function uniqueArticles(tagSummaries: WeeklyReportTagSummary[]): WeeklyReportArticle[] {
  const seen = new Set<string>()
  const out: WeeklyReportArticle[] = []
  for (const tag of tagSummaries) {
    for (const a of tag.articles) {
      const key = a.url || `${a.title}|${a.publishedAt}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(a)
    }
  }
  return out
}

export interface SourceCount {
  source: string
  count: number
}

export function topSources(articles: WeeklyReportArticle[], limit = 6): SourceCount[] {
  const counts = new Map<string, number>()
  for (const a of articles) {
    counts.set(a.source, (counts.get(a.source) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
    .slice(0, limit)
}

// ─── KPI ────────────────────────────────────────────────────────────────────

export interface KpiDelta {
  text: string
  dir: 'up' | 'down' | 'flat'
}

export interface KpiView {
  key: string
  label: string
  value: string
  /** CSS-цвет значения; undefined — text-primary */
  valueColor?: string
  /** Иконка в лейбле (TrendingUp/Down/Minus по §3.2) */
  labelIcon?: 'up' | 'down' | 'minus'
  glow?: boolean
  /** Меньший кегль значения (строковые значения: тег, процент) */
  smallValue?: boolean
  delta?: KpiDelta
}

function pctDelta(cur: number, prev: number): KpiDelta | undefined {
  if (prev <= 0) return { text: '—', dir: 'flat' }
  const pct = Math.round((cur / prev - 1) * 100)
  const arrow = pct >= 0
  return {
    text: `${arrow ? '+' : '−'}${Math.abs(pct)}%`,
    dir: arrow ? 'up' : 'down',
  }
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  const rounded = Math.round(Math.abs(n) * 100) / 100
  return `${n >= 0 ? '+' : '−'}${rounded}%`
}

export interface BuildKpisInput {
  content: WeeklyReportContent
  live: boolean
  /** Только live: темп будни-к-будням из /weekly/current */
  pace: { elapsed_total: number; prev_same_weekdays_total: number } | null
  elapsedDays: number | null
}

/**
 * 6 KPI-карточек по мокапу. Архив: процентные дельты к прошлой неделе.
 * Live: дельт нет (неделя неполная) — вместо них темп «N за D дней · …».
 */
export function buildKpis({ content, live, pace, elapsedDays }: BuildKpisInput): KpiView[] {
  const stats: WeeklyStats | null = content.stats
  const sentiment = stats
    ? stats.sentiment
    : {
        positive: content.sentimentBreakdown.positive,
        negative: content.sentimentBreakdown.negative,
        neutral: content.sentimentBreakdown.neutral,
        prevPositive: 0,
        prevNegative: 0,
        prevNeutral: 0,
      }
  const total = stats
    ? sentiment.positive + sentiment.negative + sentiment.neutral
    : content.totalArticles

  // Карточка 1 — всего (glow) + дельта/темп
  let totalDelta: KpiDelta
  if (live && pace && elapsedDays) {
    totalDelta = { text: tempoLine(elapsedDays, pace), dir: 'flat' }
  } else if (!live && stats?.kpis.totalDeltaWeekPct != null) {
    const v = stats.kpis.totalDeltaWeekPct
    totalDelta = { text: `${fmtPct(v)} к пр. неделе`, dir: v >= 0 ? 'up' : 'down' }
  } else {
    totalDelta = { text: live ? 'неделя идёт' : '—', dir: 'flat' }
  }

  // Карточка 2 — к месячному среднему
  const monthPct = stats?.kpis.totalDeltaMonthPct
  const monthAvg = stats ? Math.round(stats.perTag.reduce((s, t) => s + t.monthAvg, 0)) : 0

  // Карточка 6 — самый обсуждаемый тег
  const topTagRow = stats?.kpis.topTagId
    ? stats.perTag.find((t) => t.tagId === stats.kpis.topTagId)
    : undefined
  const fallbackTop = [...content.tagSummaries].sort((a, b) => b.articles.length - a.articles.length)[0]
  const topName = topTagRow?.tagName ?? fallbackTop?.tagName ?? '—'
  const topCount = topTagRow?.current ?? fallbackTop?.articles.length ?? 0

  return [
    {
      key: 'total',
      label: 'Всего новостей',
      value: String(total),
      glow: true,
      delta: totalDelta,
    },
    {
      key: 'month',
      label: 'К мес. среднему',
      value: monthPct != null ? fmtPct(monthPct) : '—',
      smallValue: true,
      delta: monthAvg > 0 ? { text: `среднее: ${monthAvg} / нед`, dir: 'flat' } : { text: '—', dir: 'flat' },
    },
    {
      key: 'pos',
      label: 'Позитив',
      value: String(sentiment.positive),
      valueColor: 'var(--text-success)',
      labelIcon: 'up',
      delta: !live && stats ? (pctDelta(sentiment.positive, sentiment.prevPositive) ?? { text: '—', dir: 'flat' }) : { text: '—', dir: 'flat' },
    },
    {
      key: 'neg',
      label: 'Негатив',
      value: String(sentiment.negative),
      valueColor: 'var(--text-error)',
      labelIcon: 'down',
      delta: !live && stats ? (pctDelta(sentiment.negative, sentiment.prevNegative) ?? { text: '—', dir: 'flat' }) : { text: '—', dir: 'flat' },
    },
    {
      key: 'neu',
      label: 'Нейтрально',
      value: String(sentiment.neutral),
      valueColor: 'var(--text-secondary)',
      labelIcon: 'minus',
      delta: { text: '—', dir: 'flat' },
    },
    {
      key: 'top',
      label: 'Самый обсуждаемый',
      value: topName,
      smallValue: true,
      delta: { text: `${topCount} ${pluralNews(topCount)}`, dir: 'flat' },
    },
  ]
}

/** Темп live-режима: «47 за 3 дня · в прошлую неделю за те же 3 дня — 52» */
export function tempoLine(days: number, pace: { elapsed_total: number; prev_same_weekdays_total: number }): string {
  const d = `${days} ${pluralDays(days)}`
  return `${pace.elapsed_total} за ${d} · в прошлую неделю за те же ${d} — ${pace.prev_same_weekdays_total}`
}

/** Соотношение позитив/негатив: «1.6×»; null — негатива нет */
export function sentimentRatio(positive: number, negative: number): string | null {
  if (negative <= 0) return null
  return `${(positive / negative).toFixed(1)}×`
}

// ─── AI-саммари ─────────────────────────────────────────────────────────────

/** Параграфы текста саммари — рендер только текстовыми узлами React */
export function summaryParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/** Якорь новости в ленте тега — сюда ведут строки событий из WeekChartBlock */
export function newsAnchorId(tagId: string, index: number): string {
  return `wr-news-${tagId}-${index}`
}
