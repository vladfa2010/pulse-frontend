/**
 * =============================================================================
 * PULSE — Радио: котировки наблюдения (ТЗ-44, задача 3)
 * =============================================================================
 *
 * Из useMarket.ts прототипа берём ТОЛЬКО watchlist: Binance-поллинг раз в 5 с,
 * при недоступности API — плавная симуляция вокруг последних известных цен.
 * handleSpike/алерты ОТКЛЮЧЕНЫ (алерты — вне ТЗ-42/43/44).
 *
 * TODO(радио): Binance-поллинг временный — уходит при подключении
 * /api/market/* (единый market-data бэкенда Pulse).
 */
import { useEffect, useRef, useState } from 'react'
import type { RadioQuote } from '@/types/radio'

const NAMES: Record<string, string> = {
  BTCUSDT: 'Биткоин',
  ETHUSDT: 'Эфириум',
  SOLUSDT: 'Солана',
  BNBUSDT: 'BNB',
}

const SYMBOLS = Object.keys(NAMES)

const FALLBACK_BASE: Record<string, number> = {
  BTCUSDT: 118400,
  ETHUSDT: 4350,
  SOLUSDT: 238,
  BNBUSDT: 1180,
}

/** живые котировки с Binance; при недоступности API — плавная симуляция */
export function useMarket() {
  const [quotes, setQuotes] = useState<RadioQuote[]>(() =>
    SYMBOLS.map((s) => ({
      symbol: s,
      name: NAMES[s],
      price: FALLBACK_BASE[s],
      changePct: (Math.random() - 0.5) * 3,
    }))
  )
  const [live, setLive] = useState(false)
  const simRef = useRef(FALLBACK_BASE)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const q = encodeURIComponent(JSON.stringify(SYMBOLS))
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${q}`, {
          signal: AbortSignal.timeout(6000),
        })
        if (!res.ok) throw new Error('bad status')
        const data = (await res.json()) as Array<{
          symbol: string
          lastPrice: string
          priceChangePercent: string
        }>
        if (cancelled) return
        const next = data.map((d) => {
          const price = parseFloat(d.lastPrice)
          simRef.current[d.symbol] = price
          return {
            symbol: d.symbol,
            name: NAMES[d.symbol] ?? d.symbol,
            price,
            changePct: parseFloat(d.priceChangePercent),
          }
        })
        setQuotes(next)
        setLive(true)
      } catch {
        if (cancelled) return
        // симуляция вокруг последних известных цен
        setLive(false)
        setQuotes((prev) =>
          prev.map((p) => {
            const drift = (Math.random() - 0.5) * 0.004
            const price = Math.max(0.0001, p.price * (1 + drift))
            simRef.current[p.symbol] = price
            return { ...p, price, changePct: p.changePct + drift * 100 }
          })
        )
      }
    }

    poll()
    const id = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return { quotes, live }
}

export function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
  if (p >= 1) return p.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
  return p.toLocaleString('ru-RU', { maximumFractionDigits: 4 })
}
