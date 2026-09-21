/**
 * PULSE — Радио: шапка эфира (ТЗ-44, задача 3).
 * Порт Header.tsx прототипа: ON AIR, бейдж непрочитанных, «вечер · среда» —
 * как есть; CSS-переменные → тема Pulse (zinc/cyan).
 */
import { useEffect, useState } from 'react'
import { greetingShort } from '@/lib/radio/greeting'

export function Header({
  onAir,
  live,
  unread,
  onAdmin,
}: {
  onAir: boolean
  live: boolean
  unread: number
  onAdmin: () => void
}) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
      <div className="flex items-center gap-3">
        {/* радар-логотип */}
        <div className="relative h-6 w-6">
          <div className="absolute inset-0 rounded-full border border-cyan-400 opacity-40" />
          <div className="absolute inset-[5px] rounded-full border border-cyan-400 opacity-60" />
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400" />
          <div
            className="absolute inset-0 animate-spin rounded-full"
            style={{
              animationDuration: '4.2s',
              background: 'conic-gradient(from 0deg, rgba(34,211,238,0.55), transparent 60deg)',
            }}
          />
        </div>
        <div>
          <div className="text-[13px] font-bold tracking-[0.22em] text-white">РАДИО</div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
            {greetingShort(now)} · новости прилетают — голос читает
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {unread > 0 && (
          <div className="hidden items-center gap-1.5 border border-yellow-400/60 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-yellow-400 sm:flex">
            непрочитано <span className="tabular-nums">{unread}</span>
          </div>
        )}
        <div
          className={`flex items-center gap-2 border px-2.5 py-1 text-[10px] font-bold tracking-[0.2em] ${
            onAir ? 'border-red-400 text-red-400' : 'border-zinc-800 text-zinc-500'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              onAir ? 'radio-onair-dot bg-red-400' : 'bg-zinc-600'
            }`}
          />
          {onAir ? 'ON AIR' : 'ЭФИР НА ПАУЗЕ'}
        </div>
        <div
          className="hidden items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-zinc-500 lg:flex"
          title={live ? 'Котировки: Binance, реальное время' : 'Котировки: симуляция (API недоступен)'}
        >
          <span className={`h-1 w-1 rounded-full ${live ? 'radio-live-dot bg-emerald-400' : 'bg-yellow-400'}`} />
          {live ? 'котировки live' : 'котировки sim'}
        </div>
        <div className="text-[12px] tabular-nums text-zinc-200">
          {now.toLocaleTimeString('ru-RU')}
        </div>
        <button
          onClick={onAdmin}
          className="border border-zinc-800 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:border-cyan-400 hover:text-cyan-400"
          title="Конструктор эфира"
        >
          ⚙ админка
        </button>
      </div>
    </header>
  )
}
