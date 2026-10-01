import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CalendarDays } from 'lucide-react'
import { fetchCalendarToday } from '@/lib/educationApi'
import type { CalendarTodayEvent } from '@/lib/educationApi'
import { eventKindColor, moscowDateString, relDayLabel } from '@/lib/educationMatch'
import MatchedCourseChips from './MatchedCourseChips'

// Блок «Сегодня в календаре» (ТЗ-103 v2, Задача 8) — события сегодня/завтра,
// к которым есть подходящие курсы. Рендерится на витрине образования НАД
// полками. Пустой ответ { events: [] } или 404 (фичефлаг выключен) — блока
// нет вообще, без заглушек «событий нет».

function fmtEventDate(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export default function CalendarTodayBlock() {
  const [events, setEvents] = useState<CalendarTodayEvent[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCalendarToday()
      .then(data => { if (!cancelled) setEvents(Array.isArray(data?.events) ? data.events : []) })
      // 404 (флаг выкл) и прочие ошибки — блок молча скрыт (риск v2 п.7).
      .catch(() => { if (!cancelled) setEvents([]) })
    return () => { cancelled = true }
  }, [])

  if (!events || events.length === 0) return null

  const today = moscowDateString()

  return (
    <section className="max-w-[1200px] mx-auto px-6 md:px-12 mb-12 w-full">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-2 h-2 rounded-full flex-none" style={{ background: '#00D4FF' }} />
        <h2 className="text-lg font-semibold text-white">Сегодня в календаре</h2>
        <Link
          to="/#investor-calendar"
          className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-white transition-colors"
        >
          <CalendarDays size={13} />
          Весь календарь
        </Link>
      </div>
      <p className="text-[12px] text-[#6B7280] pl-[18px] mb-5">
        События ближайших двух дней, к которым можно подготовиться
      </p>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {events.map((ev, i) => {
          const color = eventKindColor(ev.kind)
          const rel = relDayLabel(ev.date, today)
          return (
            <div
              key={`${ev.date}:${ev.kind}:${ev.ticker || i}:${i}`}
              className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: `${color}1F`, color, border: `1px solid ${color}40` }}
                >
                  {ev.kind}
                </span>
                <span className="text-[11px] text-[#6B7280]">{fmtEventDate(ev.date)}</span>
                {rel && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                    style={{
                      background: rel === 'Сегодня' ? 'rgba(0,212,255,.12)' : 'rgba(255,255,255,.05)',
                      color: rel === 'Сегодня' ? '#00D4FF' : '#9CA3AF',
                      border: `1px solid ${rel === 'Сегодня' ? 'rgba(0,212,255,.25)' : 'rgba(255,255,255,.08)'}`,
                    }}
                  >
                    {rel}
                  </span>
                )}
                {ev.status === 'expected' && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      background: 'rgba(245,158,11,.12)',
                      color: '#F59E0B',
                      border: '1px solid rgba(245,158,11,.25)',
                    }}
                  >
                    ожидается
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[13px] text-white font-medium truncate">
                  {ev.company || ev.title}
                </span>
                {ev.ticker && (
                  <span className="text-[11px] text-[#6B7280] font-mono tabular-nums">{ev.ticker}</span>
                )}
              </div>
              <MatchedCourseChips courses={ev.matched_courses || []} caption="Подготовиться" />
            </div>
          )
        })}
      </div>
    </section>
  )
}
