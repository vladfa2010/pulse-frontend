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
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import NewsCard from './NewsCard'
import CascadeStackCard from './CascadeStackCard'
import NewsCarousel from './NewsCarousel'
import { CheckCircle2, CheckCheck, Loader2 } from 'lucide-react'
import { useNewsStream } from '@/hooks/useNewsStream'
import { useAmbientStyles } from '@/hooks/useAmbientStyles'
import { dedupById } from '@/lib/dedup'
import type { NewsArticle } from '@/types/news'

interface HistoryPage {
  articles: NewsArticle[]
  page: number
  hasMore: boolean
}

// ТЗ-177: пагинация + бесконечная догрузка, как в AllNewsCarousel
async function fetchUnreadNews({ pageParam = 1 }): Promise<HistoryPage> {
  const data = await api.get(`/news?limit=20&page=${pageParam}`)
  return {
    articles: data.articles || [],
    page: pageParam,
    hasMore: !!data.hasMore,
  }
}

async function markNewsAsRead(newsId: string): Promise<void> {
  await api.post(`/news/${newsId}/read`, {})
}

export default function UnreadNewsCarousel() {
  const { portfolio, isLoading: isAuthLoading } = useAuth()
  const tagsMap = useMemo(() => new Map(portfolio.map((t: any) => [t.tag_id, t.tag_name])), [portfolio])
  const queryClient = useQueryClient()
  const readSet = useRef<Set<string>>(new Set())
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set())
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set())
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const removalTimers = useRef<Map<string, number>>(new Map())

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['unreadNews'],
    queryFn: fetchUnreadNews,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Плоский дедуплицированный список всех загруженных страниц (ТЗ-177).
  // Именно он — источник истины для auto-read, snapshot'ов и рендера.
  const allArticles = useMemo(
    () => dedupById(data?.pages.flatMap((p) => p.articles) || []),
    [data]
  )

  // ТЗ-177: реальный счётчик непрочитанных для бейджа «Прочитать всё».
  // Ключ unreadNewsCount, а не unreadCount — последний занят UnreadCountContext
  // (SSE-бейдж вкладки), счётчики разные и независимые.
  const { data: unreadTotal } = useQuery({
    queryKey: ['unreadNewsCount'],
    queryFn: async () => {
      const data = await api.get('/news/unread-count')
      return data.count as number
    },
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Отслеживаем новые статьи для анимации появления
  const articles = useNewsStream(allArticles)

  // Стабильные ambient-стили для карточек Carousel 1
  const ambientStyles = useAmbientStyles(articles)

  // ─── ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ — карточка исчезает через 60 сек ──────
  const REMOVE_DELAY = 180_000 // 3 минуты перед удалением

  const markAsRead = useCallback((newsId: string) => {
    if (readSet.current.has(newsId)) return
    readSet.current.add(newsId)

    // Оптимистичный декремент счётчика (ТЗ-177): инвалидация на карточку запрещена —
    // auto-read стреляет на каждую карточку, полный пересчёт только при read-all.
    queryClient.setQueryData(['unreadNewsCount'], (old: number | undefined) =>
      old == null ? old : Math.max(0, old - 1)
    )

    const article = allArticles.find(a => a.id === newsId)
    if (!article) return

    // Шаг 1: Помечаем как "будет удалена" — полупрозрачная + индикатор
    setMarkedIds(prev => new Set(prev).add(newsId))

    // Шаг 2: Через 60 сек — запускаем fade-out и удаляем
    const removeTimer = window.setTimeout(() => {
      // Fade-out анимация
      setFadingIds(prev => new Set(prev).add(newsId))

      // Удаляем из 1-й карусели после fade-out (1125ms)
      setTimeout(() => {
        // ТЗ-177: кэх страничный — фильтруем карточку в каждой загруженной странице
        queryClient.setQueryData(['unreadNews'], (old: { pages: HistoryPage[]; pageParams: number[] } | undefined) => {
          if (!old) return { pages: [], pageParams: [] }
          return {
            ...old,
            pages: old.pages.map(p => ({ ...p, articles: p.articles.filter(a => a.id !== newsId) })),
          }
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
  }, [allArticles, queryClient])

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
  }, [allArticles, markAsRead])

  // ТЗ-177: sentinel бесконечной догрузки — по образцу AllNewsCarousel
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
    if (isMarkingAll || allArticles.length === 0) return
    setIsMarkingAll(true)

    const snapshot = allArticles

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
      queryClient.invalidateQueries({ queryKey: ['unreadNewsCount'] })
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
      // ТЗ-177: страничная структура + счётчик в ноль
      queryClient.setQueryData(['unreadNews'], { pages: [], pageParams: [] })
      queryClient.setQueryData(['unreadNewsCount'], 0)
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
  }, [isMarkingAll, allArticles, queryClient])

  // ТЗ-46/47: сохраняем сегодняшнее поведение — юзер без тегов не видит секцию.
  // Гард строго после всех хуков, иначе React #310.
  if (!isAuthLoading && portfolio.length === 0) return null

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
      hideArrowsOnMobile
      headerAction={
        <button
          onClick={markAllAsRead}
          disabled={isMarkingAll}
          className="flex items-center gap-1.5 h-7 sm:h-6 px-3 sm:px-2.5 mr-0 sm:mr-2 rounded-full border transition-colors
            whitespace-nowrap flex-shrink-0
            bg-[#00D4FF]/10 hover:bg-[#00D4FF]/25 border-[#00D4FF]/30 disabled:opacity-50"
          title="Отметить все новости прочитанными"
        >
          <span className="inline-flex scale-125 sm:scale-100 origin-center">
            {isMarkingAll
              ? <Loader2 size={11} className="text-[#00D4FF] animate-spin" />
              : <CheckCheck size={11} className="text-[#00D4FF]" />}
          </span>
          <span className="text-xs sm:text-[11px] font-medium text-[#00D4FF]">Прочитать всё</span>
          {!isMarkingAll && unreadTotal != null && unreadTotal > 0 && (
            <span className="min-w-[18px] text-center px-2 sm:px-1.5 rounded-full bg-[#00D4FF]/20 text-[11px] sm:text-[10px] font-semibold text-[#00D4FF] leading-4">
              {unreadTotal}
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
            {/* ТЗ-100: обёртка каскада. Landscape: слои НЕ рисуем (хвост ломает
                сетку 16:9), меняется только назначение клика для первоисточника. */}
            <CascadeStackCard
              flipId={item.id}
              article={item.data}
              variant="landscape"
              onCardClick={() => handleCardClick(item)}
            >
              <NewsCard article={item.data} index={i} tagsMap={tagsMap} variant="landscape" ambientStyle={ambientStyles[i]} showChart={false} />
            </CascadeStackCard>
          </div>
        )
      })}
      {/* ТЗ-177: sentinel + loader бесконечной догрузки (как «Вся лента») */}
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
