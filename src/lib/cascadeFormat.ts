/**
 * =============================================================================
 * PULSE — Форматтеры страницы «Каскады» (ТЗ-93, задача 4)
 * =============================================================================
 */

/** Дата и время по МСК: «05.09 14:20» */
export function formatMskDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Только дата по МСК: «05.09.2026» */
export function formatMskDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Период «начало — конец» по МСК */
export function formatMskPeriod(fromIso: string | null, toIso: string | null): string {
  if (!fromIso) return '—'
  const from = formatMskDateTime(fromIso)
  if (!toIso) return from
  return `${from} — ${formatMskDateTime(toIso)}`
}

/** life_min → «4ч 20м», «45м», «2д 3ч» */
export function formatLifeMin(min: number | null): string {
  if (min === null || min === undefined || Number.isNaN(min)) return '—'
  if (min < 1) return '<1м'
  const total = Math.round(min)
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const mins = total % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days}д`)
  if (hours > 0) parts.push(`${hours}ч`)
  if (mins > 0 && days === 0) parts.push(`${mins}м`)
  return parts.length > 0 ? parts.join(' ') : '<1м'
}

/** Лаг в минутах → «+33м», «+2ч 05м» */
export function formatLagMin(min: number): string {
  const total = Math.round(min)
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours > 0) return `+${hours}ч ${String(mins).padStart(2, '0')}м`
  return `+${total}м`
}

/** Цепочка источников: схлопываем ПОДРЯД идущие повторы — «RIA → ТАСС → RIA» */
export function collapseSources(sources: string[]): string[] {
  const result: string[] = []
  for (const s of sources) {
    if (result[result.length - 1] !== s) result.push(s)
  }
  return result
}

/** Доля 0..1 → «35%» */
export function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`
}
