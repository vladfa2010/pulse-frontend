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
}
