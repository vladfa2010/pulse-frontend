import { eventKind, formatEventDate, formatEventMonth } from './adviserTypes'

/**
 * ТЗ-191 Задача 6 — элементы строки события по мокапу:
 * .date-badge (день + месяц в бейдже) и .kind-chip (цветовая кодировка типа).
 * Только визуал — логика загрузки событий живёт на страницах.
 */

/** 'YYYY-MM-DD' → бейдж с числом и коротким месяцем (.date-badge мокапа) */
export function EventDateBadge({ date }: { date: string }) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  const day = m ? m[3] : formatEventDate(date).slice(0, 2)
  const month = formatEventMonth(date)
  return (
    <div
      className="inline-flex flex-col items-center justify-center shrink-0 rounded-xl"
      style={{ minWidth: 46, height: 46, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}
    >
      <span className="text-[15px] font-bold leading-none" style={{ color: '#00D4FF' }}>{day}</span>
      <span className="text-[9px] font-semibold uppercase mt-0.5" style={{ color: '#6B7280' }}>{month}</span>
    </div>
  )
}

/** Чип типа события (.kind-chip мокапа): СД / Дивиденды / Отчётность; неизвестный тип — без чипа */
export function EventKindChip({ title }: { title: string }) {
  const kind = eventKind(title)
  if (!kind) return null
  return (
    <span
      className="px-[7px] py-0.5 rounded-full text-[10px] font-semibold shrink-0"
      style={{ backgroundColor: `${kind.color}1A`, color: kind.color, border: `1px solid ${kind.color}33` }}
    >
      {kind.label}
    </span>
  )
}
