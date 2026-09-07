/**
 * PULSE — Демо-лента с графиками (гостевая главная, ТЗ-59, кэш — ТЗ-60)
 *
 * Показываем гостю ленту демо-аккаунта (GET /api/public/demo-feed) с
 * графиками реакции рынка (showChart — график запрашивается только когда
 * карточка во вьюпорте). Оболочка NewsCarousel, один запрос без пагинации
 * (ТЗ-60: бэкенд игнорирует query-параметры, ответ кэшируется одним
 * ключом — бесконечного скролла нет). tagsMap (tag_id → tag_name) из
 * /api/public/demo-tags для подписей тегов в карточках.
 * Ошибка/пусто → ничего не рендерим.
 */

import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import NewsCard from '@/components/NewsCard'
import NewsCarousel from '@/components/NewsCarousel'
import type { NewsArticle } from '@/types/news'

interface DemoFeedResponse {
  articles: NewsArticle[]
  page: number
  hasMore: boolean
}

async function fetchDemoFeed(): Promise<DemoFeedResponse> {
  const data = await api.get('/public/demo-feed')
  return {
    articles: data.articles || [],
    page: 1,
    hasMore: false,
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

  const { data, isError } = useQuery({
    queryKey: ['demoFeed'],
    queryFn: fetchDemoFeed,
    staleTime: 30 * 1000,
    refetchOnMount: false,
    retry: 1,
  })

  const articles = useMemo(() => data?.articles || [], [data])

  const location = useLocation()
  const navigate = useNavigate()

  // Клик → детальная страница новости (публичная, /api/news/:id без auth)
  const handleCardClick = (article: NewsArticle) => {
    navigate(`/news/${article.slug}`, { state: { background: location } })
  }

  // Ошибка, пусто или ещё грузится → блок скрыт/не рендерим (гостю
  // empty-state и скелетоны ни о чём)
  if (isError || !data || articles.length === 0) return null

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
    </NewsCarousel>
  )
}
