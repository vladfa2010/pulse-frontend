/**
 * =============================================================================
 * PULSE — Радио: адаптер календаря (ТЗ-43, задача 2)
 * =============================================================================
 *
 * Из GET /api/calendar берём день date === server_date и разворачиваем группы
 * в плоский список событий. Время извлекается regex-ом из title группы
 * («…(до 17:00)», «…12:30…»); не извлеклось — событие без времени
 * (не выдумываем). Сортировка: с временем по возрастанию, без времени в конец.
 */
import type { CalendarResponse } from '@/types/calendar'
import type { RadioCalendarEvent } from '@/types/radio'

// «17:00», «9.30», «до 17:00» — первое вхождение времени в title
const TIME_RE = /(\d{1,2})[:.](\d{2})/

export function extractTime(title: string): string | null {
  const m = TIME_RE.exec(title)
  if (!m) return null
  const hh = m[1].padStart(2, '0')
  return `${hh}:${m[2]}`
}

export function adaptCalendarToday(response: CalendarResponse): RadioCalendarEvent[] {
  const day = response.days?.find((d) => d.date === response.server_date)
  if (!day) return []

  const events: RadioCalendarEvent[] = []
  for (const group of day.groups ?? []) {
    const time = extractTime(group.title)
    for (const company of group.companies ?? []) {
      events.push({
        time,
        title: `${company.name} (${company.ticker})`,
        kind: group.kind,
      })
    }
  }

  return events.sort((a, b) => {
    if (a.time === b.time) return 0
    if (a.time === null) return 1
    if (b.time === null) return -1
    return a.time.localeCompare(b.time)
  })
}
