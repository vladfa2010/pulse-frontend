/**
 * PULSE — Радио: панель саммари (ТЗ-44, задача 3).
 * Порт SummaryBar.tsx: 4 кнопки («моё саммари», «саммари рынка», «что сегодня»,
 * «котировки») → эндпоинты/билдеры ТЗ-43/44 (обработчики приходят пропсами);
 * повтор «саммари рынка» в пределах серверного кэша идёт без refresh=1
 * (кэш 6 ч на бэке, в логах backend — cached: true).
 */
import { useState } from 'react'
import type { MarketSummary } from '@/lib/radio/summary'

function formatHM(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  freshCount: number
  threshold: number
  setThreshold: (v: number) => void
  market: MarketSummary | null
  onReadPersonal: () => void
  onReadMarket: () => void
  onReadCalendar: () => void
  onReadQuotes: () => void
  onDismissMarket: () => void
}

export function SummaryBar({
  freshCount,
  threshold,
  setThreshold,
  market,
  onReadPersonal,
  onReadMarket,
  onReadCalendar,
  onReadQuotes,
  onDismissMarket,
}: Props) {
  const [open, setOpen] = useState(false)
  const pct = Math.min(100, (freshCount / threshold) * 100)
  const ready = market !== null

  const copy = () => {
    if (market) void navigator.clipboard?.writeText(market.text).catch(() => {})
  }

  return (
    <div className="border-b border-zinc-800 bg-zinc-900/60">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-1.5">
        <button
          onClick={onReadPersonal}
          className="border border-cyan-400/50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-400 transition-colors hover:bg-cyan-400/10"
          title="Прочитать, что важного вы пропустили"
        >
          ◉ моё саммари
        </button>

        <button
          onClick={onReadMarket}
          disabled={!ready}
          className={`border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${
            ready
              ? 'border-yellow-400 text-yellow-400 hover:bg-yellow-400/10'
              : 'border-zinc-800 text-zinc-500 opacity-50'
          }`}
          title={ready ? 'Прочитать общее саммари рынка' : `Сформируется после ${threshold} свежих новостей`}
        >
          ◉ саммари рынка
        </button>

        <button
          onClick={onReadCalendar}
          className="border border-zinc-800 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-200 transition-colors hover:border-cyan-400 hover:text-cyan-400"
          title="Зачитать, что сегодня в календаре"
        >
          ◉ что сегодня
        </button>

        <button
          onClick={onReadQuotes}
          className="border border-zinc-800 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-200 transition-colors hover:border-cyan-400 hover:text-cyan-400"
          title="Зачитать котировки наблюдения"
        >
          ◉ котировки
        </button>

        {/* прогресс накопления свежих */}
        <div className="flex min-w-[180px] flex-1 items-center gap-2">
          <span className="whitespace-nowrap text-[9px] uppercase tracking-[0.14em] text-zinc-500">
            свежих {freshCount}/{threshold}
          </span>
          <div className="h-[3px] flex-1 bg-zinc-800">
            <div
              className="h-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: ready ? '#facc15' : '#22d3ee',
              }}
            />
          </div>
          {ready && (
            <span className="radio-live-dot inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
          )}
        </div>

        <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] text-zinc-500">
          порог:
          {[25, 50, 100].map((v) => (
            <button
              key={v}
              onClick={() => setThreshold(v)}
              className={`border px-1.5 py-0.5 tabular-nums transition-colors ${
                threshold === v
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {ready && (
          <button
            onClick={() => setOpen(!open)}
            className="text-[9px] uppercase tracking-[0.14em] text-yellow-400 underline decoration-dotted underline-offset-2"
          >
            {open ? 'скрыть текст' : 'показать текст'}
          </button>
        )}
      </div>

      {/* карточка сформированного саммари */}
      {ready && open && market && (
        <div className="border-t border-dashed border-yellow-400/40 bg-zinc-800/40 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="border border-yellow-400 px-1.5 py-px text-[8px] font-bold tracking-[0.16em] text-yellow-400">
              САММАРИ РЫНКА
            </span>
            <span className="text-[9px] tabular-nums text-zinc-500">
              {formatHM(market.createdAt)} · {market.freshCount} свежих
            </span>
            <div className="ml-auto flex gap-1.5">
              <button
                onClick={onReadMarket}
                className="border border-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-200 hover:border-cyan-400 hover:text-cyan-400"
              >
                ▶ читать
              </button>
              <button
                onClick={copy}
                className="border border-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-200 hover:border-cyan-400 hover:text-cyan-400"
              >
                ⧉ копировать
              </button>
              <button
                onClick={onDismissMarket}
                className="border border-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 hover:border-red-400 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          </div>
          <p className="mt-2 max-w-4xl text-[12px] leading-relaxed text-zinc-200">
            {market.text}
          </p>
        </div>
      )}
    </div>
  )
}
