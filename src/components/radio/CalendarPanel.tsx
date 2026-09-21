/**
 * PULSE — Радио: календарь дня (ТЗ-44, задача 3).
 * Порт CalendarPanel.tsx; данные — RadioCalendarEvent из calendarAdapter
 * (ТЗ-43): time «HH:MM» | null, title, kind. Статус «прошло/скоро» — по
 * сравнению time с текущим, обновляется раз в минуту.
 */
import { useEffect, useState } from 'react'
import type { RadioCalendarEvent } from '@/types/radio'

type Status = 'past' | 'soon' | 'upcoming'

function eventStatus(e: RadioCalendarEvent, nowHHMM: string): Status {
  if (e.time === null) return 'upcoming'
  if (e.time < nowHHMM) return 'past'
  // «скоро» — ближайшие 30 минут
  const [eh, em] = e.time.split(':').map(Number)
  const [nh, nm] = nowHHMM.split(':').map(Number)
  return eh * 60 + em - (nh * 60 + nm) <= 30 ? 'soon' : 'upcoming'
}

export function CalendarPanel({ events }: { events: RadioCalendarEvent[] }) {
  const [, force] = useState(0)
  // обновляем статусы «прошло/скоро» раз в минуту
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const now = new Date()
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          Календарь · сегодня
        </span>
        <span className="text-[9px] tabular-nums text-zinc-500">{events.length}</span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {events.map((e, idx) => {
          const st = eventStatus(e, nowHHMM)
          return (
            <li
              key={`${e.time ?? 'x'}-${idx}`}
              className={`border-b border-zinc-800 px-3 py-2 transition-colors ${
                st === 'past' ? 'opacity-40' : st === 'soon' ? 'bg-yellow-400/5' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] tabular-nums font-bold"
                  style={{
                    color:
                      st === 'soon' ? '#facc15' : st === 'past' ? '#71717a' : '#e4e4e7',
                  }}
                >
                  {e.time ?? '—'}
                </span>
                <span className="ml-auto text-[8px] uppercase tracking-[0.12em] text-zinc-500">
                  {e.kind}
                </span>
                {st === 'soon' && (
                  <span className="radio-live-dot h-1 w-1 rounded-full bg-yellow-400" title="Скоро" />
                )}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-zinc-200">{e.title}</div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
