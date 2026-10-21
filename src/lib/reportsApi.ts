/**
 * =============================================================================
 * PULSE — API-слой еженедельного отчёта (ТЗ-191, Задача 4)
 * =============================================================================
 *
 * Типы ответов и react-query хуки эндпоинтов /api/reports/*:
 *   GET /reports/weekly                     — архив юзера [{id, week_start, total, top_tag}], ≤12
 *   GET /reports/weekly/current             — LIVE-вид текущей недели ИЛИ {snapshot_id} (редирект)
 *   GET /reports/weekly/:id                 — полный payload архивного снапшота
 *   GET /reports/weekly/:id/chart?tag_id=   — M5-график недели (форма = cascade-chart)
 *   GET /reports/weekly/current/chart?tag_id= — live-график (те же правила)
 *   GET /reports/weekly/:id/ahead           — календарь следующей недели (оба режима)
 *
 * Доступ: сессия (JWT через api-клиент) или magic-link ?k= (только архив).
 * Протокол ?k=: первый запрос БЕЗ токена; при 401 и наличии токена в URL —
 * повтор с ?k=; после успеха фронт стирает ?k= из адресной строки
 * (WeeklyReportPage), но продолжает передавать его chart/ahead-запросам.
 * staleTime хуков совпадает с серверными TTL (5 мин live / 24 ч архив-график).
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { InstrumentChart } from '@/lib/newsChart'
import type { NewsMarker } from '@/lib/cascadesApi'
import type { CalendarDay } from '@/types/calendar'

// ─── Payload (форма = WeeklyReportContent бэкенда) ──────────────────────────

export interface WeeklyReportArticle {
  title: string
  summary: string
  source: string
  url: string
  /** ISO-строка: в JSON-снапшоте Date сериализован строкой */
  publishedAt: string
  sentiment: string
}

export interface WeeklyReportTagSummary {
  tagId: string
  tagName: string
  articles: WeeklyReportArticle[]
}

export interface WeeklyStatsTagRow {
  tagId: string
  tagName: string
  current: number
  prevWeek: number
  monthAvg: number
}

export interface WeeklyStatsDayRow {
  /** YYYY-MM-DD */
  date: string
  count: number
}

export interface WeeklyStats {
  perTag: WeeklyStatsTagRow[]
  /** 7 дней от week_start; в live — только прошедшие будни */
  perDay: WeeklyStatsDayRow[]
  sentiment: {
    positive: number
    negative: number
    neutral: number
    prevPositive: number
    prevNegative: number
    prevNeutral: number
  }
  kpis: {
    /** null — на неполной неделе live (сравнение будни-к-будням, только tempo) */
    totalDeltaWeekPct: number | null
    totalDeltaMonthPct: number | null
    topTagId: string | null
    peakDay: string | null
  }
  /** Только live: сколько будних дней недели уже прошло */
  elapsedDays?: number
}

export interface WeeklyReportContent {
  period: string
  tagSummaries: WeeklyReportTagSummary[]
  totalArticles: number
  sentimentBreakdown: { positive: number; negative: number; neutral: number }
  /** null — агрегаты не посчитались: контент есть, точных счётчиков нет */
  stats: WeeklyStats | null
}

export interface WeeklyAITagSummary {
  tagId: string
  tagName: string
  summary: string | null
}

export interface WeeklyAISummaries {
  /** null — LLM недоступен/нет ключа; блок скрывается */
  overall: string | null
  /** топ-5 тегов; summary null — нет фичи ai_summary, <3 новостей или ошибка LLM */
  perTag: WeeklyAITagSummary[]
  meta: { model: string; generated_at: string; articles_count: number } | null
}

// ─── Списки и режимы ────────────────────────────────────────────────────────

export interface WeeklyReportListItem {
  id: string
  /** YYYY-MM-DD понедельника отчётной недели */
  week_start: string
  total: number
  top_tag: string | null
}

/** Ответ /weekly/current: либо live-пayload, либо сигнал редиректа в архив
 *  (воскресенье после воскресной генерации — live-вид материализовался) */
export type WeeklyLivePayload =
  | { snapshot_id: string }
  | {
      live: true
      week_start: string
      elapsed_days: number
      pace: { elapsed_total: number; prev_same_weekdays_total: number }
      content: WeeklyReportContent | null
      ai: WeeklyAISummaries | null
    }

export function isSnapshotRedirect(payload: WeeklyLivePayload): payload is { snapshot_id: string } {
  return 'snapshot_id' in payload
}

export interface WeeklyArchivePayload {
  id: string
  week_start: string
  created_at: string
  updated_at: string
  sent_at: string | null
  content: WeeklyReportContent
  ai: WeeklyAISummaries | null
}

// ─── График и календарь ─────────────────────────────────────────────────────

/** Форма ответа ИДЕНТИЧНА пейлоаду /market/cascade-chart + week_change_pct */
export interface WeeklyChartResponse {
  chart: InstrumentChart | null
  news_markers: NewsMarker[]
  /** Изменение цены за неделю (первый open → последний close), %; null — без свечей */
  week_change_pct: number | null
  /** ПРАВКА-2 к ТЗ-191: новостной фон (сантимент) по бакетам 4 ч, окно 12 ч;
   *  null — <2 новостей за окно, панель скрыта целиком */
  sentiment: { t: string; score: number }[] | null
  /** 'market_unavailable' — провайдер недоступен; блок скрыт, страница цела */
  reason?: string
}

export interface WeeklyAheadPayload {
  days: CalendarDay[]
}

/** Скоуп графика/календаря: live — текущая неделя, archive — снапшот по id */
export type WeeklyScope = { kind: 'live' } | { kind: 'archive'; id: string }

const LIVE_STALE_MS = 5 * 60 * 1000
const ARCHIVE_CHART_STALE_MS = 24 * 3600 * 1000

// ─── Хуки ───────────────────────────────────────────────────────────────────

/** Архив юзера (сессия only; для magic-link гостя не запрашиваем) */
export function useWeeklyReportList(enabled: boolean) {
  return useQuery<{ reports: WeeklyReportListItem[] }>({
    queryKey: ['reports', 'weekly', 'list'],
    queryFn: () => api.get('/reports/weekly'),
    staleTime: LIVE_STALE_MS,
    enabled,
    retry: false,
  })
}

/** LIVE-вид текущей недели (сессия only) */
export function useWeeklyCurrent(enabled: boolean) {
  return useQuery<WeeklyLivePayload>({
    queryKey: ['reports', 'weekly', 'current'],
    queryFn: () => api.get('/reports/weekly/current'),
    staleTime: LIVE_STALE_MS,
    enabled,
    retry: false,
  })
}

async function fetchWeeklyArchive(id: string, k: string | null): Promise<WeeklyArchivePayload> {
  try {
    return await api.get(`/reports/weekly/${encodeURIComponent(id)}`)
  } catch (err: any) {
    // Magic-link: гость без сессии получает 401 — повторяем с токеном из URL
    if (err?.status === 401 && k) {
      return await api.get(`/reports/weekly/${encodeURIComponent(id)}?k=${encodeURIComponent(k)}`)
    }
    throw err
  }
}

/** Архивный снапшот. k — magic-токен из ?k= (только для гостя по ссылке) */
export function useWeeklyArchive(id: string | null, k: string | null, enabled: boolean) {
  return useQuery<WeeklyArchivePayload>({
    queryKey: ['reports', 'weekly', 'archive', id],
    queryFn: () => fetchWeeklyArchive(id!, k),
    staleTime: 60 * 60 * 1000,
    enabled: enabled && Boolean(id),
    retry: false,
  })
}

function chartPath(scope: WeeklyScope, tagId: string, k: string | null): string {
  const base =
    scope.kind === 'live'
      ? '/reports/weekly/current/chart'
      : `/reports/weekly/${encodeURIComponent(scope.id)}/chart`
  const params = new URLSearchParams({ tag_id: tagId })
  // Токен валиден и для графика — передаём, пока сессии нет
  if (k) params.set('k', k)
  return `${base}?${params.toString()}`
}

/** M5-график недели по тегу. Деградация: chart null → блок скрыт вызывающим кодом */
export function useWeeklyChart(scope: WeeklyScope, tagId: string, k: string | null, enabled: boolean) {
  return useQuery<WeeklyChartResponse>({
    queryKey: ['reports', 'weekly', 'chart', scope, tagId],
    queryFn: () => api.get(chartPath(scope, tagId, k)),
    staleTime: scope.kind === 'live' ? LIVE_STALE_MS : ARCHIVE_CHART_STALE_MS,
    enabled: enabled && Boolean(tagId),
    retry: false,
  })
}

function aheadPath(scope: WeeklyScope, k: string | null): string {
  const base =
    scope.kind === 'live'
      ? '/reports/weekly/current/ahead'
      : `/reports/weekly/${encodeURIComponent(scope.id)}/ahead`
  return k ? `${base}?k=${encodeURIComponent(k)}` : base
}

/** Календарь «что впереди»: события следующей недели по активным тегам портфеля */
export function useWeeklyAhead(scope: WeeklyScope, k: string | null, enabled: boolean) {
  return useQuery<{ ahead: WeeklyAheadPayload | null }>({
    queryKey: ['reports', 'weekly', 'ahead', scope],
    queryFn: () => api.get(aheadPath(scope, k)),
    staleTime: 60 * 60 * 1000,
    enabled,
    retry: false,
  })
}

// ─── /api/user/summary (live-блок «Итоги дня · AI») ─────────────────────────

export interface UserDailySummary {
  summary: string
  cached: boolean
  generated_at: string
  articles_count: number
}

/**
 * Существующий кэшированный эндпоинт дайджеста — в live-отчёте общий AI-блок
 * берём отсюда (LLM-бюджет отчётов не тратится). Конвенция кэширования той
 * фичи: свежий кэш на сервере, на клиенте — короткий staleTime, retry=false
 * (ошибка → блок молча скрыт, как в DailySummary).
 */
export function useUserDailySummary(enabled: boolean) {
  return useQuery<UserDailySummary>({
    queryKey: ['user', 'summary'],
    queryFn: () => api.get('/user/summary'),
    staleTime: 5 * 60 * 1000,
    enabled,
    retry: false,
  })
}
