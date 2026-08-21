/** ТЗ-3.5: единый staleTime графика новости — используется и NewsCard, и префетчером. ИНВАРИАНТ: менять только здесь. */
export const NEWS_CHART_STALE_TIME = 5 * 60 * 1000

/** ТЗ-3.6: единый интерфейс инструмента графика реакции цены. */
export interface InstrumentChart {
  tag_id: string
  tag_name: string
  symbol: string
  date: string
  shifted: boolean
  timezone: string
  exchange_mic: string
  exchange_name: string
  times: string[]
  ohlc: number[][]
  volumes: number[]
}

