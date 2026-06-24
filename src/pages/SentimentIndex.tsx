import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { api } from '@/lib/api'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from 'recharts'
import { Lock, TrendingUp, Minus, TrendingDown } from 'lucide-react'

const SSE_URL = import.meta.env.VITE_API_URL || 'https://pulse-api-bsov.onrender.com'
const IMOEX_MOCK_VALUE = 3200

interface IndexPoint {
  time: string
  value: number
}

interface ImoexCandle {
  time: string
  close: number
}

interface ImoexData {
  current: number
  sessionActive: boolean
  sessionStart: string
  sessionEnd: string
  candles: ImoexCandle[]
}

interface SentimentData {
  currentValue: number
  history: IndexPoint[]
  imoex: ImoexData
  updatedAt: string
}

interface PersonalStats {
  totalVotes: number
  todayVotes: number
  syncRate: number
  streakDays: number
  impactSum: number
}

interface CommunityMetrics {
  onlineNow: number
  votesToday: number
  distribution: { positive: number; neutral: number; negative: number }
}

interface StatusData {
  state: 'active' | 'voting'
  secondsUntilNextVote: number
  currentValue: number
  personal: PersonalStats
  community: CommunityMetrics
  history: { time: string; value: number; indexAfter: number }[]
}

function formatTime(value: number | string) {
  const d = new Date(value)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })
}

function formatCountdown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function sentimentColor(value: number) {
  if (value > 0) return '#34D399' // --text-success
  if (value < 0) return '#EF4444' // --text-error
  return '#9CA3AF'
}

export default function SentimentIndex() {
  const { isLoggedIn } = useAuth()
  const { open } = useAuthModal()
  const [loading, setLoading] = useState(true)
  const [indexData, setIndexData] = useState<SentimentData | null>(null)
  const [status, setStatus] = useState<StatusData | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [justVoted, setJustVoted] = useState(false)
  const sseRef = useRef<EventSource | null>(null)

  const displayState = useMemo(() => {
    if (!isLoggedIn) return 'anonymous'
    if (justVoted) return 'active'
    if (!status) return 'voting'
    return status.state
  }, [isLoggedIn, status, justVoted])

  const fetchIndex = async () => {
    try {
      const data = await api.get('/sentiment/index')
      setIndexData(data)
    } catch (err: any) {
      console.error('[Sentiment] fetch index error:', err.message)
    }
  }

  const fetchStatus = async () => {
    if (!isLoggedIn) return
    try {
      const data = await api.get('/sentiment/status')
      setStatus(data)
      setSecondsLeft(data.secondsUntilNextVote || 0)
      setJustVoted(false)
    } catch (err: any) {
      console.error('[Sentiment] fetch status error:', err.message)
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchIndex(), fetchStatus()]).finally(() => setLoading(false))

    // Fallback polling
    const poll = setInterval(() => {
      fetchIndex()
      if (isLoggedIn) fetchStatus()
    }, 10000)

    // SSE
    const es = new EventSource(`${SSE_URL}/api/sentiment/stream`)
    sseRef.current = es
    es.addEventListener('sentiment-update', () => {
      fetchIndex()
      if (isLoggedIn) fetchStatus()
    })
    es.onerror = () => {
      // Fallback polling keeps working
    }

    return () => {
      clearInterval(poll)
      es.close()
    }
  }, [isLoggedIn])

  // Personal countdown timer
  useEffect(() => {
    if (displayState !== 'active' || secondsLeft <= 0) return
    const timer = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          fetchStatus()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [displayState, secondsLeft])

  const handleVote = async (value: number) => {
    try {
      const result = await api.post('/sentiment/vote', { value })
      setJustVoted(true)
      setSecondsLeft(result.secondsUntilNext || 0)
      await Promise.all([fetchIndex(), fetchStatus()])
    } catch (err: any) {
      alert(err.message || 'Не удалось проголосовать')
    }
  }

  const chartData = useMemo(() => {
    const history = indexData?.history || [{ time: new Date().toISOString(), value: 0 }]
    const imoexCandles = indexData?.imoex?.candles || []
    // eslint-disable-next-line no-console
    console.log('[Sentiment] candles:', imoexCandles.length, 'current:', indexData?.imoex?.current)

    // Если нет реальных свечей — fallback flat line
    if (imoexCandles.length === 0) {
      return history.map(p => {
        const ts = new Date(p.time).getTime()
        return { time: ts, value: p.value, imoex: indexData?.imoex?.current ?? IMOEX_MOCK_VALUE, label: formatTime(ts) }
      })
    }

    // Объединяем точки индекса и IMOEX, сохраняя последние известные значения
    const points = new Map<number, { value?: number; imoex?: number }>()

    for (const p of history) {
      const ts = new Date(p.time).getTime()
      const cur = points.get(ts) || {}
      cur.value = p.value
      points.set(ts, cur)
    }
    for (const c of imoexCandles) {
      const ts = new Date(c.time).getTime()
      const cur = points.get(ts) || {}
      cur.imoex = c.close
      points.set(ts, cur)
    }

    const sorted = Array.from(points.keys()).sort((a, b) => a - b)
    let lastValue = 0
    let lastImoex = imoexCandles[0]?.close ?? indexData?.imoex?.current ?? IMOEX_MOCK_VALUE

    return sorted.map(ts => {
      const p = points.get(ts)!
      if (p.value !== undefined) lastValue = p.value
      if (p.imoex !== undefined) lastImoex = p.imoex
      return { time: ts, value: lastValue, imoex: lastImoex, label: formatTime(ts) }
    })
  }, [indexData])

  const sessionBounds = useMemo(() => {
    if (!indexData?.imoex) return null
    return {
      start: new Date(indexData.imoex.sessionStart).getTime(),
      end: new Date(indexData.imoex.sessionEnd).getTime(),
    }
  }, [indexData])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary text-white flex items-center justify-center pt-24">
        <div className="text-text-secondary">Загрузка индекса настроения…</div>
      </div>
    )
  }

  const currentValue = status?.currentValue ?? indexData?.currentValue ?? 0
  const imoex = indexData?.imoex

  return (
    <div className="min-h-screen bg-bg-primary text-white pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-[1000px] mx-auto">
        <div className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold gradient-text">Индекс настроения</h1>
              <p className="text-text-secondary text-sm mt-1">
                Голосуйте каждые 30 минут и открывайте график настроения сообщества
              </p>
            </div>
            <div className={`text-right transition-all duration-500 ${displayState === 'voting' ? 'opacity-0 blur-[8px]' : ''}`}>
              <div className="text-xs uppercase tracking-wider text-text-muted">Текущий индекс</div>
              <div
                className="text-4xl font-bold tabular-nums"
                style={{ color: sentimentColor(currentValue) }}
              >
                {currentValue > 0 ? '+' : ''}{currentValue}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="relative h-[320px] md:h-[380px] rounded-2xl bg-black/20 border border-white/5 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={sentimentColor(currentValue)} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={sentimentColor(currentValue)} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tickFormatter={(v: string) => formatTime(v)}
                  stroke="#6b7280"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  minTickGap={30}
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  scale="time"
                />
                <YAxis
                  yAxisId="left"
                  stroke="#6b7280"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#f59e0b"
                  tick={{ fill: '#f59e0b', fontSize: 11 }}
                  domain={[imoex ? imoex.current - 100 : 'auto', imoex ? imoex.current + 100 : 'auto']}
                />
                <Tooltip
                  contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                  labelFormatter={(l: any) => formatTime(l)}
                  formatter={(value: any, name: string) => [value, name === 'value' ? 'Индекс' : 'IMOEX']}
                />
                {sessionBounds && (
                  <ReferenceArea
                    x1={sessionBounds.start}
                    x2={sessionBounds.end}
                    fill="rgba(245, 158, 11, 0.05)"
                  />
                )}
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="value"
                  stroke={sentimentColor(currentValue)}
                  strokeWidth={2.5}
                  fill="url(#sentimentGradient)"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="imoex"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* S0: blur right half for anonymous */}
            {displayState === 'anonymous' && (
              <div
                className="absolute inset-y-0 right-0 w-1/2 z-20 flex flex-col items-center justify-center gap-4 px-6 text-center border-l border-white/10"
                style={{
                  backdropFilter: 'blur(40px) saturate(0.5) brightness(0.55)',
                  WebkitBackdropFilter: 'blur(40px) saturate(0.5) brightness(0.55)',
                  background:
                    'linear-gradient(90deg, rgba(11,15,25,0.45) 0%, rgba(11,15,25,0.92) 40%, rgba(11,15,25,0.98) 100%)',
                  boxShadow: 'inset 8px 0 40px rgba(0,0,0,0.45), -12px 0 40px rgba(0,0,0,0.25)',
                }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <Lock size={24} className="text-text-secondary" />
                </div>
                <div>
                  <div className="font-semibold text-white drop-shadow-lg">Актуальная динамика скрыта</div>
                  <div className="text-xs text-text-secondary mt-1 drop-shadow-md">Войдите, чтобы видеть график в реальном времени</div>
                </div>
                <button
                  onClick={() => open('login')}
                  className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-medium transition-all"
                >
                  Войти в аккаунт
                </button>
              </div>
            )}

            {/* S2: voting overlay */}
            {displayState === 'voting' && (
              <div className="absolute inset-0 bg-[#0b0f19]/85 backdrop-blur-[40px] flex flex-col items-center justify-center gap-5 px-6 text-center">
                <div className="text-lg font-semibold text-white">Как вы оцениваете рынок?</div>
                <div className="text-xs text-text-secondary">🎯 Голосование вслепую: вы не видите текущий индекс до голоса</div>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={() => handleVote(1)}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 hover:bg-[#34D399]/10 border border-white/10 hover:border-[#34D399]/40 text-text-success transition-all font-medium"
                  >
                    <TrendingUp size={18} /> Позитивно
                  </button>
                  <button
                    onClick={() => handleVote(0)}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 text-text-secondary transition-all font-medium"
                  >
                    <Minus size={18} /> Нейтрально
                  </button>
                  <button
                    onClick={() => handleVote(-1)}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 hover:bg-[#EF4444]/10 border border-white/10 hover:border-[#EF4444]/40 text-text-error transition-all font-medium"
                  >
                    <TrendingDown size={18} /> Негативно
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Timer (S1) */}
          {displayState === 'active' && (
            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#34D399' }} />
                Активный доступ
              </div>
              <div className={`font-mono text-lg font-semibold tabular-nums ${secondsLeft <= 300 ? 'text-text-error' : 'text-text-success'}`}>
                {formatCountdown(secondsLeft)}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-5 flex items-center gap-6 text-xs text-text-secondary">
            <div className="flex items-center gap-2">
              <span className="w-4 h-1 rounded-full" style={{ background: sentimentColor(currentValue) }} />
              Индекс настроения
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-1 rounded-full bg-amber-500" style={{ background: '#f59e0b' }} />
              IMOEX (mock)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-amber-500/10 border border-amber-500/20" />
              Сессия МосБиржи
            </div>
          </div>
        </div>

        {/* Minimal community metrics for MVP */}
        {status?.community && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <Metric label="Онлайн" value={status.community.onlineNow} />
            <Metric label="Голосов сегодня" value={status.community.votesToday} />
            <Metric label="Позитивных" value={status.community.distribution.positive} />
            <Metric label="Негативных" value={status.community.distribution.negative} />
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      <div className="text-xs text-text-secondary mt-1">{label}</div>
    </div>
  )
}
