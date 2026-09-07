/**
 * PULSE — Демо-лента с графиками (гостевая главная, ТЗ-59)
 *
 * Показываем гостю ленту демо-аккаунта (GET /api/public/demo-feed) с
 * графиками реакции рынка (showChart — график запрашивается только когда
 * карточка во вьюпорте). Структура — копия GlobalNewsCarousel (infinite
 * scroll по sentinel, dedupById, оболочка NewsCarousel), отличия:
 * эндпоинт /public/demo-feed, tagsMap из /public/demo-tags, заголовок
 * «Демо-лента», FLIP-анимация не подключена (лента статична между
 * кэш-инвалидациями). Ошибка/пусто → ничего не рендерим.
 */

import { useEffect, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { useInfiniteQuery } from '@tanstack/react-query'
import NewsCard from '@/components/NewsCard'
import NewsCarousel from '@/components/NewsCarousel'
import { dedupById } from '@/lib/dedup'
import type { NewsArticle } from '@/types/news'

interface DemoFeedPage {
  articles: NewsArticle[]
  page: number
  hasMore: boolean
}

async function fetchDemoFeed({ pageParam = 1 }): Promise<DemoFeedPage> {
  const data = await api.get(`/public/demo-feed?limit=50&page=${pageParam}`)
  return {
    articles: data.articles || [],
    page: pageParam,
    hasMore: !!data.hasMore,
  }
}

export default function DemoFeedCarousel() {
  // tagsMap (tag_id → tag_name) из демо-тегов — для подписей тегов в карточках
  const tagsMap = useMemo(() => new Map<string, string>(), [])
  useEffect(() => {
    let cancelled = false
    api.get('/public/demo-tags')
      .then((data: any) => {
        if (cancelled || !Array.isArray(data?.tags)) return
        for (const t of data.tags) tagsMap.set(t.tag_id, t.tag_name)
      })
      .catch(() => { /* подписи тегов не критичны */ })
    return () => { cancelled = true }
  }, [tagsMap])

  const {
    data,
    isError,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['demoFeed'],
    queryFn: fetchDemoFeed,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 30 * 1000,
    refetchOnMount: false,
    retry: 1,
  })

  const articles = useMemo(() => dedupById(data?.pages.flatMap((page) => page.articles) || []), [data])

  const location = useLocation()
  const navigate = useNavigate()

  // Клик → детальная страница новости (публичная, /api/news/:id без auth)
  const handleCardClick = (article: NewsArticle) => {
    navigate(`/news/${article.slug}`, { state: { background: location } })
  }

  // Sentinel для бесконечного скролла
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage) return

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

  // Ошибка или пусто → блок скрыт (гостю empty-state ни о чём)
  if (isError || articles.length === 0) return null

  return (
    <NewsCarousel
      title="Демо-лента"
      subtitle="теги эталонной подборки · графики живые"
      count={articles.length}
      accentColor="#00D4FF"
    >
      {articles.map((article, i) => (
        <div
          key={article.id}
          onClick={() => handleCardClick(article)}
          className="cursor-pointer flex-shrink-0"
        >
          <NewsCard article={article} index={i} tagsMap={tagsMap} showChart={true} />
        </div>
      ))}

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
    </NewsCarousel>
  )
}
