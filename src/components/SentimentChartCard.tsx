import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
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
import VoteToast, { type VoteToastVariant } from './VoteToast'

const SSE_URL = import.meta.env.VITE_API_URL || 'https://pulse-api-bsov.onrender.com'
const IMOEX_MOCK_VALUE = 2200

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

function formatDateTime(value: number | string) {
  const d = new Date(value)
  return d.toLocaleString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })
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

const sentimentConfig = {
  positive: {
    glassBg: 'linear-gradient(180deg, rgba(52,211,153,0.06) 0%, rgba(52,211,153,0.02) 100%)',
    glassBorder: 'rgba(52, 211, 153, 0.15)',
    glassBorderHover: 'rgba(52, 211, 153, 0.35)',
    glowShadow: '0 4px 20px -4px rgba(52, 211, 153, 0.15), inset 0 -1px 0 0 rgba(52, 211, 153, 0.1)',
    glowShadowHover: '0 8px 30px -4px rgba(52, 211, 153, 0.25), inset 0 -1px 0 0 rgba(52, 211, 153, 0.2)',
    color: '#34D399',
  },
  negative: {
    glassBg: 'linear-gradient(180deg, rgba(239,68,68,0.06) 0%, rgba(239,68,68,0.02) 100%)',
    glassBorder: 'rgba(239, 68, 68, 0.15)',
    glassBorderHover: 'rgba(239, 68, 68, 0.35)',
    glowShadow: '0 4px 20px -4px rgba(239, 68, 68, 0.15), inset 0 -1px 0 0 rgba(239, 68, 68, 0.1)',
    glowShadowHover: '0 8px 30px -4px rgba(239, 68, 68, 0.25), inset 0 -1px 0 0 rgba(239, 68, 68, 0.2)',
    color: '#EF4444',
  },
  neutral: {
    glassBg: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    glassBorderHover: 'rgba(255, 255, 255, 0.20)',
    glowShadow: '0 2px 12px -4px rgba(0, 0, 0, 0.3)',
    glowShadowHover: '0 4px 20px -4px rgba(0, 0, 0, 0.4)',
    color: '#9CA3AF',
  },
}

interface SentimentChartCardProps {
  showMetrics?: boolean
  isHomeBlock?: boolean
}

export default function SentimentChartCard({ showMetrics = true, isHomeBlock = false }: SentimentChartCardProps) {
  const { isLoggedIn } = useAuth()
  const { open } = useAuthModal()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [indexData, setIndexData] = useState<SentimentData | null>(null)
  const [status, setStatus] = useState<StatusData | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [justVoted, setJustVoted] = useState(false)
  const [toast, setToast] = useState<{ variant: VoteToastVariant; message: string; icon: string; withConfetti: boolean } | null>(null)
  const sseRef = useRef<EventSource | null>(null)

  const displayState = useMemo(() => {
    if (!isLoggedIn) return 'anonymous'
    if (justVoted) return 'active'
    if (!status) return 'voting'
    return status.state
  }, [isLoggedIn, status, justVoted])

  const handleCardClick = () => {
    if (!isHomeBlock) return
    if (!isLoggedIn) {
      open('login')
      return
    }
    if (displayState === 'active') {
      navigate('/sentiment')
    }
  }

  const isClickable = isHomeBlock && (displayState === 'anonymous' || displayState === 'active')

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

      let variant: VoteToastVariant = 'contrarian'
      let message = 'Ваше мнение отличается — вы мыслите вне рамок'
      let icon = '🧠'
      let withConfetti = false

      if (value === 0 && result.newIndex === 0) {
        variant = 'balance'
        message = 'Вы держите баланс'
        icon = '⚖️'
      } else if (result.sync) {
        variant = 'sync'
        message = 'Вы в синхроне с настроением сообщества'
        icon = '🔥'
        withConfetti = true
      }

      setToast({ variant, message, icon, withConfetti })
      await Promise.all([fetchIndex(), fetchStatus()])
    } catch (err: any) {
      alert(err.message || 'Не удалось проголосовать')
    }
  }

  const chartData = useMemo(() => {
    const history = indexData?.history || [{ time: new Date().toISOString(), value: 0 }]
    const imoexCandles = indexData?.imoex?.candles || []

    // График не должен строиться в будущее. Обрезаем данные по текущему времени
    // или по последней реальной свече (если смотрим исторический день).
    const nowTs = Date.now()
    const lastCandleTs = imoexCandles.length > 0
      ? new Date(imoexCandles[imoexCandles.length - 1].time).getTime()
      : nowTs
    const clipTs = Math.min(nowTs, lastCandleTs)

    // Объединяем точки индекса и IMOEX, сохраняя последние известные значения
    const points = new Map<number, { value?: number; imoex?: number }>()

    for (const p of history) {
      const ts = new Date(p.time).getTime()
      if (ts > clipTs) continue
      const cur = points.get(ts) || {}
      cur.value = p.value
      points.set(ts, cur)
    }
    for (const c of imoexCandles) {
      const ts = new Date(c.time).getTime()
      if (ts > clipTs) continue
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

  const imoexDomain = useMemo<[number | string, number | string]>(() => {
    const candles = indexData?.imoex?.candles || []
    if (candles.length === 0) return ['auto', 'auto']
    const closes = candles.map(c => c.close)
    const min = Math.min(...closes)
    const max = Math.max(...closes)
    const pad = Math.max((max - min) * 0.1, min * 0.005)
    return [Math.floor(min - pad), Math.ceil(max + pad)]
  }, [indexData?.imoex?.candles])

  const timeDomain = useMemo<[number, number]>(() => {
    if (chartData.length === 0) return [Date.now() - 24 * 60 * 60 * 1000, Date.now()]
    return [chartData[0].time, chartData[chartData.length - 1].time]
  }, [chartData])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary text-white flex items-center justify-center pt-24">
        <div className="text-text-secondary">Загрузка индекса настроения…</div>
      </div>
    )
  }

  const currentValue = status?.currentValue ?? indexData?.currentValue ?? 0
  const sentimentType = currentValue > 0 ? 'positive' : currentValue < 0 ? 'negative' : 'neutral'
  const config = sentimentConfig[sentimentType]

  if (loading) {
    return (
      <div className="w-full rounded-xl p-8 flex items-center justify-center text-text-secondary" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        Загрузка индекса настроения…
      </div>
    )
  }

  return (
    <div
      className={`w-full ${isClickable ? 'cursor-pointer' : ''}`}
      onClick={handleCardClick}
    >
      <div
          className="rounded-xl pt-1.5 md:pt-2 px-3 md:px-4 pb-3 md:pb-4 relative overflow-hidden transition-all duration-300 group"
          style={{
            background: config.glassBg,
            border: `1px solid ${config.glassBorder}`,
            boxShadow: config.glowShadow,
            backdropFilter: 'blur(12px) saturate(180%)',
            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = config.glassBorderHover
            e.currentTarget.style.boxShadow = config.glowShadowHover
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = config.glassBorder
            e.currentTarget.style.boxShadow = config.glowShadow
          }}
        >
          {/* Liquid glass highlight line at top */}
          <div
            className="absolute top-0 left-4 right-4 h-px opacity-60"
            style={{ background: `linear-gradient(90deg, transparent, ${config.color}, transparent)` }}
          />
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start mb-0.5">
            <div className="w-full">
              <h1 className="text-2xl md:text-3xl font-bold gradient-text">Индекс настроения</h1>
              <p className="text-text-secondary text-sm mt-1 w-full">
                Голосуйте каждые 30 минут и открывайте график настроения сообщества
              </p>
            </div>
            <div className={`mt-4 md:mt-0 text-left md:text-right transition-all duration-500 ${displayState === 'voting' ? 'opacity-0 blur-[8px]' : ''}`}>
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
          <div className="relative h-[235px] md:h-[254px] rounded-2xl bg-black/20 border border-white/5 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 3, left: 3, bottom: 0 }}>
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
                  domain={timeDomain}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#f59e0b"
                  tick={{ fill: '#f59e0b', fontSize: 11 }}
                  domain={imoexDomain}
                  width={55}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke={sentimentColor(currentValue)}
                  tick={{ fill: sentimentColor(currentValue), fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                  labelFormatter={(l: any) => formatDateTime(l)}
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
                  yAxisId="right"
                  type="monotone"
                  dataKey="value"
                  stroke={sentimentColor(currentValue)}
                  strokeWidth={2.5}
                  fill="url(#sentimentGradient)"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="left"
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
                className="absolute inset-y-2 right-2 w-[calc(50%-16px)] z-20 flex flex-col items-center justify-center gap-2 md:gap-4 px-2 md:px-6 text-center rounded-xl border border-white/10"
                style={{
                  backdropFilter: 'blur(40px) saturate(0.5) brightness(0.55)',
                  WebkitBackdropFilter: 'blur(40px) saturate(0.5) brightness(0.55)',
                  background:
                    'linear-gradient(90deg, rgba(11,15,25,0.45) 0%, rgba(11,15,25,0.92) 40%, rgba(11,15,25,0.98) 100%)',
                  boxShadow: 'inset 8px 0 40px rgba(0,0,0,0.45), -12px 0 40px rgba(0,0,0,0.25)',
                }}
              >
                <div
                  className="mt-2 md:mt-0 w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-2xl"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <Lock size={20} className="md:w-6 md:h-6 text-text-secondary" />
                </div>
                <div>
                  <div className="font-semibold text-white drop-shadow-lg text-xs md:text-sm">Актуальная динамика скрыта</div>
                  <div className="text-[10px] md:text-xs text-text-secondary mt-1 drop-shadow-md">Войдите, чтобы видеть график в реальном времени</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    open('login')
                  }}
                  className="text-xs md:text-sm font-medium px-6 md:px-5 py-2 rounded-pill transition-all duration-200 hover:brightness-115"
                  style={{
                    background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                    color: '#060606',
                  }}
                >
                  Войти
                </button>
              </div>
            )}

            {/* S2: voting overlay */}
            {displayState === 'voting' && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-4 md:gap-5 px-4 md:px-6 text-center border border-white/10"
                style={{
                  background: 'rgba(6, 6, 6, 0.94)',
                  backdropFilter: 'blur(72px) saturate(180%) brightness(0.65)',
                  WebkitBackdropFilter: 'blur(72px) saturate(180%) brightness(0.65)',
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.06), 0 0 80px rgba(0,0,0,0.55)',
                }}
              >
                {/* Liquid glass highlight line */}
                <div
                  className="absolute top-0 left-4 right-4 h-px opacity-40"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }}
                />
                <div className="relative z-10 text-lg font-semibold text-white">Как вы оцениваете рынок?</div>
                <div className="relative z-10 text-xs text-text-secondary">🎯 Голосование вслепую: вы не видите текущий индекс до голоса</div>
                <div className="relative z-10 flex flex-wrap justify-center gap-2 md:gap-3">
                  <button
                    onClick={() => handleVote(1)}
                    className="flex items-center gap-1.5 md:gap-2 px-5 py-2.5 md:px-6 md:py-3 rounded-2xl bg-white/5 hover:bg-[#34D399]/10 border border-white/10 hover:border-[#34D399]/40 text-text-success transition-all font-medium text-xs md:text-sm"
                  >
                    <TrendingUp size={16} /> Позитивно
                  </button>
                  <button
                    onClick={() => handleVote(0)}
                    className="flex items-center gap-1.5 md:gap-2 px-5 py-2.5 md:px-6 md:py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 text-text-secondary transition-all font-medium text-xs md:text-sm"
                  >
                    <Minus size={16} /> Нейтрально
                  </button>
                  <button
                    onClick={() => handleVote(-1)}
                    className="flex items-center gap-1.5 md:gap-2 px-5 py-2.5 md:px-6 md:py-3 rounded-2xl bg-white/5 hover:bg-[#EF4444]/10 border border-white/10 hover:border-[#EF4444]/40 text-text-error transition-all font-medium text-xs md:text-sm"
                  >
                    <TrendingDown size={16} /> Негативно
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Legend + Timer in one row */}
          <div className="mt-5 hidden md:flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-xs text-text-secondary">
            <div className="flex items-center flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 rounded-full" style={{ background: sentimentColor(currentValue) }} />
                Индекс настроения
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 rounded-full bg-amber-500" style={{ background: '#f59e0b' }} />
                IMOEX
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-amber-500/10 border border-amber-500/20" />
                Сессия МосБиржи
              </div>
            </div>
            {displayState === 'active' && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#34D399' }} />
                  Активный доступ
                </div>
                <div className={`font-mono text-lg font-semibold tabular-nums ${secondsLeft <= 300 ? 'text-text-error' : 'text-text-success'}`}>
                  {formatCountdown(secondsLeft)}
                </div>
              </div>
            )}
          </div>

          {/* Bottom glow line */}
          {sentimentType !== 'neutral' && (
            <div
              className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full opacity-40 group-hover:opacity-70 transition-opacity"
              style={{ background: `linear-gradient(90deg, transparent, ${config.color}, transparent)` }}
            />
          )}
        </div>

        {/* Minimal community metrics for MVP */}
        {showMetrics && status?.community && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <Metric label="Онлайн" value={status.community.onlineNow} />
            <Metric label="Голосов сегодня" value={status.community.votesToday} />
            <Metric label="Позитивных" value={status.community.distribution.positive} />
            <Metric label="Негативных" value={status.community.distribution.negative} />
          </div>
        )}

        {/* Vote feedback toast */}
        {toast && (
          <VoteToast
            variant={toast.variant}
            message={toast.message}
            icon={toast.icon}
            withConfetti={toast.withConfetti}
            onDone={() => setToast(null)}
          />
        )}
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
