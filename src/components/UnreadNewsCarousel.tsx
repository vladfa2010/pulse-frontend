/**
 * =============================================================================
 * PULSE — Карусель "Это вы ещё не видели" (React Query)
 * =============================================================================
 *
 * ЛОГИКА ПРОЧТЕНИЯ:
 *   1. Прокрутка мимо → НЕ помечает прочитанной
 *   2. Клик по карточке → открывает URL + помечает прочитанной
 *   3. Кнопка "✓" → явно помечает прочитанной
 *   4. Карточка 2+ сек в центре экрана → авто-прочтение
 *
 * Новость исчезает из этой карусели и появляется в "Вся лента" (история).
 */

import { useCallback, useRef, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import NewsCard from './NewsCard'
import { Eye, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'

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
  const [justRead, setJustRead] = useState<string | null>(null)

  // React Query: загрузка с кэшированием и автообновлением
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['unreadNews'],
    queryFn: fetchUnreadNews,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // React Query: мутация — отметить прочитанной
  const markReadMutation = useMutation({
    mutationFn: markNewsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unreadNews'] })
      queryClient.invalidateQueries({ queryKey: ['historyNews'] })
    },
  })

  const markAsRead = useCallback((newsId: string) => {
    if (readSet.current.has(newsId)) return
    readSet.current.add(newsId)
    setJustRead(newsId)
    markReadMutation.mutate(newsId)
    // Убираем анимацию через 500ms
    setTimeout(() => setJustRead(null), 500)
  }, [markReadMutation])

  // ─── Auto-read: 2+ секунд в центре экрана ────────────────────────────
  const visibilityTimers = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const newsId = entry.target.getAttribute('data-news-id')
          if (!newsId) return

          if (entry.isIntersecting && entry.intersectionRatio >= 0.8) {
            // Карточка на 80%+ видна — запускаем таймер
            if (!visibilityTimers.current.has(newsId)) {
              const timer = window.setTimeout(() => {
                markAsRead(newsId)
                visibilityTimers.current.delete(newsId)
              }, 2000) // 2 секунды
              visibilityTimers.current.set(newsId, timer)
            }
          } else {
            // Карточка ушла из вида — отменяем таймер
            const timer = visibilityTimers.current.get(newsId)
            if (timer) {
              clearTimeout(timer)
              visibilityTimers.current.delete(newsId)
            }
          }
        })
      },
      { threshold: [0, 0.5, 0.8, 1.0] }
    )

    cardRefs.current.forEach((el) => observer.observe(el))
    return () => {
      observer.disconnect()
      visibilityTimers.current.forEach(t => clearTimeout(t))
      visibilityTimers.current.clear()
    }
  }, [articles, markAsRead])

  // ─── Клик: открыть URL + прочитать ────────────────────────────────────
  const handleCardClick = useCallback((article: NewsArticle) => {
    // Открываем URL в новой вкладке
    if (article.url) {
      window.open(article.url, '_blank', 'noopener,noreferrer')
    }
    // Помечаем прочитанной
    markAsRead(article.id)
  }, [markAsRead])

  // ─── Кнопка: явно пометить прочитанной ────────────────────────────────
  const handleMarkRead = useCallback((e: React.MouseEvent, newsId: string) => {
    e.stopPropagation() // Не открывать URL
    markAsRead(newsId)
  }, [markAsRead])

  // Refs для observer
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
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
        <span className="text-[10px] text-text-muted">клик = открыть + прочитать</span>
      </motion.div>

      <div className="flex gap-4 overflow-x-auto px-6 pb-2 -mx-2 snap-x">
        {articles.map((article, i) => (
          <div
            key={article.id}
            ref={el => setCardRef(article.id, el)}
            data-news-id={article.id}
            className={`relative cursor-pointer transition-all duration-300 ${
              justRead === article.id ? 'opacity-30 scale-95' : 'opacity-100'
            }`}
          >
            {/* Кнопка "Прочитано" */}
            <button
              onClick={(e) => handleMarkRead(e, article.id)}
              className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-[#00D4FF]/20 
                         hover:bg-[#00D4FF]/40 flex items-center justify-center
                         transition-colors"
              title="Отметить прочитанной"
            >
              <CheckCircle2 size={14} className="text-[#00D4FF]" />
            </button>

            {/* Карточка */}
            <div onClick={() => handleCardClick(article)}>
              <NewsCard article={article} index={i} tagLabel={article.tag} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
