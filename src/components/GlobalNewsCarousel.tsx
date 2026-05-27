/**
 * PULSE — Карусель "Общая лента"
 *
 * ТРЕТЬЯ карусель. Показывает ВСЕ новости из базы
 * без фильтра по тегам. Видна всем пользователям.
 *
 * API: GET /api/news?global=true&limit=50
 */

import { useCallback } from 'react'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import NewsCard from './NewsCard'
import NewsCarousel from './NewsCarousel'


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

async function fetchGlobalNews(): Promise<NewsArticle[]> {
  const data = await api.get('/news?global=true&limit=50')
  return (data.articles || [])
    .map((a: any) => ({
      ...a,
      tag: a.matched_tags?.[0] || a.tag,
    }))
    .sort((a: any, b: any) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    )
}

export default function GlobalNewsCarousel() {
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['globalNews'],
    queryFn: fetchGlobalNews,
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
      <NewsCarousel title="Общая лента">
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
          <h2 className="text-2xl font-semibold text-text-muted">Общая лента</h2>
        </div>
        <p className="text-[11px] text-text-muted">Новости появятся после следующего обновления RSS</p>
      </div>
    )
  }

  return (
    <NewsCarousel
      title="Общая лента"
      
      subtitle="все источники"
      count={articles.length}
      accentColor="#6B7280"
    >
      {articles.map((article, i) => (
        <div key={article.id} onClick={() => handleCardClick(article)} className="cursor-pointer">
          <NewsCard article={article} index={i} tagLabel={article.tag} />
        </div>
      ))}
    </NewsCarousel>
  )
}
      </div>
      ))}
    </NewsCarousel>
  )
}
