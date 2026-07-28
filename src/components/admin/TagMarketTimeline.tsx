import { useEffect, useRef, useState } from 'react'
import { adminApi } from '@/lib/api'
import { TrendingUp, Newspaper, Calendar, X } from 'lucide-react'

interface DailyStat {
  day: string
  count: number
  avg_sentiment: number
}

interface Candle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface NewsArticle {
  id: string
  title: string
  source: string
  published_at: string
  sentiment_score: number | null
  url?: string
}

interface Props {
  tagId: string
  ticker: string | null
  dailyStats: DailyStat[]
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatMskDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function TagMarketTimeline({ tagId, ticker, dailyStats }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<any>(null)
  const echartsRef = useRef<any>(null)

  const [candles, setCandles] = useState<Candle[]>([])
  const [candlesLoading, setCandlesLoading] = useState(false)
  const [candlesError, setCandlesError] = useState<string | null>(null)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [intraday, setIntraday] = useState<Candle[]>([])
  const [intradayLoading, setIntradayLoading] = useState(false)
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)

  // Load daily candles once
  useEffect(() => {
    if (!ticker) return
    let cancelled = false
    setCandlesLoading(true)
    setCandlesError(null)
    adminApi.get(`/admin/market/candles_daily?provider=MOEX&ticker=${encodeURIComponent(ticker)}&days=90`)
      .then((res: any) => {
        if (cancelled) return
        const ohlc = res.ohlc || []
        const fullDates = res.full_dates || []
        setCandles(ohlc.map((row: number[], i: number) => ({
          date: fullDates[i],
          open: row[0],
          close: row[1],
          low: row[2],
          high: row[3],
          volume: (res.volumes || [])[i] ?? 0,
        })))
      })
      .catch((err: any) => {
        if (cancelled) return
        console.error('[TagMarketTimeline] candles load error:', err)
        setCandlesError(err?.message || 'Не удалось загрузить свечи')
      })
      .finally(() => {
        if (!cancelled) setCandlesLoading(false)
      })
    return () => { cancelled = true }
  }, [ticker])

  // Init ECharts
  useEffect(() => {
    if (!chartRef.current) return
    let disposed = false

    const init = async () => {
      const echarts = await import('echarts')
      if (disposed) return
      echartsRef.current = echarts
      const instance = echarts.init(chartRef.current, 'dark')
      chartInstanceRef.current = instance

      instance.on('click', (params: any) => {
        if (params?.componentType === 'series' && params?.seriesName === 'Новости') {
          const day = params?.data?.[0]
          if (day && typeof day === 'string') {
            handleSelectDay(day)
          }
        }
      })

      const resize = () => instance.resize()
      window.addEventListener('resize', resize)
      return () => {
        window.removeEventListener('resize', resize)
      }
    }

    const cleanupPromise = init()

    return () => {
      disposed = true
      cleanupPromise.then((cleanup) => cleanup && cleanup())
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose()
        chartInstanceRef.current = null
      }
    }
  }, [])

  // Normalize MSK day keys to YYYY-MM-DD (backend may send ISO dates for Postgres)
  const normalizedStats = dailyStats.map(d => ({
    ...d,
    day: d.day ? d.day.slice(0, 10) : d.day,
  }))

  // Update chart option when data changes
  useEffect(() => {
    if (!echartsRef.current || !chartInstanceRef.current) return
    const chart = chartInstanceRef.current

    const newsMap = new Map(normalizedStats.map(d => [d.day, d.count]))
    const sortedDays = Array.from(newsMap.keys()).sort()

    const candleData = candles.map(c => [c.date, c.open, c.close, c.low, c.high])
    const newsData = sortedDays.map(day => [day, newsMap.get(day) || 0])

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(10,10,10,0.95)',
        borderColor: '#333',
        textStyle: { color: '#D1D5DB', fontSize: 11 },
      },
      grid: [
        { left: 48, right: 16, top: 24, height: '55%' },
        { left: 48, right: 16, top: '72%', height: '22%' },
      ],
      xAxis: [
        {
          type: 'category',
          data: sortedDays,
          scale: true,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#333' } },
          axisLabel: { color: '#6B7280', fontSize: 10 },
          splitLine: { show: false },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: sortedDays,
          axisLine: { lineStyle: { color: '#333' } },
          axisLabel: { show: false },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          scale: true,
          axisLine: { lineStyle: { color: '#333' } },
          axisLabel: { color: '#6B7280', fontSize: 10 },
          splitLine: { lineStyle: { color: '#1a1a1a' } },
        },
        {
          scale: true,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 },
        { show: true, xAxisIndex: [0, 1], type: 'slider', bottom: 0, height: 16, borderColor: '#222', fillerColor: 'rgba(52,211,153,0.15)', handleStyle: { color: '#34D399' }, textStyle: { color: '#6B7280' } },
      ],
      series: [
        {
          name: 'MOEX',
          type: 'candlestick',
          data: candleData,
          itemStyle: {
            color: '#34D399',
            color0: '#EF4444',
            borderColor: '#34D399',
            borderColor0: '#EF4444',
          },
        },
        {
          name: 'Новости',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: newsData,
          itemStyle: { color: 'rgba(96,165,250,0.7)', borderRadius: [2, 2, 0, 0] },
        },
      ],
    }

    chart.setOption(option, true)
  }, [candles, dailyStats])

  const handleSelectDay = (date: string) => {
    setSelectedDate(date)
    setIntraday([])
    setArticles([])

    // Intraday candles
    if (ticker) {
      setIntradayLoading(true)
      adminApi.get(`/admin/market/candles_intraday?provider=MOEX&ticker=${encodeURIComponent(ticker)}&date=${date}`)
        .then((res: any) => {
          const ohlc = res.ohlc || []
          const times = res.times || []
          setIntraday(ohlc.map((row: number[], i: number) => ({
            date: `${date}T${times[i] || '00:00'}:00`,
            open: row[0],
            close: row[1],
            low: row[2],
            high: row[3],
            volume: (res.volumes || [])[i] ?? 0,
          })))
        })
        .catch((err: any) => console.error('[TagMarketTimeline] intraday error:', err))
        .finally(() => setIntradayLoading(false))
    }

    // Articles for the day
    setArticlesLoading(true)
    adminApi.get(`/admin/tags/${tagId}/articles-by-day?date=${date}`)
      .then((res: any) => setArticles(res.articles || []))
      .catch((err: any) => console.error('[TagMarketTimeline] articles error:', err))
      .finally(() => setArticlesLoading(false))
  }

  if (!ticker) {
    return (
      <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={14} style={{ color: '#9CA3AF' }} />
          <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Market Timeline</p>
        </div>
        <p className="text-xs" style={{ color: '#6B7280' }}>Для тега не задан тикер — рыночный таймлайн недоступен.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} style={{ color: '#9CA3AF' }} />
          <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Market Timeline · {ticker}</p>
        </div>
        {candlesLoading && <span className="text-xs" style={{ color: '#6B7280' }}>Загрузка...</span>}
      </div>

      {candlesError && (
        <div className="text-xs mb-3" style={{ color: '#EF4444' }}>{candlesError}</div>
      )}

      {!candlesLoading && !candlesError && candles.length === 0 && (
        <div className="text-xs mb-3" style={{ color: '#F59E0B' }}>
          Свечи MOEX не загружены (возможно, биржа не отдаёт данные или тикер не найден). Гистограмма новостей ниже.
        </div>
      )}

      {!candlesLoading && candles.length > 0 && (
        <div className="text-xs mb-2" style={{ color: '#6B7280' }}>Свечей: {candles.length}</div>
      )}

      <div ref={chartRef} style={{ width: '100%', height: 340 }} />

      {selectedDate && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid #222222' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={14} style={{ color: '#60A5FA' }} />
              <p className="text-xs font-medium" style={{ color: '#FFFFFF' }}>{formatMskDate(selectedDate)}</p>
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="p-1 rounded hover:bg-white/5"
              aria-label="Close"
            >
              <X size={14} style={{ color: '#6B7280' }} />
            </button>
          </div>

          {intradayLoading ? (
            <p className="text-xs mb-3" style={{ color: '#6B7280' }}>Загрузка интрадея...</p>
          ) : intraday.length > 0 ? (
            <div className="mb-3">
              <p className="text-xs mb-1" style={{ color: '#9CA3AF' }}>Intraday (5 мин)</p>
              <IntradayMiniChart echarts={echartsRef.current} candles={intraday} />
            </div>
          ) : ticker ? (
            <p className="text-xs mb-3" style={{ color: '#6B7280' }}>Нет интрадей-данных за этот день.</p>
          ) : null}

          {articlesLoading ? (
            <p className="text-xs" style={{ color: '#6B7280' }}>Загрузка новостей...</p>
          ) : articles.length > 0 ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Newspaper size={14} style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>News ({articles.length})</p>
              </div>
              <div className="space-y-2 max-h-56 overflow-auto">
                {articles.map(a => (
                  <div key={a.id} className="py-1.5" style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <a
                      href={a.url || `/news/${a.id}`}
                      target="_blank"
                      rel="noopener"
                      className="text-xs block truncate hover:opacity-80"
                      style={{ color: '#FFFFFF' }}
                      title={a.title}
                    >
                      {a.title}
                    </a>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs" style={{ color: '#6B7280' }}>{a.source} · {formatDate(a.published_at)}</span>
                      {a.sentiment_score !== null && a.sentiment_score !== undefined && (
                        <span className="text-xs font-mono" style={{
                          color: a.sentiment_score > 0 ? '#34D399' : a.sentiment_score < 0 ? '#EF4444' : '#9CA3AF'
                        }}>
                          {a.sentiment_score > 0 ? '+' : ''}{a.sentiment_score}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs" style={{ color: '#6B7280' }}>Нет новостей за этот день.</p>
          )}
        </div>
      )}
    </div>
  )
}

function IntradayMiniChart({ echarts, candles }: { echarts: any; candles: Candle[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<any>(null)

  useEffect(() => {
    if (!echarts || !ref.current) return
    if (instanceRef.current) {
      instanceRef.current.dispose()
    }
    const chart = echarts.init(ref.current, 'dark')
    instanceRef.current = chart

    const data = candles.map(c => [c.date, c.open, c.close, c.low, c.high])
    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10,10,10,0.95)',
        borderColor: '#333',
        textStyle: { color: '#D1D5DB', fontSize: 11 },
      },
      grid: { left: 40, right: 8, top: 8, bottom: 24 },
      xAxis: {
        type: 'category',
        data: candles.map(c => c.date.slice(11, 16)),
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#6B7280', fontSize: 9 },
        splitLine: { show: false },
      },
      yAxis: {
        scale: true,
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#6B7280', fontSize: 9 },
        splitLine: { lineStyle: { color: '#1a1a1a' } },
      },
      series: [{
        type: 'candlestick',
        data,
        itemStyle: {
          color: '#34D399',
          color0: '#EF4444',
          borderColor: '#34D399',
          borderColor0: '#EF4444',
        },
      }],
    }
    chart.setOption(option)
    return () => chart.dispose()
  }, [echarts, candles])

  return <div ref={ref} style={{ width: '100%', height: 140 }} />
}
