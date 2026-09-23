/**
 * PULSE — Радио: watchlist котировок через Finam (ТЗ-56).
 *
 * Опрос /api/market/watchlist-quotes каждые 60 сек. Идёт через единый
 * api-клиент (@/lib/api) — токен ставится в Authorization: Bearer
 * (authMiddleware куку не читает; прямой fetch с credentials:'include'
 * давал вечный 401, тот же баг, что был исправлен в fetchMarketCached).
 *
 * Fallback: при ошибке (network, 5xx, 503 market_unavailable) показываем
 * последний успешный ответ + флаг offline. 503 при пустом lastUpdate
 * (первый запрос не удался) → offline с пустым списком.
 * Если у юзера нет активных тегов с тикерами → пустой массив + флаг empty.
 *
 * По требованию владельца — опрос не паузится на скрытой вкладке
 * (Chrome всё равно может дросселировать setInterval в фоне до 1/мин —
 * с периодом 60с это незаметно).
 */
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import type { RadioQuote } from '@/types/radio'

export interface WatchlistState {
  quotes: RadioQuote[]
  offline: boolean
  empty: boolean
  /** Timestamp последнего успешного ответа */
  lastUpdate: number | null
  /** Сообщение об ошибке (если offline) */
  error: string | null
}

const POLL_INTERVAL_MS = 60_000

interface ApiQuote {
  symbol: string
  tag_id: string
  tag_name: string
  price: number
  changePct: number
  currency: 'RUB' | 'USD' | null
  ts: number
}

interface ApiResponse {
  quotes: ApiQuote[]
  ts: number
}

const INITIAL: WatchlistState = {
  quotes: [],
  offline: false,
  empty: false,
  lastUpdate: null,
  error: null,
}

export function useFinamWatchlist(isLoggedIn: boolean): WatchlistState {
  const [state, setState] = useState<WatchlistState>(INITIAL)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!isLoggedIn) {
      setState(INITIAL)
      return
    }

    cancelledRef.current = false

    async function tick() {
      if (cancelledRef.current) return
      try {
        const data = (await api.get('/market/watchlist-quotes')) as ApiResponse
        if (cancelledRef.current) return
        const quotes: RadioQuote[] = (data?.quotes ?? []).map((q) => ({
          symbol: q.symbol,
          name: q.tag_name,
          price: q.price,
          changePct: q.changePct,
          currency: q.currency ?? null,
        }))
        setState({ quotes, offline: false, empty: quotes.length === 0, lastUpdate: data?.ts ?? Date.now(), error: null })
      } catch (err: any) {
        if (cancelledRef.current) return
        // Fallback: оставляем последний успешный ответ, но помечаем offline
        setState((prev) => ({ ...prev, offline: true, error: err?.message ?? String(err) }))
      }
    }

    // Первый запрос сразу, далее каждые 60 сек
    void tick()
    const id = setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      cancelledRef.current = true
      clearInterval(id)
    }
  }, [isLoggedIn])

  return state
}
