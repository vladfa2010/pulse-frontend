import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { NEWS_CHART_STALE_TIME } from '@/lib/newsChart'
import type { NewsArticle } from '@/types/news'

/**
 * ТЗ-3.5 — фоновый префетч графиков новостей вперёд по ленте. Best effort.
 *
 * После затухания скролла (DEBOUNCE_MS) последовательно, с паузой DELAY_MS,
 * префетчит графики для DEPTH карточек, следующих за краем видимой области.
 * Данные кладутся в queryKey NewsCard → при свайпе мгновенный рендер из кэша
 * (ответ ещё в полёте — useQuery присоединится к in-flight, дублей нет).
 */

const DEPTH = 5            // сколько карточек вперёд (~2–3 свайпа)
const DELAY_MS = 250       // пауза между фоновыми запросами (не душим сеть/Finam)
const DEBOUNCE_MS = 400    // тишина после скролла перед стартом очереди
const REQUESTED_CAP = 200  // верхний предел requestedRef
const FALLBACK_CARD_WIDTH = 236

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function shouldSkip(): boolean {
  if (typeof document !== 'undefined' && document.hidden) return true
  const conn = (navigator as any)?.connection
  if (conn?.saveData) return true
  if (conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') return true
  return false
}

/**
 * @param articles  упорядоченный список новостей секции
 * @param trackRef  скролл-контейнер карусели; { current: null } => вертикальная лента (window scroll)
 * @param enabled   включён ли префетч (только там, где showChart === true)
 */
export function useNewsChartPrefetch(
  articles: NewsArticle[],
  trackRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const queryClient = useQueryClient()
  // useRef сознательно: переживает перезапуски эффекта при refetch/пересоздании
  // articles — дедуп-память сохраняется. НЕ заменять на useState/useMemo.
  const requestedRef = useRef<Set<string>>(new Set())
  const generationRef = useRef(0) // поколение запуска — отмена устаревшей очереди

  useEffect(() => {
    if (!enabled || articles.length === 0) return

    const track = trackRef.current

    // gap из computed style трека — никаких магических констант
    const measureStep = (): number => {
      const firstCard = track?.querySelector<HTMLElement>('[data-flip-id]')
      if (!track || !firstCard) return FALLBACK_CARD_WIDTH
      const gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0
      return firstCard.offsetWidth + gap
    }

    // Индекс первой карточки за краем видимой области.
    // -1 => префетч сейчас неуместен (вне зоны ленты / всё видимо).
    const computeStart = (): number => {
      if (track) {
        // Горизонтальная карусель: правый край видимой области
        const rightEdge = track.scrollLeft + track.clientWidth
        return Math.floor(rightEdge / measureStep())
      }

      // Вертикальная лента (NewsFeed): нижний край viewport через DOM.
      // Пагинации нет — идём от реальной позиции окна.
      const nodes = document.querySelectorAll<HTMLElement>('[data-newsfeed-card]')
      if (nodes.length === 0) return -1

      // Зона ленты: если viewport (с запасом в один экран) не пересекает
      // диапазон карточек — пользователь не в ленте (например, скроллит
      // модалку новости поверх background location) → молчим.
      const viewportTop = window.scrollY
      const viewportBottom = viewportTop + window.innerHeight
      const MARGIN = window.innerHeight
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const feedTop = first.offsetTop
      const feedBottom = last.offsetTop + last.offsetHeight
      if (viewportBottom + MARGIN < feedTop || viewportTop > feedBottom) return -1

      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].offsetTop > viewportBottom) {
          // dev-защита от рассинхрона DOM/массива (дубли id, посторонний узел с атрибутом)
          if (import.meta.env.DEV && nodes[i].dataset.newsfeedCard !== articles[i]?.id) {
            console.warn('[newsChartPrefetch] DOM/articles mismatch at index', i)
          }
          return i
        }
      }
      return -1 // вся лента выше нижнего края viewport — префетчить нечего
    }

    const runQueue = async (generation: number) => {
      const start = computeStart()
      if (start < 0) return
      const end = Math.min(start + DEPTH, articles.length)
      for (let i = start; i < end; i++) {
        if (generationRef.current !== generation || shouldSkip()) return
        const article = articles[i]
        if (!article || requestedRef.current.has(article.id)) continue

        if (requestedRef.current.size > REQUESTED_CAP) requestedRef.current.clear()
        requestedRef.current.add(article.id)

        queryClient
          .prefetchQuery({
            queryKey: ['newsChart', article.id], // тот же ключ, что в NewsCard
            queryFn: () => api.get(`/market/news-chart?news_id=${encodeURIComponent(article.id)}`),
            staleTime: NEWS_CHART_STALE_TIME, // инвариант: общая константа
          })
          .catch(() => {
            /* префетч молчит — карточка при показе перезапросит сама */
          })

        await sleep(DELAY_MS)
      }
    }

    const schedule = () => {
      const generation = ++generationRef.current
      setTimeout(() => {
        if (generationRef.current === generation) runQueue(generation)
      }, DEBOUNCE_MS)
    }

    schedule() // первичный запуск на свежем списке

    const target: HTMLElement | Window = track ?? window
    let t: ReturnType<typeof setTimeout>
    const onScroll = () => {
      clearTimeout(t)
      t = setTimeout(schedule, 150)
    }
    target.addEventListener('scroll', onScroll as EventListener, { passive: true })

    return () => {
      clearTimeout(t)
      target.removeEventListener('scroll', onScroll as EventListener)
      generationRef.current++ // отмена бегущей очереди
    }
  }, [articles, enabled, trackRef, queryClient])
}
