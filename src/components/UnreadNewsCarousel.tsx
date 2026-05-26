/**
 * =============================================================================
 * PULSE — Карусель "Это вы ещё не видели"
 * =============================================================================
 *
 * Показывает ТОЛЬКО непрочитанные новости пользователя.
 * Располагается первой на главной странице.
 *
 * Логика:
 *   1. Загружает новости: GET /api/news (без ?all — только непрочитанные)
 *   2. Отображает в горизонтальном скролле
 *   3. При клике → отмечает прочитанной (POST /api/news/:id/read)
 *   4. При прокрутке в viewport → тоже отмечает прочитанной
 *   5. Если нет непрочитанных → показывает "Всё прочитано!"
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
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

export default function UnreadNewsCarousel() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const readSet = useRef<Set<string>>(new Set())  // Трекинг: какие уже отметили

  // ─── Загрузка непрочитанных новостей ──────────────────────────────────
  useEffect(() => {
    setLoading(true)
    api.get('/news?limit=20')
      .then(data => {
        // Преобразуем matched_tags → tag для отображения
        const mapped = (data.articles || []).map((a: any) => ({
          ...a,
          tag: a.matched_tags?.[0] || a.tag,
        }))
        setArticles(mapped)
      })
      .catch(() => setArticles([]))
      .finally(() => setLoading(false))
  }, [])

  // ─── Отметить как прочитанную (с дебаунсом) ───────────────────────────
  const markAsRead = useCallback((newsId: string) => {
    if (readSet.current.has(newsId)) return  // Уже отмечали
    readSet.current.add(newsId)
    // Отправляем на бэкенд (не ждём ответа — fire and forget)
    api.post(`/news/${newsId}/read`, {}).catch(() => {})
    // Убираем из локального state через 2 сек (чтобы пользователь успел увидеть)
    setTimeout(() => {
      setArticles(prev => prev.filter(a => a.id !== newsId))
    }, 2000)
  }, [])

  // ─── IntersectionObserver: отслеживаем прокрутку в viewport ──────────
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
      { threshold: 0.5 }  // 50% видимости = "прочитано"
    )

    return () => observerRef.current?.disconnect()
  }, [markAsRead])

  // Подключаем observer к карточкам
  useEffect(() => {
    cardRefs.current.forEach((el) => {
      observerRef.current?.observe(el)
    })
  }, [articles])

  const setCardRef = (id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el)
    else cardRefs.current.delete(id)
  }

  // ─── Состояния: загрузка / пусто / данные ─────────────────────────────
  if (loading) {
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
      {/* Заголовок */}
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

      {/* Горизонтальная карусель */}
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
