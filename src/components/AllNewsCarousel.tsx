/**
 * PULSE — Карусель "Вся лента" (История прочтений)
 *
 * Показывает ПРОЧИТАННЫЕ новости по тегам пользователя.
 * Новые сверху (DESC) — как в 1-й карусели, но только прочитанные.
 * Новые прочитанные новости появляются с fade-in анимацией.
 *
 * API: GET /api/news?history=true&limit=50&page=N
 * Бесконечный скролл: при приближении к концу подгружается следующая страница.
 */

import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useInfiniteQuery } from '@tanstack/react-query'
import NewsCard from './NewsCard'
import NewsCarousel from './NewsCarousel'
import NewsDetailModal from './NewsDetailModal'

interface NewsArticle {
  id: string
  title_ru: string
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
  tag_impact?: any[]
}

interface HistoryPage {
  articles: NewsArticle[]
  page: number
  hasMore: boolean
}

async function fetchHistoryNews({ pageParam = 1 }): Promise<HistoryPage> {
  const data = await api.get(`/news?history=true&limit=50&page=${pageParam}`)
  return {
    articles: data.articles || [],
    page: pageParam,
    hasMore: !!data.hasMore,
  }
}

export default function AllNewsCarousel() {
  const { portfolio } = useAuth()
  const tagsMap = useMemo(() => new Map(portfolio.map((t: any) => [t.tag_id, t.tag_name])), [portfolio])

  // Отслеживаем "новые" статьи для fade-in анимации
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const prevIdsRef = useRef<Set<string>>(new Set())

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['historyNews'],
    queryFn: fetchHistoryNews,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 2 * 60 * 1000,
  })

  const articles = useMemo(() => data?.pages.flatMap((page) => page.articles) || [], [data])

  // Detect new articles and trigger fade-in animation
  useEffect(() => {
    const currentIds = new Set(articles.map((a) => a.id))
    const newlyAdded = new Set<string>()

    for (const id of currentIds) {
      if (!prevIdsRef.current.has(id)) {
        newlyAdded.add(id)
      }
    }

    if (newlyAdded.size > 0) {
      setNewIds((prev) => new Set([...prev, ...newlyAdded]))
      // Remove from "new" after animation completes
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev)
          for (const id of newlyAdded) next.delete(id)
          return next
        })
      }, 2000)
    }

    prevIdsRef.current = currentIds
  }, [articles])

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
      <NewsCarousel title="Вся лента">
        {[1, 2, 3, 4, 5].map((i) => (
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
          <h2 className="text-2xl font-semibold text-text-muted">Вся лента</h2>
        </div>
        <p className="text-[11px] text-text-muted">История прочтений появится после просмотра новостей</p>
      </div>
    )
  }

  return (
    <NewsCarousel
      title="Вся лента"
      subtitle="история"
      count={articles.length}
      accentColor="#6B7280"
    >
      {articles.map((article, i) => {
        const isNew = newIds.has(article.id)
        return (
          <div
            key={article.id}
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
