/**
 * PULSE — Карусель "Это вы ещё не видели"
 *
 * ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ:
 *   При прочтении новость мгновенно:
 *   1. Удаляется из кэша unreadNews (fade out анимация)
 *   2. Добавляется в кэш historyNews (появляется во 2-й карусели)
 *   3. Отправляется POST /api/news/:id/read
 *   БЕЗ перезагрузки страницы, БЕЗ рефетча.
 */

import { useCallback, useRef, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import NewsCard from './NewsCard'
import NewsCarousel from './NewsCarousel'
import { Eye, CheckCircle2 } from 'lucide-react'

interface NewsArticle {
  id: string
  title_ru: string
  source: string
  published_at: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  sentiment_source?: string
  tag?: string
  url?: string
  source_count?: number
  all_sources?: string[]
  matched_tags?: string[]
  tag_impact?: any[]
}

async function fetchUnreadNews(): Promise<NewsArticle[]> {
  const data = await api.get('/news?limit=20')
  return (data.articles || []).map((a: any) => ({
    ...a,
    tag: a.matched_tags?.[0] || a.tag,
  }))
}

async function markNewsAsRead(newsId: string): Promise<void> {
  await api.post(`/news/${newsId}/read`, {})
}

export default function UnreadNewsCarousel() {
  const queryClient = useQueryClient()
  const readSet = useRef<Set<string>>(new Set())
  // Состояние для CSS-анимации fade out
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set())

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['unreadNews'],
    queryFn: fetchUnreadNews,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // ─── ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ — главная функция ────────────────────
  const markAsRead = useCallback((newsId: string) => {
    if (readSet.current.has(newsId)) return
    readSet.current.add(newsId)

    // Находим полную статью в текущем списке
    const article = articles.find(a => a.id === newsId)
    if (!article) return

    // Шаг 1: Запускаем CSS-анимацию fade out (визуально скрываем)
    setFadingIds(prev => new Set(prev).add(newsId))

    // Шаг 2: Через 400ms (после анимации) — удаляем из кэша unreadNews
    setTimeout(() => {
      // Удаляем из 1-й карусели
      queryClient.setQueryData(['unreadNews'], (old: NewsArticle[] | undefined) => {
        if (!old) return []
        return old.filter(a => a.id !== newsId)
      })
      // Убираем из fading
      setFadingIds(prev => {
        const next = new Set(prev)
        next.delete(newsId)
        return next
      })
    }, 400)

    // Шаг 3: Мгновенно добавляем во 2-ю карусель (history)
    queryClient.setQueryData(['historyNews'], (old: NewsArticle[] | undefined) => {
      const current = old || []
      // Не добавляем дубликат
      if (current.some(a => a.id === newsId)) return current
      return [article, ...current]
    })

    // Шаг 4: Отправляем на бэкенд (фоном)
    markNewsAsRead(newsId).catch(() => {
      // При ошибке — ничего не делаем, оптимистичное обновление остаётся
      console.warn(`[UnreadNews] Failed to mark ${newsId} as read`)
    })
  }, [articles, queryClient])

  // Auto-read: 2s at 80%+ visibility
  const visibilityTimers = useRef<Map<string, number>>(new Map())
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const newsId = entry.target.getAttribute('data-news-id')
          if (!newsId) return
          if (entry.isIntersecting && entry.intersectionRatio >= 0.8) {
            if (!visibilityTimers.current.has(newsId)) {
              const timer = window.setTimeout(() => {
                markAsRead(newsId)
                visibilityTimers.current.delete(newsId)
              }, 2000)
              visibilityTimers.current.set(newsId, timer)
            }
          } else {
            const timer = visibilityTimers.current.get(newsId)
            if (timer) { clearTimeout(timer); visibilityTimers.current.delete(newsId) }
          }
        })
      },
      { threshold: [0, 0.5, 0.8, 1.0] }
    )
    cardRefs.current.forEach(el => observer.observe(el))
    return () => {
      observer.disconnect()
      visibilityTimers.current.forEach(t => clearTimeout(t))
    }
  }, [articles, markAsRead])

  const setCardRef = (id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el)
    else cardRefs.current.delete(id)
  }

  const handleCardClick = useCallback((article: NewsArticle) => {
    if (article.url) window.open(article.url, '_blank', 'noopener,noreferrer')
    markAsRead(article.id)
  }, [markAsRead])

  const handleMarkRead = useCallback((e: React.MouseEvent, newsId: string) => {
    e.stopPropagation()
    markAsRead(newsId)
  }, [markAsRead])

  // ─── Loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <NewsCarousel title="Это вы ещё не видели" icon={<Eye size={14} />} accentColor="#00D4FF">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="w-[220px] h-[140px] rounded-xl bg-[#161616] animate-pulse flex-shrink-0" />
        ))}
      </NewsCarousel>
    )
  }

  // ─── Empty ────────────────────────────────────────────────────────────
  if (articles.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-5">
        <div className="flex items-center gap-2 mb-2">
          <Eye size={14} className="text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Всё прочитано!</h2>
        </div>
        <p className="text-[11px] text-text-muted">Новые новости появятся после следующего обновления RSS</p>
      </div>
    )
  }

  // ─── Cards с fade-out анимацией ───────────────────────────────────────
  return (
    <NewsCarousel
      title="Это вы ещё не видели"
      icon={<Eye size={14} />}
      subtitle="клик = открыть"
      count={articles.length}
      accentColor="#00D4FF"
    >
      {articles.map((article, i) => {
        const isFading = fadingIds.has(article.id)
        return (
          <div
            key={article.id}
            ref={el => setCardRef(article.id, el)}
            data-news-id={article.id}
            className="relative flex-shrink-0"
            style={{
              opacity: isFading ? 0 : 1,
              transform: isFading ? 'scale(0.9) translateX(-20px)' : 'scale(1) translateX(0)',
              transition: 'opacity 350ms ease, transform 350ms ease',
              pointerEvents: isFading ? 'none' : 'auto',
            }}
          >
            <button
              onClick={(e) => handleMarkRead(e, article.id)}
              className="absolute -top-1.5 -right-1.5 z-20 w-6 h-6 rounded-full bg-[#00D4FF]/20 
                         hover:bg-[#00D4FF]/50 flex items-center justify-center transition-colors"
              title="Отметить прочитанной"
            >
              <CheckCircle2 size={12} className="text-[#00D4FF]" />
            </button>
            <div onClick={() => handleCardClick(article)} className="cursor-pointer">
              <NewsCard article={article} index={i} tagLabel={article.tag} />
            </div>
          </div>
        )
      })}
    </NewsCarousel>
  )
}
