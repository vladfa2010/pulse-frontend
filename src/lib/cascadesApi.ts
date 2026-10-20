/**
 * =============================================================================
 * PULSE — API-слой страницы «Каскады» (ТЗ-93, задача 4)
 * =============================================================================
 *
 * Типы ответов и react-query хуки публичных эндпоинтов /api/market/*:
 *   GET /market/cascades?window=24h|7d|30d        — таблица каскадов (TTL 60 с)
 *   GET /market/stories                           — сюжеты с кластерами (TTL 15 мин)
 *   GET /market/cascade-chart?cluster_id=…        — свечи + маркеры новостей (TTL 15 мин)
 *   GET /market/cascade-graph?window=7d|30d       — данные force-графа (TTL 15 мин)
 *   GET /market/cascade-research?window=7d|30d    — статистика «кто первый» (TTL 15 мин)
 *   GET /market/topics                            — темы HDBSCAN, последний прогон (TTL 15 мин, ТЗ-115)
 *   GET /market/topic?id=<uuid>                   — деталка темы: новости/каскады/сюжеты (TTL 15 мин, ТЗ-115)
 *   GET /market/virality                          — ночной LLM-разбор топ-20 каскадов/сюжетов/тем (TTL 15 мин, ТЗ-185)
 *   GET /market/source-stats?days=30              — ночные срезы «кто первый» за 30 дней (TTL 15 мин, ТЗ-186)
 *
 * staleTime хуков совпадает с серверным TTL — лишних запросов нет.
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { InstrumentChart } from '@/lib/newsChart'
import type { CascadesWindow } from '@/lib/cascadeParams'

// ─── /market/cascades ───────────────────────────────────────────────────────

export interface CascadeFirstNews {
  title: string
  source: string
  url: string | null
  published_at: string
}

export interface Cascade {
  cluster_id: string
  size: number
  life_min: number | null
  max_sim: number | null
  verdict: string
  tags: string[]
  source: string | null
  story_id: string | null
  first_news: CascadeFirstNews | null
  /** Цепочка источников в порядке публикации; повторы оставляем (схлопаем при отрисовке) */
  sources: string[]
  first_published_at: string
  last_seen_at: string
}

export interface CascadesResponse {
  window: string
  cascades: Cascade[]
}

export function useCascades(window: CascadesWindow, enabled: boolean) {
  return useQuery<CascadesResponse>({
    queryKey: ['cascades', 'list', window],
    queryFn: async () => api.get(`/market/cascades?window=${window}`),
    staleTime: 60 * 1000,
    enabled,
  })
}

// ─── /market/stories ────────────────────────────────────────────────────────

export interface StoryCluster {
  cluster_id: string
  size: number
  max_sim: number | null
  verdict: string
  tags: string[]
  first_published_at: string | null
  last_seen_at: string | null
}

export interface Story {
  story_id: string
  title: string
  summary: string | null
  started_at: string | null
  last_seen_at: string | null
  clusters: StoryCluster[]
}

export interface StoriesResponse {
  stories: Story[]
}

export function useStories(enabled: boolean) {
  return useQuery<StoriesResponse>({
    queryKey: ['cascades', 'stories'],
    queryFn: async () => api.get('/market/stories'),
    staleTime: 15 * 60 * 1000,
    enabled,
  })
}

// ─── /market/cascade-chart ──────────────────────────────────────────────────

export interface NewsMarker {
  /** ТЗ-99 задача 2: id новости — ключ строки и якорь для ссылки (ТЗ-101) */
  id: string
  published_at: string
  title: string
  source: string
  /** ТЗ-99 задача 2: url оригинала; null → строка без ссылки (ТЗ-101) */
  url: string | null
}

export interface CascadeChartResponse {
  cluster_id: string
  published_at: string
  instruments: InstrumentChart[]
  news_markers: NewsMarker[]
}

export function useCascadeChart(clusterId: string | null) {
  return useQuery<CascadeChartResponse>({
    queryKey: ['cascades', 'chart', clusterId],
    queryFn: async () => api.get(`/market/cascade-chart?cluster_id=${encodeURIComponent(clusterId!)}`),
    staleTime: 15 * 60 * 1000,
    enabled: Boolean(clusterId),
    retry: false,
  })
}

// ─── /market/topics и /market/topic (ТЗ-115) ────────────────────────────────

export interface TopicDailyPoint {
  /** 'YYYY-MM-DD' по Europe/Moscow */
  d: string
  n: number
}

export interface Topic {
  id: string
  /** null, пока Node-cron нейминга не назвал тему (штатно до 04:10) */
  name: string | null
  summary: string | null
  news_count: number
  span_days: number | null
  sources_count: number | null
  trend: 'growing' | 'stable' | 'fading'
  daily: TopicDailyPoint[]
  /** MAX(published_at) членов темы (ТЗ-184 v3) — сортировка «по событию» и мета-строка */
  last_event_at: string | null
}

export interface TopicsResponse {
  run_at: string
  window_days: number
  topics_total: number
  news_covered: number
  noise_count: number
  topics: Topic[]
}

export function useTopics(enabled: boolean) {
  return useQuery<TopicsResponse>({
    queryKey: ['cascades', 'topics'],
    queryFn: async () => api.get('/market/topics'),
    staleTime: 15 * 60 * 1000,
    enabled,
    retry: false,
  })
}

export interface TopicNewsItem {
  id: string
  time: string
  source: string
  title: string
  url: string | null
}

export interface TopicCascade {
  id: string
  title: string
  news_count: number
  overlap: number
}

export interface TopicStory {
  id: string
  name: string
  overlap: number
}

export interface TopicStats {
  news_count: number
  span_days: number | null
  sources_count: number | null
}

export interface TopicResponse {
  id: string
  name: string | null
  summary: string | null
  stats: TopicStats
  news: TopicNewsItem[]
  cascades: TopicCascade[]
  stories: TopicStory[]
}

export function useTopic(id: string | null) {
  return useQuery<TopicResponse>({
    queryKey: ['cascades', 'topic', id],
    queryFn: async () => api.get(`/market/topic?id=${encodeURIComponent(id!)}`),
    staleTime: 15 * 60 * 1000,
    enabled: Boolean(id),
    retry: false,
  })
}

// ─── /market/virality (ТЗ-185) ──────────────────────────────────────────────

export interface ViralityTopTopic {
  title: string
  /** 1 предложение: почему тема в топе перепечаток */
  takeaway: string
}

export interface ViralityPayload {
  /** 3–5 пунктов: темы, объединяющие самые разгоняемые события топ-20 */
  top_topics: ViralityTopTopic[]
  /** Общие триггеры: числа, персоны, регуляторика, гео… — чипсы в UI */
  virality_triggers: string[]
  /** Кто чаще первоисточник в топе */
  ignition: { sources: string[]; takeaway: string }
  /** Всплески vs долгие каскады */
  tempo: { fast_vs_slow: string; takeaway: string }
  /** 2–3 предложения итогом */
  summary: string
}

export interface ViralityResponse {
  /** Время последнего прогона — одно на все скоупы (дата в шапке секций) */
  generated_at: string
  /** null-скоуп — прогона по нему ещё не было (пустое состояние, не ошибка) */
  scopes: {
    cascades_24h: ViralityPayload | null
    stories_7d: ViralityPayload | null
    topics: ViralityPayload | null
  }
}

export function useVirality(enabled: boolean) {
  return useQuery<ViralityResponse>({
    queryKey: ['cascades', 'virality'],
    queryFn: async () => api.get('/market/virality'),
    staleTime: 15 * 60 * 1000,
    enabled,
    retry: false,
  })
}

// ─── /market/cascade-graph ──────────────────────────────────────────────────

export interface GraphItem {
  /** epoch-секунды публикации */
  t: number
  source: string
  title: string
}

export interface GraphCascade {
  cluster_id: string
  story_id: string | null
  /** Отсортированы по lag_min ASC: первый элемент — первоисточник */
  items: GraphItem[]
}

export interface GraphStory {
  story_id: string
  title: string
}

export type GraphFeedPoint = [number, string]

export interface CascadeGraphResponse {
  window: string
  cascades: GraphCascade[]
  stories: GraphStory[]
  /** ВСЕ новости окна — фон «звёздное поле» */
  feed: GraphFeedPoint[]
}

export function useCascadeGraph(window: CascadesWindow, enabled: boolean) {
  return useQuery<CascadeGraphResponse>({
    queryKey: ['cascades', 'graph', window],
    queryFn: async () => api.get(`/market/cascade-graph?window=${window}`),
    staleTime: 15 * 60 * 1000,
    enabled,
  })
}

// ─── /market/cascade-research ───────────────────────────────────────────────

export interface ResearchSource {
  source: string
  first_count: number
  share: number
  participations: number
  first_rate: number
  /** Медианный lag_min по членствам, где источник не первый; null — если таких не было */
  median_lag_not_first: number | null
}

export interface CascadeSpeed {
  median_second_lag_min: number | null
  cascades_with_second: number
  dup_le_10m: number
  dup_le_60m: number
  dup_le_10m_share: number
  dup_le_60m_share: number
}

export interface CascadeResearchResponse {
  window: string
  clusters_total: number
  sources: ResearchSource[]
  speed: CascadeSpeed
}

export function useCascadeResearch(window: CascadesWindow, enabled: boolean) {
  return useQuery<CascadeResearchResponse>({
    queryKey: ['cascades', 'research', window],
    queryFn: async () => api.get(`/market/cascade-research?window=${window}`),
    staleTime: 15 * 60 * 1000,
    enabled,
  })
}

// ─── /market/source-stats (ТЗ-186) ──────────────────────────────────────────

export interface SourceStatsPoint {
  /** 'YYYY-MM-DD' — дата конца скользящего окна 7 дней (МСК) */
  date: string
  first_count: number
  /** first_count / clusters_total окна — дробь 0..1 */
  share: number
  participations: number
  /** Медианный lag_min по членствам, где источник не первый; null — таких не было */
  median_lag_not_first_min: number | null
}

export interface SourceStatsEntry {
  source: string
  /** Срезы за days дней по возрастанию даты */
  points: SourceStatsPoint[]
  /** Последний срез */
  latest: { date: string; share: number; first_count: number }
  /** Срез 7 дней назад от latest — для дельт; null — истории недостаточно */
  week_ago: { date: string; share: number } | null
}

export interface SourceStatsResponse {
  days: number
  /** Дата первого доступного среза; null — срезов ещё нет */
  snapshots_from: string | null
  sources: SourceStatsEntry[]
}

/** Ночные срезы «кто первый» (ТЗ-186). Fire-and-forget: retry=false — при ошибке
 *  или пустых данных колонка «Тренд 30д» в «Ресерче» скрывается, а вкладка
 *  «Динамика» рисует состояние ошибки, не ломая остальные вкладки. */
export function useSourceStats(enabled: boolean) {
  return useQuery<SourceStatsResponse>({
    queryKey: ['cascades', 'source-stats'],
    queryFn: async () => api.get('/market/source-stats?days=30'),
    staleTime: 15 * 60 * 1000,
    enabled,
    retry: false,
  })
}
