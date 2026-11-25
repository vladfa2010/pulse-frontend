import type { FactCheckResultV4 } from './factCheck'

export interface TagImpact {
  tag: string
  score: number
  reasoning?: string
}

export interface NewsArticle {
  id: string
  slug: string
  title_ru: string | null
  title_original?: string | null
  summary_ru?: string | null
  summary_original?: string | null
  lang_original?: string | null
  source: string
  source_id?: string
  url?: string
  published_at: string
  fetched_at?: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  sentiment_score?: number
  sentiment_reasoning?: string
  sentiment_source?: string
  tag?: string
  matched_tags?: string[]
  source_count?: number
  all_sources?: string[]
  tag_impact?: TagImpact[]
  is_political?: boolean
  article_type?: 'micro' | 'macro'
  fact_check_status?: 'not_checked' | 'in_progress' | 'checked'
  fact_check_result?: FactCheckResultV4 | null
  // ТЗ-99: каскадные поля (кластеризация новостей)
  cluster_id?: string | null
  cluster_size?: number | null
  cluster_position?: number | null
  cluster_last_seen_at?: string | null
  cluster_growing?: boolean | null
  cluster_pending?: boolean | null
  // ТЗ-161: гибридный поиск (exact = ILIKE-попадание, semantic = эмбеддинг-близость)
  match_type?: 'exact' | 'semantic'
  similarity?: number
}

// ТЗ-218: бакеты «Пока вас не было» в ответе GET /api/news (unread-режим)
export interface BucketTopNews {
  id: string
  slug: string | null
  title: string
  source: string | null
  sentiment: string | null
  /** ТЗ-224: число СМИ (бейдж ×N у каскадной) */
  source_count?: number
  /** ТЗ-224: новость в каскаде — идёт первой, бейдж ×N */
  cascade?: boolean
}

export interface BucketPayload {
  key: 'night' | 'morning' | 'day' | 'evening' | 'older'
  label: string
  range_start: string | null
  range_end: string
  count: number
  sentiment: { pos: number; neg: number }
  viral_stories: number
  summary: string | null
  top_news: BucketTopNews[]
  generated_at: string | null
}
