import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

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
     - "news"      — new article broadcasted from cron
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

export function useSseNews(enabled: boolean = true) {
  const queryClient = useQueryClient()
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    if (!enabled || esRef.current?.readyState === EventSource.OPEN) return

    console.log('[SSE] Connecting...')
    const es = new EventSource(SSE_URL)
    esRef.current = es

    es.onopen = () => {
      console.log('[SSE] Connected')
    }

    es.addEventListener('connected', (e) => {
      console.log('[SSE] Server ready:', JSON.parse((e as MessageEvent).data))
    })

    es.addEventListener('news', (e) => {
      try {
        const article: SseNewsArticle = JSON.parse((e as MessageEvent).data)
        console.log('[SSE] New article:', article.title_ru?.slice(0, 50))

        // Add to React Query cache — instant UI update
        queryClient.setQueryData(['news'], (old: any[] = []) => {
          // Prevent duplicates
          if (old.some((n: any) => n.id === article.id)) return old
          return [article, ...old]
        })

        // Also invalidate to trigger refetch on next interval
        queryClient.invalidateQueries({ queryKey: ['news'] })
      } catch (err) {
        console.error('[SSE] Parse error:', err)
      }
    })

    es.addEventListener('ping', () => {
      // Heartbeat — connection alive, do nothing
    })

    es.onerror = () => {
      console.log('[SSE] Error/disconnect, will reconnect...')
      es.close()
      esRef.current = null
      // Auto-reconnect after 5s (with backoff)
      reconnectTimeoutRef.current = setTimeout(connect, 5000)
    }
  }, [enabled, queryClient])

  const disconnect = useCallback(() => {
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
    isConnected: esRef.current?.readyState === EventSource.OPEN,
  }
}
