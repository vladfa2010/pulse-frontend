/**
 * PULSE — Карусель "Это вы ещё не видели" с анимацией новых карточек
 *
 * Новые карточки появляются с плавной анимацией (fade-in + slide),
 * остальные сдвигаются без резких движений.
 */

import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import NewsCard from './NewsCard'
import NewsCarousel from './NewsCarousel'
import { CheckCircle2, CheckCheck, Loader2 } from 'lucide-react'
import { useNewsStream } from '@/hooks/useNewsStream'
import { useAmbientStyles } from '@/hooks/useAmbientStyles'
import type { NewsArticle } from '@/types/news'

interface HistoryPage {
  articles: NewsArticle[]
  page: number
  hasMore: boolean
}

async function fetchUnreadNews(): Promise<NewsArticle[]> {
  const data = await api.get('/news?limit=20')
  return data.articles || []
}

async function markNewsAsRead(newsId: string): Promise<void> {
  await api.post(`/news/${newsId}/read`, {})
}

export default function UnreadNewsCarousel() {
  const { portfolio } = useAuth()
  const tagsMap = useMemo(() => new Map(portfolio.map((t: any) => [t.tag_id, t.tag_name])), [portfolio])
  const queryClient = useQueryClient()
  const readSet = useRef<Set<string>>(new Set())
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set())
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set())
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const removalTimers = useRef<Map<string, number>>(new Map())

  const { data: rawArticles = [], isLoading } = useQuery({
    queryKey: ['unreadNews'],
    queryFn: fetchUnreadNews,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Отслеживаем новые статьи для анимации появления
  const articles = useNewsStream(rawArticles)

  // Стабильные ambient-стили для карточек Carousel 1
  const ambientStyles = useAmbientStyles(articles)

  // ─── ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ — карточка исчезает через 60 сек ──────
  const REMOVE_DELAY = 180_000 // 3 минуты перед удалением

  const markAsRead = useCallback((newsId: string) => {
    if (readSet.current.has(newsId)) return
    readSet.current.add(newsId)

    const article = rawArticles.find(a => a.id === newsId)
    if (!article) return

    // Шаг 1: Помечаем как "будет удалена" — полупрозрачная + индикатор
    setMarkedIds(prev => new Set(prev).add(newsId))

    // Шаг 2: Через 60 сек — запускаем fade-out и удаляем
    const removeTimer = window.setTimeout(() => {
      // Fade-out анимация
      setFadingIds(prev => new Set(prev).add(newsId))

      // Удаляем из 1-й карусели после fade-out (1125ms)
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
        setMarkedIds(prev => {
          const next = new Set(prev)
          next.delete(newsId)
          return next
        })
      }, 1125)
    }, REMOVE_DELAY)

    removalTimers.current.set(newsId, removeTimer)

    // Шаг 3: Мгновенно добавляем во 2-ю карусель
    queryClient.setQueryData(['historyNews'], (old: { pages: HistoryPage[]; pageParams: number[] } | undefined) => {
      if (!old || !old.pages || old.pages.length === 0) {
        return {
          pages: [{ articles: [article], page: 1, hasMore: false }],
          pageParams: [1],
        }
      }
      const firstPage = old.pages[0]
      if (firstPage.articles.some(a => a.id === newsId)) return old
      return {
        ...old,
        pages: [
          { ...firstPage, articles: [article, ...firstPage.articles] },
          ...old.pages.slice(1),
        ],
      }
    })

    // Шаг 4: Отправляем на бэкенд
    markNewsAsRead(newsId).catch(() => {})
  }, [rawArticles, queryClient])

  // Auto-read: 2s at 80%+ visibility
  const visibilityTimers = useRef<Map<string, number>>(new Map())
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Cleanup removal timers on unmount
  useEffect(() => {
    return () => {
      removalTimers.current.forEach(t => clearTimeout(t))
    }
  }, [])

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

  const location = useLocation()
  const navigate = useNavigate()

  const handleCardClick = useCallback((item: { id: string; data: NewsArticle }) => {
    navigate(`/news/${item.data.slug}`, { state: { background: location } })
    markAsRead(item.id)
  }, [markAsRead, navigate, location])

  const handleMarkRead = useCallback((e: React.MouseEvent, item: { id: string }) => {
    e.stopPropagation()
    markAsRead(item.id)
  }, [markAsRead])

  // ─── Прочитать всё — массовая отметка через POST /news/read-all ─────
  const CASCADE_STEP = 113
  const FADE_DURATION = 1125

  const markAllAsRead = useCallback(async () => {
    if (isMarkingAll || rawArticles.length === 0) return
    setIsMarkingAll(true)

    const snapshot = rawArticles

    // 1. Гасим все таймеры — иначе removal-таймеры стрельнут во время каскада
    removalTimers.current.forEach(t => clearTimeout(t))
    removalTimers.current.clear()
    visibilityTimers.current.forEach(t => clearTimeout(t))
    visibilityTimers.current.clear()

    // 2. id → readSet, все карточки → marked
    snapshot.forEach(a => readSet.current.add(a.id))
    setMarkedIds(new Set(snapshot.map(a => a.id)))

    // 3. Запрос на бэкенд — сразу, параллельно анимации
    const request = api.post('/news/read-all', {}).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['unreadNews'] })
      queryClient.invalidateQueries({ queryKey: ['historyNews'] })
    })

    // 4. Каскад fade-out со stagger
    snapshot.forEach((a, i) => {
      window.setTimeout(() => {
        setFadingIds(prev => new Set(prev).add(a.id))
      }, CASCADE_STEP * i)
    })

    // 5. После каскада — очищаем карусель 1 и переносим всё во 2-ю
    const totalDuration = CASCADE_STEP * (snapshot.length - 1) + FADE_DURATION
    window.setTimeout(() => {
      queryClient.setQueryData(['unreadNews'], [])
      queryClient.setQueryData(['historyNews'], (old: { pages: HistoryPage[]; pageParams: number[] } | undefined) => {
        if (!old || !old.pages || old.pages.length === 0) {
          return { pages: [{ articles: snapshot, page: 1, hasMore: false }], pageParams: [1] }
        }
        const firstPage = old.pages[0]
        const existing = new Set(firstPage.articles.map(a => a.id))
        const fresh = snapshot.filter(a => !existing.has(a.id))
        return {
          ...old,
          pages: [{ ...firstPage, articles: [...fresh, ...firstPage.articles] }, ...old.pages.slice(1)],
        }
      })
      setMarkedIds(new Set())
      setFadingIds(new Set())
    }, totalDuration + 100)

    await request
    setIsMarkingAll(false)
  }, [isMarkingAll, rawArticles, queryClient])

  // ─── Loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <NewsCarousel title="Это вы ещё не видели">
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
          <h2 className="text-2xl font-semibold text-emerald-400">Всё прочитано!</h2>
        </div>
        <p className="text-[11px] text-text-muted">Новые новости появятся после следующего обновления RSS</p>
      </div>
    )
  }

  // ─── Cards с анимацией появления ─────────────────────────────────────
  return (
    <NewsCarousel
      title="Это вы ещё не видели"
      accentColor="#6B7280"
      headerAction={
        <button
          onClick={markAllAsRead}
          disabled={isMarkingAll}
          className="flex items-center gap-1.5 h-6 px-2.5 mr-2 rounded-full border transition-colors
            bg-[#00D4FF]/10 hover:bg-[#00D4FF]/25 border-[#00D4FF]/30 disabled:opacity-50"
          title="Отметить все новости прочитанными"
        >
          {isMarkingAll
            ? <Loader2 size={11} className="text-[#00D4FF] animate-spin" />
            : <CheckCheck size={11} className="text-[#00D4FF]" />}
          <span className="text-[11px] font-medium text-[#00D4FF]">Прочитать всё</span>
          {!isMarkingAll && (
            <span className="min-w-[18px] text-center px-1.5 rounded-full bg-[#00D4FF]/20 text-[10px] font-semibold text-[#00D4FF] leading-4">
              {articles.length}
            </span>
          )}
        </button>
      }
    >
      {articles.map((item, i) => {
        const isFading = fadingIds.has(item.id)
        const isMarked = markedIds.has(item.id)
        return (
          <div
            key={item.id}
            ref={el => setCardRef(item.id, el)}
            data-news-id={item.id}
            className={`relative flex-shrink-0 carousel-item ${item.isNew ? 'is-new' : ''}`}
            style={{
              opacity: isFading ? 0 : isMarked ? 0.5 : 1,
              transform: isFading
                ? 'scale(0.9) translateX(-30px)'
                : item.isNew
                  ? 'translateY(0) scale(1)'
                  : 'translateY(0) scale(1)',
              transition: isFading
                ? 'opacity 1125ms ease, transform 1125ms ease'
                : isMarked
                  ? 'opacity 750ms ease'
                  : item.isNew
                    ? 'opacity 500ms ease, transform 500ms cubic-bezier(0.16, 1, 0.3, 1)'
                    : 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: isFading ? 'none' : 'auto',
            }}
          >
            {/* Зелёная рамка для отмеченных карточек */}
            {isMarked && !isFading && (
              <div
                className="absolute -inset-[1px] rounded-xl pointer-events-none z-30"
                style={{
                  border: '2px solid rgba(52, 211, 153, 0.4)',
                  boxShadow: '0 0 12px rgba(52, 211, 153, 0.15), inset 0 0 8px rgba(52, 211, 153, 0.05)',
                }}
              />
            )}
            <button
              onClick={(e) => handleMarkRead(e, item)}
              className={`absolute -top-1.5 -right-1.5 z-20 w-6 h-6 rounded-full flex items-center justify-center transition-colors
                ${isMarked ? 'bg-emerald-500/30' : 'bg-[#00D4FF]/20 hover:bg-[#00D4FF]/50'}`}
              title={isMarked ? 'Прочитано (исчезнет через 3 мин)' : 'Отметить прочитанной'}
            >
              <CheckCircle2 size={12} className={isMarked ? 'text-emerald-400' : 'text-[#00D4FF]'} />
            </button>
            <div onClick={() => handleCardClick(item)} className="cursor-pointer">
              <NewsCard article={item.data} index={i} tagsMap={tagsMap} variant="landscape" ambientStyle={ambientStyles[i]} />
            </div>
          </div>
        )
      })}
    </NewsCarousel>
  )
}
// rebuild v4.8 1779916554
