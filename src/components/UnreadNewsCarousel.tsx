/**
 * =============================================================================
 * PULSE — Карусель "Это вы ещё не видели" (React Query)
 * =============================================================================
 *
 * Task 5: Переписано на React Query:
 *   - useQuery — кэширование, dedup, background refetch
 *   - useMutation — отметка прочитанной + invalidate кэша
 *   - Автообновление каждые 2 минуты (refetchInterval)
 */

import { useCallback, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import NewsCard from './NewsCard'
import { Eye } from 'lucide-react'
import { motion } from 'framer-motion'

interface NewsArticle {
  id: string
  title_ru: string
  source: string
  published_at: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  tag?: string
}

// ─── Загрузка непрочитанных новостей ────────────────────────────────────
async function fetchUnreadNews(): Promise<NewsArticle[]> {
  const data = await api.get('/news?limit=20')
  return (data.articles || []).map((a: any) => ({
    ...a,
    tag: a.matched_tags?.[0] || a.tag,
  }))
}

// ─── Отметить как прочитанную ───────────────────────────────────────────
async function markNewsAsRead(newsId: string): Promise<void> {
  await api.post(`/news/${newsId}/read`, {})
}

export default function UnreadNewsCarousel() {
  const queryClient = useQueryClient()
  const readSet = useRef<Set<string>>(new Set())

  // React Query: загрузка с кэшированием и автообновлением
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['unreadNews'],
    queryFn: fetchUnreadNews,
    staleTime: 2 * 60 * 1000,     // 2 мин — данные свежие
    refetchInterval: 2 * 60 * 1000, // Обновляем каждые 2 минуты
    refetchOnWindowFocus: false,
  })

  // React Query: мутация — отметить прочитанной
  const markReadMutation = useMutation({
    mutationFn: markNewsAsRead,
    onSuccess: () => {
      // Инвалидируем кэш → при следующем fetch получим обновлённый список
      queryClient.invalidateQueries({ queryKey: ['unreadNews'] })
    },
  })

  const markAsRead = useCallback((newsId: string) => {
    if (readSet.current.has(newsId)) return
    readSet.current.add(newsId)
    markReadMutation.mutate(newsId)
  }, [markReadMutation])

  // IntersectionObserver: отслеживаем прокрутку в viewport
  const observerRef = useRef<IntersectionObserver | null>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const newsId = entry.target.getAttribute('data-news-id')
            if (newsId) markAsRead(newsId)
          }
        })
      },
      { threshold: 0.5 }
    )
    return () => observerRef.current?.disconnect()
  }, [markAsRead])

  useEffect(() => {
    cardRefs.current.forEach((el) => observerRef.current?.observe(el))
  }, [articles])

  const setCardRef = (id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el)
    else cardRefs.current.delete(id)
  }

  // ─── Состояния: загрузка / пусто / данные ─────────────────────────────
  if (isLoading) {
    return (
      <section className="w-full py-6">
        <div className="flex items-center gap-2 px-6 mb-4">
          <Eye size={16} className="text-[#00D4FF]" />
          <h2 className="text-sm font-semibold text-[#00D4FF] uppercase tracking-wider">
            Это вы ещё не видели
          </h2>
        </div>
        <div className="flex gap-4 overflow-x-auto px-6 pb-2 snap-x">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-[280px] h-[200px] rounded-2xl bg-[#161616] animate-pulse flex-shrink-0" />
          ))}
        </div>
      </section>
    )
  }

  if (articles.length === 0) {
    return (
      <section className="w-full py-6">
        <div className="flex items-center gap-2 px-6 mb-2">
          <Eye size={16} className="text-emerald-400" />
          <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">
            Всё прочитано!
          </h2>
        </div>
        <p className="px-6 text-xs text-text-muted">
          Новые новости появятся после следующего обновления RSS
        </p>
      </section>
    )
  }

  return (
    <section className="w-full py-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between px-6 mb-4"
      >
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-[#00D4FF]" />
          <h2 className="text-sm font-semibold text-[#00D4FF] uppercase tracking-wider">
            Это вы ещё не видели
          </h2>
          <span className="text-xs text-text-muted ml-2">({articles.length})</span>
        </div>
      </motion.div>

      <div className="flex gap-4 overflow-x-auto px-6 pb-2 -mx-2 snap-x">
        {articles.map((article, i) => (
          <div
            key={article.id}
            ref={el => setCardRef(article.id, el)}
            data-news-id={article.id}
            onClick={() => markAsRead(article.id)}
            className="cursor-pointer"
          >
            <NewsCard article={article} index={i} tagLabel={article.tag} />
          </div>
        ))}
      </div>
    </section>
  )
}
