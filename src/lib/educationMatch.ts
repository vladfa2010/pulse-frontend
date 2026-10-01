// Общие хелперы календарного мэтчинга LMS (ТЗ-103 v2).
// Даты событий — бизнес-даты YYYY-MM-DD в зоне МСК (как пишет календарный
// конвейер), поэтому «сегодня/завтра» и «через N дней» считаем ТОЖЕ по МСК,
// иначе вечером по UTC блок покажет «завтра» как «сегодня».

/** Сегодняшняя дата по Москве в формате YYYY-MM-DD. */
export function moscowDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Разница в днях между бизнес-датой события и «сегодня» (0 = сегодня, 1 = завтра). */
export function daysUntil(eventDate: string, today: string): number {
  const a = new Date(`${eventDate.slice(0, 10)}T12:00:00`)
  const b = new Date(`${today.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

/** «Сегодня» / «Завтра» / null (не ближайшие два дня). */
export function relDayLabel(eventDate: string, today: string): string | null {
  const n = daysUntil(eventDate, today)
  if (n === 0) return 'Сегодня'
  if (n === 1) return 'Завтра'
  return null
}

/** Цвет бейджа kind события по DESIGN_SYSTEM (ТЗ-103): дивиденды — amber,
 *  СД/СА — violet, отчётность (МСФО/РСБУ) — cyan, прочее — нейтральный. */
export function eventKindColor(kind: string): string {
  if (kind === 'Дивиденды') return '#FBBF24'
  if (kind === 'СД' || kind === 'СА') return '#A78BFA'
  if (kind === 'МСФО' || kind === 'РСБУ') return '#00D4FF'
  return '#9CA3AF'
}
