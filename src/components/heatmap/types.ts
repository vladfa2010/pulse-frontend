export interface HeatmapCell {
  date: string
  stories: number
  pos: number
  neg: number
  resonance: number
  sentiment_sign: 1 | -1 | 0 | null
  spike?: boolean
}

export interface YearPayload {
  cells: HeatmapCell[]
  quantiles: number[]
  instrument: Instrument | null
  meta: {
    generated_at: string
    stale: boolean
    tz: string
    empty: boolean
    frozen_through: string | null
  }
}

export interface Instrument {
  ticker: string
  mic: string
  symbol: string
}

export interface DayStory {
  id: string
  title: string
  summary: string
  source: string
  url: string
  published_at: string
  sentiment: string
  source_count: number
  matched_tags: string[]
}

export interface DayPayload {
  date: string
  stories: DayStory[]
  meta: {
    generated_at: string
    stale: boolean
    tz: string
  }
}

export interface HourCell {
  day: string
  hour: number
  stories: number
}

export interface DayHoursPayload {
  days: number
  cells: HourCell[]
  meta: {
    generated_at: string
    stale: boolean
    tz: string
  }
}

export interface CandlesPayload {
  ticker: string
  exchange: string
  symbol: string
  provider: string
  weeks: number
  full_dates: string[]
  ohlc: number[][]
  volumes: number[]
}

export type Scope = 'portfolio' | 'tag' | 'all'
export type Scale = 'year' | 'day' | 'day_hours'
export type IndexChoice = 'none' | 'IMOEX' | 'SPY'
