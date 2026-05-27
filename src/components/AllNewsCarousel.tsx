/**
 * =============================================================================
 * PULSE — Карусель "Вся лента"
 * =============================================================================
 *
 * ВТОРАЯ карусель на главной. Показывает ПРОЧИТАННЫЕ новости по тегам
 * пользователя в хронологическом порядке (старые слева, новые справа).
 *
 * Это ИСТОРИЯ просмотров — пользователь может вернуться к прочитанным.
 *
 * Карусели:
 *   1. "Это вы ещё не видели" → ТОЛЬКО непрочитанные по тегам (новые сверху)
 *   2. "Вся лента" → ТОЛЬКО прочитанные по тегам (хронология ASC) ← ЭТОТ ФАЙЛ
 *   3. "Общая лента" → ВСЕ новости без фильтра тегов
 *
 * API: GET /api/news?history=true&limit=50
 */

import { useCallback, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import NewsCard from './NewsCard'
import { Newspaper } from 'lucide-react'
import { motion } from 'framer-motion'

interface NewsArticle {
  id: string
  title_ru: string
  source: string
  published_at: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  tag?: string
  source_count?: number
  all_sources?: string[]
}

// ─── Загрузка ПРОЧИТАННЫХ новостей по тегам (история) ──────────────────
async function fetchAllNews(): Promise<NewsArticle[]> {
  const data = await api.get('/news?history=true&limit=50')
  return (data.articles || [])
    .map((a: any) => ({
      ...a,
      tag: a.matched_tags?.[0] || a.tag,
    }))
    .sort((a: any, b: any) => {
      // Хронологический порядок: старые → новые (слева направо)
      return new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
    })
}

// ─── Отметить как прочитанную ───────────────────────────────────────────
async function markNewsAsRead(newsId: string): Promise<void> {
  await api.post(`/news/${newsId}/read`, {})
}

export default function AllNewsCarousel() {
  const queryClient = useQueryClient()
  const readSet = useRef<Set<string>>(new Set())

  // React Query: загрузка ПРОЧИТАННЫХ новостей (история)
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['historyNews'],
    queryFn: fetchAllNews,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Мутация: отметить прочитанной
  const markReadMutation = useMutation({
    mutationFn: markNewsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unreadNews'] })
    },
  })

  const markAsRead = useCallback((newsId: string) => {
    if (readSet.current.has(newsId)) return
    readSet.current.add(newsId)
    markReadMutation.mutate(newsId)
  }, [markReadMutation])

  // IntersectionObserver
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

  // ─── Состояния ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section className="w-full py-6">
        <div className="flex items-center gap-2 px-6 mb-4">
          <Newspaper size={16} className="text-text-muted" />
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Вся лента
          </h2>
        </div>
        <div className="flex gap-4 overflow-x-auto px-6 pb-2">
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
          <Newspaper size={16} className="text-text-muted" />
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Вся лента
          </h2>
        </div>
        <p className="px-6 text-xs text-text-muted">
          Новости появятся после следующего обновления RSS
        </p>
      </section>
    )
  }

  return (
    <section className="w-full py-6">
      {/* Заголовок */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between px-6 mb-4"
      >
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-text-muted" />
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Вся лента
          </h2>
          <span className="text-xs text-text-muted ml-2">({articles.length})</span>
        </div>
        <span className="text-[10px] text-text-muted">хронологический порядок →</span>
      </motion.div>

      {/* Горизонтальная карусель — хронологический порядок */}
      <div className="flex gap-4 overflow-x-auto px-6 pb-2 -mx-2 snap-x scrollbar-thin">
        {articles.map((article, i) => (
          <div
            key={article.id}
            ref={el => setCardRef(article.id, el)}
            data-news-id={article.id}
            onClick={() => markAsRead(article.id)}
            className="cursor-pointer flex-shrink-0"
          >
            <NewsCard article={article} index={i} tagLabel={article.tag} />
          </div>
        ))}
      </div>
    </section>
  )
}
