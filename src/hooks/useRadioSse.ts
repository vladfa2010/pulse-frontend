/**
 * =============================================================================
 * PULSE — Радио: SSE-клиент (ТЗ-43, задача 3)
 * =============================================================================
 *
 * EventSource на /api/news/stream (публичный поток, CORS * — авторизация SSE
 * отдельная задача, ТЗ-42 риски). События:
 *
 *   news      → фильтр matched_tags ∩ теги юзера → адаптер → onNews(item).
 *               Не по тегам юзера — игнор полностью (карточка не появляется).
 *   refresh   → инвалидация ['radio','feed'] — лента перезапросится сама.
 *   ping/connected → игнор.
 *
 * StrictMode-safe: подписка в useEffect с es.close() в cleanup; колбэк — в ref,
 * эффект не переподписывается на каждый рендер; дедуп id — на уровне ленты
 * (dev-ремонт StrictMode не плодит дубли карточек).
 * Авто-переподключение при разрыве — 5 с (как useSseNews).
 */
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE } from '@/lib/api'
import type { NewsArticle } from '@/types/news'
import type { RadioNewsItem } from '@/types/radio'
import { adaptPulseToNewsItem } from '@/lib/radio/newsAdapter'
import type { TagMap } from '@/lib/radio/tagMap'

const SSE_URL = `${API_BASE}/news/stream`
const RECONNECT_MS = 5_000

interface UseRadioSseOptions {
  enabled: boolean
  userTagIds: ReadonlySet<string>
  tagMap: TagMap
  onNews: (item: RadioNewsItem) => void
}

export function useRadioSse({ enabled, userTagIds, tagMap, onNews }: UseRadioSseOptions): void {
  const queryClient = useQueryClient()
  // Колбэк в ref: переподписка только при смене enabled/tags, а не на каждый рендер
  const onNewsRef = useRef(onNews)
  onNewsRef.current = onNews

  useEffect(() => {
    if (!enabled) return

    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let closedByCleanup = false

    const connect = () => {
      es = new EventSource(SSE_URL)

      es.addEventListener('news', (e) => {
        try {
          const article = JSON.parse((e as MessageEvent).data) as NewsArticle
          // Фильтр «моё/не моё» по тегам — события приходят с заполненными
          // matched_tags (ТЗ-42: broadcast из News Processor)
          const matched = article.matched_tags ?? []
          if (!matched.some((t) => userTagIds.has(t))) return
          onNewsRef.current(adaptPulseToNewsItem(article, userTagIds, tagMap))
        } catch {
          // битый payload — пропускаем, соединение живёт
        }
      })

      es.addEventListener('refresh', () => {
        queryClient.invalidateQueries({ queryKey: ['radio', 'feed'] })
      })

      es.addEventListener('ping', () => { /* heartbeat */ })
      es.addEventListener('connected', () => { /* приветствие */ })

      es.onerror = () => {
        es?.close()
        es = null
        if (!closedByCleanup) {
          reconnectTimer = setTimeout(connect, RECONNECT_MS)
        }
      }
    }

    connect()

    return () => {
      closedByCleanup = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
      es = null
    }
    // userTagIds/tagMap — стабильные ссылки из useMemo страницы
  }, [enabled, userTagIds, tagMap, queryClient])
}
