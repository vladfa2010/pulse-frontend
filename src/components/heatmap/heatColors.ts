export const HEAT_LEVELS = 4

import type { HeatmapCell } from './types'

export interface HeatColor {
  bg: string
  glow?: string
}

export function getHeatColor(
  stories: number,
  quantiles: number[],
  sentimentSign: 1 | -1 | 0 | null
): HeatColor {
  if (stories === 0) {
    return { bg: 'rgba(255,255,255,0.04)' }
  }

  const [p50, p75, p90] = quantiles
  let level = 1
  if (p90 && stories >= p90) level = 3
  else if (p75 && stories >= p75) level = 2
  else if (p50 && stories >= p50) level = 1

  if (sentimentSign === 1) {
    if (level === 3) return { bg: '#059669', glow: '0 0 8px rgba(52,211,153,0.45)' }
    if (level === 2) return { bg: '#10B981', glow: '0 0 6px rgba(52,211,153,0.35)' }
    return { bg: '#34D399' }
  }

  if (sentimentSign === -1) {
    if (level === 3) return { bg: '#DC2626', glow: '0 0 8px rgba(248,113,113,0.45)' }
    if (level === 2) return { bg: '#EF4444', glow: '0 0 6px rgba(248,113,113,0.35)' }
    return { bg: '#F87171' }
  }

  // neutral / unknown sentiment
  if (level === 3) return { bg: '#00A3CC', glow: '0 0 8px rgba(0,212,255,0.45)' }
  if (level === 2) return { bg: '#00C2E0', glow: '0 0 6px rgba(0,212,255,0.35)' }
  return { bg: '#00D4FF' }
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
  if (overlay === 'spikes') {
    return cell.spike
      ? { bg: '#00D4FF', glow: '0 0 8px rgba(0,212,255,0.5)' }
      : { bg: 'rgba(255,255,255,0.04)' }
  }
  if (overlay === 'freq') {
    // нейтральная cyan-шкала, без раскраски по тональности
    return getHeatColor(cell.stories, quantiles, null)
  }
  return getHeatColor(cell.stories, quantiles, cell.sentiment_sign)
}
