/**
 * PULSE — Карусель "Это вы ещё не видели" с анимацией новых карточек
 *
 * Новые карточки появляются с плавной анимацией (fade-in + slide),
 * остальные сдвигаются без резких движений.
 */

import { useCallback, useRef, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import NewsCard from './NewsCard'
import NewsCarousel from './NewsCarousel'
import { Eye, CheckCircle2 } from 'lucide-react'
import { useNewsStream } from '@/hooks/useNewsStream'

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
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set())

  const { data: rawArticles = [], isLoading } = useQuery({
    queryKey: ['unreadNews'],
    queryFn: fetchUnreadNews,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Отслеживаем новые статьи для анимации появления
  const articles = useNewsStream(rawArticles)

  // ─── ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ ──────────────────────────────────────
  const markAsRead = useCallback((newsId: string) => {
    if (readSet.current.has(newsId)) return
    readSet.current.add(newsId)

    const article = rawArticles.find(a => a.id === newsId)
    if (!article) return

    // Шаг 1: Fade out анимация
    setFadingIds(prev => new Set(prev).add(newsId))

    // Шаг 2: Удаляем из 1-й карусели через 400ms
    setTimeout(() => {
      queryClient.setQueryData(['unreadNews'], (old: NewsArticle[] | undefined) => {
        if (!old) return []
        return old.filter(a => a.id !== newsId)
      })
      setFadingIds(prev => {
        const next = new Set(prev)
        next.delete(newsId)
        return next
      })
    }, 400)

    // Шаг 3: Мгновенно добавляем во 2-ю карусель
    queryClient.setQueryData(['historyNews'], (old: NewsArticle[] | undefined) => {
      const current = old || []
      if (current.some(a => a.id === newsId)) return current
      return [article, ...current]
    })

    // Шаг 4: Отправляем на бэкенд
    markNewsAsRead(newsId).catch(() => {})
  }, [rawArticles, queryClient])

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
  }, [rawArticles, markAsRead])

  const setCardRef = (id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el)
    else cardRefs.current.delete(id)
  }

  const handleCardClick = useCallback((item: { id: string; data: NewsArticle }) => {
    if (item.data.url) window.open(item.data.url, '_blank', 'noopener,noreferrer')
    markAsRead(item.id)
  }, [markAsRead])

  const handleMarkRead = useCallback((e: React.MouseEvent, item: { id: string }) => {
    e.stopPropagation()
    markAsRead(item.id)
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

  // ─── Cards с анимацией появления ─────────────────────────────────────
  return (
    <NewsCarousel
      title="Это вы ещё не видели"
      icon={<Eye size={14} />}
      subtitle="клик = открыть"
      count={articles.length}
      accentColor="#00D4FF"
    >
      {articles.map((item, i) => {
        const isFading = fadingIds.has(item.id)
        return (
          <div
            key={item.id}
            ref={el => setCardRef(item.id, el)}
            data-news-id={item.id}
            className={`relative flex-shrink-0 carousel-item ${item.isNew ? 'is-new' : ''}`}
            style={{
              opacity: isFading ? 0 : 1,
              transform: isFading
                ? 'scale(0.9) translateX(-30px)'
                : item.isNew
                  ? 'translateY(0) scale(1)'
                  : 'translateY(0) scale(1)',
              transition: isFading
                ? 'opacity 350ms ease, transform 350ms ease'
                : item.isNew
                  ? 'opacity 500ms ease, transform 500ms cubic-bezier(0.16, 1, 0.3, 1)'
                  : 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: isFading ? 'none' : 'auto',
            }}
          >
            <button
              onClick={(e) => handleMarkRead(e, item)}
              className="absolute -top-1.5 -right-1.5 z-20 w-6 h-6 rounded-full bg-[#00D4FF]/20 
                         hover:bg-[#00D4FF]/50 flex items-center justify-center transition-colors"
              title="Отметить прочитанной"
            >
              <CheckCircle2 size={12} className="text-[#00D4FF]" />
            </button>
            <div onClick={() => handleCardClick(item)} className="cursor-pointer">
              <NewsCard article={item.data} index={i} tagLabel={item.data.tag} />
            </div>
          </div>
        )
      })}
    </NewsCarousel>
  )
}
