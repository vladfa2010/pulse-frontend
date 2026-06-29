/**
 * PULSE — Карусель "Общая лента"
 *
 * ТРЕТЬЯ карусель. Показывает ВСЕ новости из базы
 * без фильтра по тегам. Видна всем пользователям.
 *
 * API: GET /api/news/global?limit=50&page=N
 * Бесконечный скролл: при приближении к концу подгружается следующая страница.
 */

import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useFlipAnimation } from '@/hooks/useFlipAnimation'
import NewsCard from './NewsCard'
import NewsCarousel from './NewsCarousel'
import NewsDetailModal from './NewsDetailModal'

interface NewsArticle {
  id: string
  title_ru: string | null
  title_original?: string | null
  summary_ru?: string | null
  summary_original?: string | null
  source: string
  published_at: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  sentiment_score?: number
  sentiment_source?: string
  tag?: string
  url?: string
  source_count?: number
  all_sources?: string[]
  matched_tags?: string[]
  tag_impact?: { tag: string; score: number; reasoning: string }[]
}

interface GlobalNewsPage {
  articles: NewsArticle[]
  page: number
  hasMore: boolean
}

async function fetchGlobalNews({ pageParam = 1 }): Promise<GlobalNewsPage> {
  const data = await api.get(`/news/global?limit=50&page=${pageParam}`)
  return {
    articles: data.articles || [],
    page: pageParam,
    hasMore: !!data.hasMore,
  }
}

export default function GlobalNewsCarousel() {
  const { portfolio } = useAuth()
  const tagsMap = useMemo(() => new Map(portfolio.map((t: any) => [t.tag_id, t.tag_name])), [portfolio])

  const {
    data,
    isLoading,
    isError,
    error,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['globalNews'],
    queryFn: fetchGlobalNews,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
    retry: 1,
  })

  const articles = useMemo(() => data?.pages.flatMap((page) => page.articles) || [], [data])

  // DOM-реф трека карусели — пробрасывается в NewsCarousel через forwardRef
  const trackRef = useRef<HTMLDivElement>(null)

  // FLIP + Frost Appear анимация (TZ-001)
  const { newIds } = useFlipAnimation(articles, trackRef)

  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null)

  const handleCardClick = useCallback((article: NewsArticle) => {
    setSelectedNewsId(article.id)
  }, [])

  // Sentinel для бесконечного скролла
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage) return

    // root — родительский скролл-контейнер карусели
    const root = sentinel.parentElement
    if (!root) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { root, threshold: 0, rootMargin: '0px 200px 0px 0px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Loading
  if (isLoading) {
    return (
      <NewsCarousel title="Общая лента">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="w-[220px] h-[140px] rounded-xl bg-[#161616] animate-pulse flex-shrink-0" />
        ))}
      </NewsCarousel>
    )
  }

  // Error
  if (isError) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-4">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-2xl font-semibold text-text-muted">Общая лента</h2>
        </div>
        <p className="text-[11px] text-red-400">
          Ошибка загрузки: {(error as Error)?.message || 'неизвестная ошибка'}
        </p>
      </div>
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
      ref={trackRef}
      title="Общая лента"
      subtitle="все источники"
      count={articles.length}
      accentColor="#6B7280"
    >
      {articles.map((article, i) => {
        const isNew = newIds.has(article.id)
        return (
          <div
            key={article.id}
            data-flip-id={article.id}
            onClick={() => handleCardClick(article)}
            className={`cursor-pointer flex-shrink-0 ${
              isNew ? 'news-appear-wrapper' : 'news-visible-wrapper'
            }`}
          >
            {isNew && <div className="news-frost-layer" />}
            <NewsCard article={article} index={i} tagsMap={tagsMap} />
          </div>
        )
      })}

      {/* Sentinel + loader для бесконечного скролла */}
      {hasNextPage && (
        <div
          ref={sentinelRef}
          className="flex-shrink-0 flex items-center justify-center w-[120px] h-[140px]"
        >
          {isFetchingNextPage ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
              <span className="text-[10px] text-text-muted">загрузка...</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/5" />
          )}
        </div>
      )}

      {selectedNewsId && <NewsDetailModal newsId={selectedNewsId} onClose={() => setSelectedNewsId(null)} />}
    </NewsCarousel>
  )
}
