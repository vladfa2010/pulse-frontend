import type { HeatmapCell } from './types'

export interface HeatColor {
  bg: string
  glow?: string
}

// Палитры по мастер-ТЗ п.4: 5 уровней, яркость РАСТЁТ с уровнем (fix10)
const LV  = ['rgba(255,255,255,.045)', 'rgba(0,212,255,.18)',  'rgba(0,212,255,.38)',  'rgba(0,212,255,.65)',  '#00D4FF']
const RXU = ['rgba(255,255,255,.045)', 'rgba(52,211,153,.2)',  'rgba(52,211,153,.42)', 'rgba(52,211,153,.68)', '#34D399']
const RXD = ['rgba(255,255,255,.045)', 'rgba(239,68,68,.2)',   'rgba(239,68,68,.42)',  'rgba(239,68,68,.68)',  '#EF4444']

const GLOW = '0 0 8px rgba(0,212,255,.4)' // hover-свечение (мастер-ТЗ п.4.3)

// Уровень 0–4 по квантилям (мастер-ТЗ п.5.3):
// 0 новостей → L0; 1..P50 → L1; (P50..P75] → L2; (P75..P90] → L3; >P90 → L4
export function heatLevel(stories: number, quantiles: number[]): number {
  if (!stories) return 0
  const [p50, p75, p90] = quantiles
  if (p90 && stories > p90) return 4
  if (p75 && stories > p75) return 3
  if (p50 && stories > p50) return 2
  return 1
}

// Универсальная заливка (мини-сетки тегов, TopChart-производные): знак тональности
// задаёт шкалу, null/0/undefined → нейтральная cyan.
export function getHeatColor(
  stories: number,
  quantiles: number[],
  sentimentSign: 1 | -1 | 0 | null | undefined
): HeatColor {
  const level = heatLevel(stories, quantiles)
  if (level === 0) return { bg: LV[0] }
  const scale = sentimentSign === 1 ? RXU : sentimentSign === -1 ? RXD : LV
  return { bg: scale[level], glow: GLOW }
}

export function getVolumeDeltaColor(delta: number): string {
  if (delta > 0) return '#34D399'
  if (delta < 0) return '#F87171'
  return '#6B7280'
}

export type HeatmapOverlay = 'freq' | 'sentiment' | 'spikes'

export function getOverlayColor(
  cell: HeatmapCell,
  quantiles: number[],
  overlay: HeatmapOverlay
): HeatColor {
  const level = heatLevel(cell.stories, quantiles)
  if (level === 0) return { bg: LV[0] }
  if (overlay === 'sentiment') {
    // День без перевеса тональности → L0 (мастер-ТЗ п.4, п.7)
    if (cell.sentiment_sign == null) return { bg: LV[0] }
    const scale = cell.sentiment_sign === 1 ? RXU : RXD
    return { bg: scale[level], glow: GLOW }
  }
  // freq и spikes: заливка — частотная cyan-шкала. У spikes цвет НЕ подменяется:
  // всплеск показывается точкой поверх ячейки (см. YearGrid, шаг 2)
  return { bg: LV[level], glow: GLOW }
}
