/**
 * PULSE — Радио: панель саммари (ТЗ-44, задача 3; ТЗ-55 — два источника).
 *
 * ТЗ-55: «саммари рынка» (жёлтая) — read-only кэш крона, 0 LLM, доступна с
 * первого крона (~3 мин после boot VDS); «свежий обзор» (циан) — LLM-обзор,
 * формируется при накоплении порога свежих. Эфир (ТЗ-53 шаг 2) использует
 * только кэш крона. Кнопки «моё саммари»/«что сегодня»/«котировки» — как раньше.
 */
import { useState } from 'react'
import type { MarketSummary } from '@/lib/radio/summary'

function formatHM(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const STALE_MIN = 6 * 60 // ТЗ-50: старше 6ч = устарело

interface SummaryCardProps {
  market: MarketSummary
  color: 'yellow' | 'cyan'
  label: string
  onRead: () => void
  onCopy: () => void
  onDismiss: () => void
}

/** ТЗ-55: единая карточка саммари (кэш крона или свежий обзор) */
function SummaryCard({ market, color, label, onRead, onCopy, onDismiss }: SummaryCardProps) {
  const ageMin = Math.round((Date.now() - market.createdAt) / 60_000)
  const isStale = ageMin > STALE_MIN
  const border = color === 'yellow' ? 'border-yellow-400/40' : 'border-cyan-400/40'
  const text = color === 'yellow' ? 'text-yellow-400' : 'text-cyan-400'
  return (
    <div className={`border-t border-dashed ${border} bg-zinc-800/40 px-4 py-3`}>
      <div className="flex items-center gap-2.5">
        <span className={`border px-1.5 py-px text-[8px] font-bold tracking-[0.16em] ${text} ${border}`}>
          {label}
        </span>
        <span className="text-[9px] tabular-nums text-zinc-500">
          {formatHM(market.createdAt)} · {market.freshCount} свежих
          {isStale && (
            <span className="ml-1 text-orange-400">· устарело на {ageMin - STALE_MIN} мин</span>
          )}
        </span>
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={onRead}
            className="border border-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-200 hover:border-cyan-400 hover:text-cyan-400"
          >
            ▶ читать
          </button>
          <button
            onClick={onCopy}
            className="border border-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-200 hover:border-cyan-400 hover:text-cyan-400"
          >
            ⧉ копировать
          </button>
          <button
            onClick={onDismiss}
            className="border border-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 hover:border-red-400 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      </div>
      <p className="mt-2 max-w-4xl text-[12px] leading-relaxed text-zinc-200">{market.text}</p>
    </div>
  )
}

interface Props {
  freshCount: number
  threshold: number
  setThreshold: (v: number) => void
  /** ТЗ-55: кэш крона (бесплатно, 0 LLM) */
  marketCached: MarketSummary | null
  /** ТЗ-55: свежий обзор от LLM (1 Kimi-запрос при накоплении порога) */
  marketFresh: MarketSummary | null
  onReadPersonal: () => void
  onReadMarketCached: () => void
  onReadMarketFresh: () => void
  onReadCalendar: () => void
  onReadQuotes: () => void
  onDismissMarketCached: () => void
  onDismissMarketFresh: () => void
}

export function SummaryBar({
  freshCount,
  threshold,
  setThreshold,
  marketCached,
  marketFresh,
  onReadPersonal,
  onReadMarketCached,
  onReadMarketFresh,
  onReadCalendar,
  onReadQuotes,
  onDismissMarketCached,
  onDismissMarketFresh,
}: Props) {
  const [openCached, setOpenCached] = useState(false)
  const [openFresh, setOpenFresh] = useState(false)
  const pct = Math.min(100, (freshCount / threshold) * 100)
  const cachedReady = marketCached !== null
  const freshReady = marketFresh !== null

  const copyCached = () => {
    if (marketCached) void navigator.clipboard?.writeText(marketCached.text).catch(() => {})
  }
  const copyFresh = () => {
    if (marketFresh) void navigator.clipboard?.writeText(marketFresh.text).catch(() => {})
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

        {/* ТЗ-55: кэш крона — бесплатно, 0 LLM; спиннер пока кэш не пришёл */}
        <button
          onClick={onReadMarketCached}
          disabled={!cachedReady}
          className={`border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${
            cachedReady
              ? 'border-yellow-400 text-yellow-400 hover:bg-yellow-400/10'
              : 'border-zinc-800 text-zinc-500 opacity-50'
          }`}
          title={
            cachedReady
              ? `Кэш крона · обновлено ${formatHM(marketCached!.createdAt)}`
              : 'Кэш обновляется — станет доступен после первого прогона крона'
          }
        >
          ◉ саммари рынка
          {!cachedReady && (
            <span className="ml-1.5 inline-block animate-spin" role="status" aria-label="Обновляется">
              ⟳
            </span>
          )}
        </button>

        {/* ТЗ-55: свежий обзор — LLM, формируется при накоплении порога свежих */}
        <button
          onClick={onReadMarketFresh}
          disabled={!freshReady}
          className={`border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${
            freshReady
              ? 'border-cyan-400 text-cyan-400 hover:bg-cyan-400/10'
              : 'border-zinc-800 text-zinc-500 opacity-50'
          }`}
          title={
            freshReady
              ? `Свежий обзор · сформирован при ${threshold} свежих`
              : `Свежий обзор сформируется после ${threshold} свежих новостей`
          }
        >
          ◉ свежий обзор
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

        {/* прогресс накопления свежих (для свежего обзора) */}
        <div className="flex min-w-[180px] flex-1 items-center gap-2">
          <span className="whitespace-nowrap text-[9px] uppercase tracking-[0.14em] text-zinc-500">
            до свежего {freshCount}/{threshold}
          </span>
          <div className="h-[3px] flex-1 bg-zinc-800">
            <div
              className="h-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: freshReady ? '#22d3ee' : '#52525b',
              }}
            />
          </div>
          {freshReady && (
            <span className="radio-live-dot inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
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

        <div className="flex items-center gap-2">
          {cachedReady && (
            <button
              onClick={() => setOpenCached(!openCached)}
              className="text-[9px] uppercase tracking-[0.14em] text-yellow-400 underline decoration-dotted underline-offset-2"
            >
              {openCached ? 'скрыть кэш' : 'показать кэш'}
            </button>
          )}
          {freshReady && (
            <button
              onClick={() => setOpenFresh(!openFresh)}
              className="text-[9px] uppercase tracking-[0.14em] text-cyan-400 underline decoration-dotted underline-offset-2"
            >
              {openFresh ? 'скрыть свежее' : 'показать свежее'}
            </button>
          )}
        </div>
      </div>

      {/* ТЗ-55: раздельные карточки кэша крона и свежего обзора */}
      {cachedReady && openCached && marketCached && (
        <SummaryCard
          market={marketCached}
          color="yellow"
          label="САММАРИ РЫНКА · КЭШ КРОНА"
          onRead={onReadMarketCached}
          onCopy={copyCached}
          onDismiss={onDismissMarketCached}
        />
      )}
      {freshReady && openFresh && marketFresh && (
        <SummaryCard
          market={marketFresh}
          color="cyan"
          label="СВЕЖИЙ ОБЗОР · LLM"
          onRead={onReadMarketFresh}
          onCopy={copyFresh}
          onDismiss={onDismissMarketFresh}
        />
      )}
    </div>
  )
}
