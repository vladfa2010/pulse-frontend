/// <reference types="vite/client" />
import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { playNewsChime } from '@/lib/sound'
import { useUnreadCount } from '@/contexts/UnreadCountContext'

/* =============================================================================
   useSseNews — Real-time news via Server-Sent Events (SSE)
   =============================================================================

   Connects to backend SSE stream and instantly adds new articles
   to React Query cache when they arrive.

   Why SSE (not WebSocket):
   - One-directional: server → browser (perfect for news push)
   - Works over HTTP (no protocol upgrade)
   - Auto-reconnect built into browser
   - Simpler than WebSocket

   Events:
     - "connected" — initial connection established
     - "news"      — new article broadcasted from cron (legacy path)
     - "refresh"   — NewsSourceManager saved new articles, clients should refetch
     - "ping"      — heartbeat every 30s (keeps connection alive)
*/

const SSE_URL = `${import.meta.env.VITE_API_URL || 'https://pulse-api-bsov.onrender.com'}/api/news/stream`

interface SseNewsArticle {
  id: string
  title_ru: string
  summary_ru: string
  source: string
  published_at: string
  sentiment: 'positive' | 'negative' | 'neutral'
  matched_tags: string[]
  url: string
}

export function useSseNews(enabled: boolean = true, isMuted: boolean = false) {
  const queryClient = useQueryClient()
  const { increment } = useUnreadCount()
  const [isConnected, setIsConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMutedRef = useRef(isMuted)

  // Keep mutable ref so mute changes don't reconnect SSE
  isMutedRef.current = isMuted

  const connect = useCallback(() => {
    if (!enabled || esRef.current?.readyState === EventSource.OPEN) return

    console.log('[SSE] Connecting...')
    const es = new EventSource(SSE_URL)
    esRef.current = es

    es.onopen = () => {
      console.log('[SSE] Connected')
      setIsConnected(true)
    }

    es.addEventListener('connected', (e) => {
      console.log('[SSE] Server ready:', JSON.parse((e as MessageEvent).data))
    })

    es.addEventListener('news', (e) => {
      try {
        const article: SseNewsArticle = JSON.parse((e as MessageEvent).data)
        console.log('[SSE] New article:', article.title_ru?.slice(0, 50))

        // TZ-42: в кеш НЕ препендим и НЕ инвалидируем. Пейлоад события урезанный
        // (без slug, matched_tags: [], sentiment: null) — карточка была бы битой
        // (клик → /news/undefined), а статья ещё без тегов и не принадлежит ленте.
        // Полные данные придут событием refresh в конце цикла коллектора.
        // Здесь — только бейдж и звук.
        increment()
        if (!isMutedRef.current) playNewsChime()
      } catch (err) {
        console.error('[SSE] Parse error:', err)
      }
    })

    es.addEventListener('refresh', () => {
      console.log('[SSE] Refresh signal received — refetching carousels')
      // TZ-40: invalidateQueries сам рефетчит активные запросы (RQ v5, refetchType='active'
      // по умолчанию). Явные refetchQueries по тем же ключам — двойная работа.
      // historyNews не трогаем: новые статьи непрочитанные по определению и в историю
      // не попадают; свои прочтения попадают в кеш оптимистично (UnreadNewsCarousel).
      queryClient.invalidateQueries({ queryKey: ['globalNews'] })
      queryClient.invalidateQueries({ queryKey: ['unreadNews'] })
      queryClient.invalidateQueries({ queryKey: ['news'] })
      queryClient.invalidateQueries({ queryKey: ['newsSearch'] })

      // New articles arrived — increment badge and play sound.
      // sound.ts has its own 3s debounce, so a following 'news' event won't double-chime.
      increment()
      if (!isMutedRef.current) playNewsChime()
    })

    es.addEventListener('ping', () => {
      // Heartbeat — connection alive, do nothing
    })

    es.onerror = () => {
      console.log('[SSE] Error/disconnect, will reconnect...')
      setIsConnected(false)
      es.close()
      esRef.current = null
      // Auto-reconnect after 5s (with backoff)
      reconnectTimeoutRef.current = setTimeout(connect, 5000)
    }
  }, [enabled, queryClient, increment])

  const disconnect = useCallback(() => {
    setIsConnected(false)
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
      console.log('[SSE] Disconnected')
    }
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return {
    isConnected,
  }
}
