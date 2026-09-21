/**
 * PULSE — Радио: котировки наблюдения (ТЗ-44, задача 3).
 * Порт Watchlist.tsx как есть (formatPrice — из hooks/useMarket).
 */
import type { RadioQuote } from '@/types/radio'
import { formatPrice } from '@/hooks/useMarket'

export function Watchlist({ quotes, live }: { quotes: RadioQuote[]; live: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-zinc-800 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
        Наблюдение
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {quotes.map((q) => {
          const up = q.changePct >= 0
          return (
            <div
              key={q.symbol}
              className="border-b border-zinc-800 px-3 py-2.5 transition-colors hover:bg-zinc-800/50"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-bold text-white">{q.name}</span>
                <span className="text-[9px] text-zinc-500">{q.symbol.replace('USDT', '')}/USD</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-[13px] tabular-nums text-zinc-200">
                  {formatPrice(q.price)}
                </span>
                <span
                  className="text-[11px] tabular-nums font-bold"
                  style={{ color: up ? '#34d399' : '#f87171' }}
                >
                  {up ? '▲' : '▼'} {Math.abs(q.changePct).toFixed(2)}%
                </span>
              </div>
              {/* мини-спарк */}
              <div className="mt-1.5 flex h-[14px] items-end gap-[2px]">
                {Array.from({ length: 24 }).map((_, i) => {
                  const h = 3 + Math.abs(Math.sin(i * 1.7 + q.price * 0.001)) * 11
                  return (
                    <div
                      key={i}
                      className="w-full"
                      style={{
                        height: `${h}px`,
                        background: up ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)',
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="border-t border-zinc-800 px-3 py-2 text-[8px] uppercase tracking-[0.14em] text-zinc-500">
        {live ? 'источник: binance · 5с' : 'демо-режим: симуляция цен'}
      </div>
    </div>
  )
}
