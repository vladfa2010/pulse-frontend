/**
 * PULSE — Карусель "Вся лента" (История прочтений)
 *
 * Показывает ПРОЧИТАННЫЕ новости по тегам пользователя.
 * Хронологический порядок — старые слева, новые справа.
 *
 * API: GET /api/news?history=true&limit=50
 */

import { useCallback } from 'react'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import NewsCard from './NewsCard'
import NewsCarousel from './NewsCarousel'
import { Newspaper } from 'lucide-react'

interface NewsArticle {
  id: string
  title_ru: string
  source: string
  published_at: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  tag?: string
  url?: string
  source_count?: number
  all_sources?: string[]
}

async function fetchHistoryNews(): Promise<NewsArticle[]> {
  const data = await api.get('/news?history=true&limit=50')
  return (data.articles || []).map((a: any) => ({
    ...a,
    tag: a.matched_tags?.[0] || a.tag,
  }))
}

export default function AllNewsCarousel() {
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['historyNews'],
    queryFn: fetchHistoryNews,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const handleCardClick = useCallback((article: NewsArticle) => {
    if (article.url) window.open(article.url, '_blank', 'noopener,noreferrer')
  }, [])

  // Loading
  if (isLoading) {
    return (
      <NewsCarousel title="Вся лента" icon={<Newspaper size={14} />} accentColor="#A78BFA">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="w-[220px] h-[140px] rounded-xl bg-[#161616] animate-pulse flex-shrink-0" />
        ))}
      </NewsCarousel>
    )
  }

  // Empty
  if (articles.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Newspaper size={14} className="text-text-muted" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted">Вся лента</h2>
        </div>
        <p className="text-[11px] text-text-muted">История прочтений появится после просмотра новостей</p>
      </div>
    )
  }

  return (
    <NewsCarousel
      title="Вся лента"
      icon={<Newspaper size={14} />}
      subtitle="история"
      count={articles.length}
      accentColor="#A78BFA"
    >
      {articles.map((article, i) => (
        <div key={article.id} onClick={() => handleCardClick(article)} className="cursor-pointer">
          <NewsCard article={article} index={i} tagLabel={article.tag} />
        </div>
      ))}
    </NewsCarousel>
  )
}
