export function formatMoney(n: number): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`
}

export function sign(n: number): '+' | '−' {
  return n >= 0 ? '+' : '−'
}

export function formatPercent(n: number): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const s = sign(n)
  return `${s}${Math.abs(n).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

export function formatDecimal(n: number, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** ТЗ-56: цена котировки. ≥1000 без копеек, ≥1 — 2 знака, <1 — 4 знака. Локаль ru-RU. */
export function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
  if (p >= 1) return p.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
  return p.toLocaleString('ru-RU', { maximumFractionDigits: 4 })
}
