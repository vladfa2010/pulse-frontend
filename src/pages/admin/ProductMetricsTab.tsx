import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import {
  BarChart3,
  RefreshCw,
  Users,
  TrendingUp,
  DollarSign,
  Activity,
  Bell,
  Smartphone,
  Globe,
  Layers,
  AlertTriangle,
  Tag,
  MousePointerClick,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface OverviewMetrics {
  total_users: number
  dau: number
  wau: number
  mau: number
  new_users_today: number
  new_users_week: number
  active_subscriptions: number
  push_subscribers: number
  total_revenue: number
}

interface DailyPoint {
  date: string
  dau: number
  new_users: number
}

interface SignupPoint {
  date: string
  signups: number
}

interface FunnelStep {
  step: string
  count: number
  pct_of_prev: number
  pct_of_total: number
}

interface RetentionRow {
  cohort: string
  d1: number
  d7: number
  d30: number
}

interface LabelValue {
  label: string
  value: number
}

interface SentimentDistribution {
  bullish: number
  neutral: number
  bearish: number
}

interface SentimentMetrics {
  total_votes: number
  unique_voters: number
  avg_streak: number
  distribution: SentimentDistribution
}

interface PushStats {
  sent: number
  opened: number
  ctr: number
  daily: { date: string; sent: number }[]
}

interface CohortLTV {
  cohort: string
  users: number
  ltv: number
}

interface Distribution {
  label: string
  value: number
}

interface FeatureAdoptionMetric {
  count: number
  pct: number
}

interface FeatureAdoption {
  push: FeatureAdoptionMetric
  telegram: FeatureAdoptionMetric
  sentiment: FeatureAdoptionMetric
  premium: FeatureAdoptionMetric
}

interface AnalyticsData {
  overview: OverviewMetrics
  daily_activity: DailyPoint[]
  signup_trend: SignupPoint[]
  funnel: FunnelStep[]
  retention: RetentionRow[]
  top_tags: LabelValue[]
  top_countries: LabelValue[]
  devices: LabelValue[]
  platforms: LabelValue[]
  at_risk: {
    dormant_7d: number
    dormant_30d: number
    no_tags: number
    sub_expiring_7d: number
  }
  sentiment: SentimentMetrics
  push_stats: PushStats
  avg_tags: number
  tag_distribution: LabelValue[]
  cohort_ltv: CohortLTV[]
  ltv_trend: { cohort: string; ltv: number }[]
  ttfp: { distribution: Distribution[] }
  conversion_velocity: { buckets: Distribution[] }
  feature_adoption: FeatureAdoption
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n)
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border p-5 ${className}`}
      style={{ backgroundColor: '#111111', borderColor: '#222222' }}
    >
      {children}
    </div>
  )
}

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon size={18} style={{ color: '#9CA3AF' }} />}
      <h3 className="text-sm font-semibold" style={{ color: '#9CA3AF' }}>
        {children}
      </h3>
    </div>
  )
}

function Kpi({ value, label, accent = '#34D399' }: { value: string | number; label: string; accent?: string }) {
  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: '#111111', borderColor: '#222222' }}>
      <p className="text-2xl font-bold" style={{ color: accent }}>
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
        {label}
      </p>
    </div>
  )
}

function HorizontalBarList({ items, color = '#34D399' }: { items: LabelValue[]; color?: string }) {
  if (!items.length) {
    return <p className="text-sm" style={{ color: '#6B7280' }}>Нет данных</p>
  }
  const max = Math.max(...items.map((i) => i.value))
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs font-medium w-24 truncate text-right" style={{ color: '#9CA3AF' }}>
            {item.label}
          </span>
          <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${max ? (item.value / max) * 100 : 0}%`, backgroundColor: color, minWidth: item.value ? 2 : 0 }}
            />
          </div>
          <span className="text-xs font-bold w-8 text-right" style={{ color: '#FFFFFF' }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChartEmpty() {
  return (
    <div className="flex items-center justify-center h-48 rounded-lg" style={{ backgroundColor: '#0A0A0A' }}>
      <span className="text-xs" style={{ color: '#6B7280' }}>Нет данных</span>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw size={20} className="animate-spin mr-2" style={{ color: '#60A5FA' }} />
      <span className="text-sm" style={{ color: '#9CA3AF' }}>Загрузка метрик...</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function ProductMetricsTab() {
  const [period, setPeriod] = useState<number>(30)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.get(`/admin/analytics?period=${period}`)
      setData(res)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('[ProductMetrics] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) return <Loading />

  const overview = data?.overview

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} style={{ color: '#9CA3AF' }} />
          <h2 className="text-lg font-bold">Product Metrics</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border p-1" style={{ borderColor: '#222222' }}>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  backgroundColor: period === d ? '#222222' : 'transparent',
                  color: period === d ? '#FFFFFF' : '#6B7280',
                }}
              >
                {d} дней
              </button>
            ))}
          </div>
          {lastRefresh && (
            <span className="text-xs" style={{ color: '#6B7280' }}>
              Обновлено: {lastRefresh.toLocaleTimeString('ru-RU')}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all hover:border-[#333333] disabled:opacity-50"
            style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>
      </div>

      {/* Overview */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Kpi value={overview.total_users} label="Всего пользователей" accent="#60A5FA" />
          <Kpi value={overview.dau} label="DAU" accent="#34D399" />
          <Kpi value={overview.wau} label="WAU" accent="#34D399" />
          <Kpi value={overview.mau} label="MAU" accent="#34D399" />
          <Kpi value={overview.active_subscriptions} label="Активные подписки" accent="#FBBF24" />
          <Kpi value={overview.push_subscribers} label="Push-подписчики" accent="#A78BFA" />
          <Kpi value={overview.new_users_today} label="Новые сегодня" accent="#60A5FA" />
          <Kpi value={overview.new_users_week} label="Новые за 7 дней" accent="#60A5FA" />
          <Kpi value={formatCurrency(overview.total_revenue)} label="Выручка за период" accent="#34D399" />
          <Kpi
            value={overview.total_users ? `${((overview.mau / overview.total_users) * 100).toFixed(1)}%` : '0%'}
            label="MAU / всего"
            accent="#9CA3AF"
          />
        </div>
      )}

      {/* Daily activity + signup trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle icon={Activity}>Активность (DAU + новые)</SectionTitle>
          {data?.daily_activity?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.daily_activity}>
                <CartesianGrid stroke="#222222" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333333', color: '#FFFFFF' }}
                  itemStyle={{ color: '#FFFFFF' }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <Legend wrapperStyle={{ color: '#9CA3AF' }} />
                <Line type="monotone" dataKey="dau" name="DAU" stroke="#34D399" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="new_users" name="Новые" stroke="#60A5FA" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </Card>

        <Card>
          <SectionTitle icon={TrendingUp}>Регистрации по дням</SectionTitle>
          {data?.signup_trend?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.signup_trend}>
                <CartesianGrid stroke="#222222" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333333', color: '#FFFFFF' }}
                  itemStyle={{ color: '#FFFFFF' }}
                />
                <Line type="monotone" dataKey="signups" name="Регистрации" stroke="#A78BFA" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </Card>
      </div>

      {/* Funnel */}
      <Card>
        <SectionTitle icon={MousePointerClick}>Воронка (последние {period} дней)</SectionTitle>
        {data?.funnel?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#0A0A0A' }}>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>Шаг</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#6B7280' }}>Количество</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#6B7280' }}>% от предыдущего</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#6B7280' }}>% от регистраций</th>
                </tr>
              </thead>
              <tbody>
                {data.funnel.map((step) => (
                  <tr key={step.step} className="hover:bg-[#161616]" style={{ borderTop: '1px solid #1a1a1a' }}>
                    <td className="px-4 py-3 text-sm" style={{ color: '#FFFFFF' }}>{step.step}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono" style={{ color: '#FFFFFF' }}>{step.count}</td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: step.pct_of_prev > 50 ? '#34D399' : '#FBBF24' }}>
                      {step.pct_of_prev}%
                    </td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: '#9CA3AF' }}>{step.pct_of_total}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#6B7280' }}>Нет данных</p>
        )}
      </Card>

      {/* Retention */}
      <Card>
        <SectionTitle icon={Users}>Retention по когортам</SectionTitle>
        {data?.retention?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#0A0A0A' }}>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>Когорта</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#6B7280' }}>D1</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#6B7280' }}>D7</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#6B7280' }}>D30</th>
                </tr>
              </thead>
              <tbody>
                {data.retention.map((row) => (
                  <tr key={row.cohort} className="hover:bg-[#161616]" style={{ borderTop: '1px solid #1a1a1a' }}>
                    <td className="px-4 py-3 text-sm" style={{ color: '#FFFFFF' }}>{formatDateShort(row.cohort)}</td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: row.d1 > 30 ? '#34D399' : '#FBBF24' }}>{row.d1}%</td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: row.d7 > 20 ? '#34D399' : '#FBBF24' }}>{row.d7}%</td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: row.d30 > 10 ? '#34D399' : '#FBBF24' }}>{row.d30}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#6B7280' }}>Нет данных</p>
        )}
      </Card>

      {/* Lists grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <SectionTitle icon={Tag}>Топ тегов</SectionTitle>
          <HorizontalBarList items={data?.top_tags || []} color="#34D399" />
        </Card>
        <Card>
          <SectionTitle icon={Globe}>Страны</SectionTitle>
          <HorizontalBarList items={data?.top_countries || []} color="#60A5FA" />
        </Card>
        <Card>
          <SectionTitle icon={Smartphone}>Устройства</SectionTitle>
          <HorizontalBarList items={data?.devices || []} color="#A78BFA" />
        </Card>
        <Card>
          <SectionTitle icon={Layers}>Платформы</SectionTitle>
          <HorizontalBarList items={data?.platforms || []} color="#FBBF24" />
        </Card>
      </div>

      {/* At risk */}
      <Card>
        <SectionTitle icon={AlertTriangle}>Группы риска</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi value={data?.at_risk?.dormant_7d || 0} label="Не заходили 7 дней" accent="#FBBF24" />
          <Kpi value={data?.at_risk?.dormant_30d || 0} label="Не заходили 30 дней" accent="#EF4444" />
          <Kpi value={data?.at_risk?.no_tags || 0} label="Без тегов" accent="#9CA3AF" />
          <Kpi value={data?.at_risk?.sub_expiring_7d || 0} label="Подписка истекает 7 дней" accent="#FBBF24" />
        </div>
      </Card>

      {/* Sentiment + push */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle icon={Activity}>Сентимент</SectionTitle>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Kpi value={data?.sentiment?.total_votes || 0} label="Всего голосов" accent="#60A5FA" />
            <Kpi value={data?.sentiment?.unique_voters || 0} label="Участников" accent="#34D399" />
            <Kpi value={data?.sentiment?.avg_streak.toFixed(1) || 0} label="Средняя серия" accent="#FBBF24" />
          </div>
          {data?.sentiment?.distribution && (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { label: 'Bullish', value: data.sentiment.distribution.bullish, color: '#34D399' },
                    { label: 'Neutral', value: data.sentiment.distribution.neutral, color: '#9CA3AF' },
                    { label: 'Bearish', value: data.sentiment.distribution.bearish, color: '#EF4444' },
                  ]}
                >
                  <CartesianGrid stroke="#222222" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333333' }} cursor={{ fill: '#222222' }} />
                  <Bar dataKey="value" fill="#34D399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle icon={Bell}>Push-уведомления</SectionTitle>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Kpi value={data?.push_stats?.sent || 0} label="Отправлено" accent="#60A5FA" />
            <Kpi value={data?.push_stats?.opened || 0} label="Открыто (уник)" accent="#34D399" />
            <Kpi value={`${data?.push_stats?.ctr || 0}%`} label="CTR" accent="#FBBF24" />
          </div>
          {data?.push_stats?.daily?.length ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={data.push_stats.daily}>
                <CartesianGrid stroke="#222222" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333333' }} />
                <Line type="monotone" dataKey="sent" name="Push" stroke="#A78BFA" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </Card>
      </div>

      {/* Avg tags + distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <SectionTitle icon={Tag}>Среднее число тегов</SectionTitle>
          <p className="text-4xl font-bold" style={{ color: '#34D399' }}>
            {data?.avg_tags?.toFixed(2) || '0.00'}
          </p>
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>на пользователя</p>
        </Card>
        <Card className="lg:col-span-2">
          <SectionTitle icon={Layers}>Распределение тегов</SectionTitle>
          {data?.tag_distribution?.length ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.tag_distribution}>
                  <CartesianGrid stroke="#222222" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333333' }} cursor={{ fill: '#222222' }} />
                  <Bar dataKey="value" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty />
          )}
        </Card>
      </div>

      {/* LTV */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle icon={DollarSign}>LTV по когортам</SectionTitle>
          {data?.cohort_ltv?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#0A0A0A' }}>
                    <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>Когорта</th>
                    <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#6B7280' }}>Пользователей</th>
                    <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: '#6B7280' }}>LTV</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cohort_ltv.map((row) => (
                    <tr key={row.cohort} className="hover:bg-[#161616]" style={{ borderTop: '1px solid #1a1a1a' }}>
                      <td className="px-4 py-3 text-sm" style={{ color: '#FFFFFF' }}>{formatDateShort(row.cohort)}</td>
                      <td className="px-4 py-3 text-right text-sm" style={{ color: '#FFFFFF' }}>{row.users}</td>
                      <td className="px-4 py-3 text-right text-sm font-mono" style={{ color: '#34D399' }}>{formatCurrency(row.ltv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#6B7280' }}>Нет данных</p>
          )}
        </Card>

        <Card>
          <SectionTitle icon={TrendingUp}>Динамика LTV</SectionTitle>
          {data?.ltv_trend?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.ltv_trend}>
                <CartesianGrid stroke="#222222" vertical={false} />
                <XAxis dataKey="cohort" tickFormatter={formatDateShort} tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333333' }} />
                <Line type="monotone" dataKey="ltv" name="LTV" stroke="#34D399" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </Card>
      </div>

      {/* TTF + conversion velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle icon={DollarSign}>Время до первой оплаты</SectionTitle>
          {data?.ttfp?.distribution?.length ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.ttfp.distribution}>
                  <CartesianGrid stroke="#222222" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333333' }} cursor={{ fill: '#222222' }} />
                  <Bar dataKey="value" fill="#FBBF24" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty />
          )}
        </Card>

        <Card>
          <SectionTitle icon={MousePointerClick}>Скорость конверсии</SectionTitle>
          {data?.conversion_velocity?.buckets?.length ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.conversion_velocity.buckets}>
                  <CartesianGrid stroke="#222222" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333333' }} cursor={{ fill: '#222222' }} />
                  <Bar dataKey="value" fill="#34D399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty />
          )}
        </Card>
      </div>

      {/* Feature adoption */}
      <Card>
        <SectionTitle icon={Layers}>Внедрение фич</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data?.feature_adoption &&
            Object.entries(data.feature_adoption).map(([key, metric]) => (
              <div key={key} className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
                <p className="text-xs uppercase tracking-wider" style={{ color: '#6B7280' }}>
                  {key === 'push' && 'Push'}
                  {key === 'telegram' && 'Telegram'}
                  {key === 'sentiment' && 'Sentiment'}
                  {key === 'premium' && 'Premium'}
                </p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#34D399' }}>
                  {metric.count}
                </p>
                <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                  {metric.pct}% от пользователей
                </p>
              </div>
            ))}
        </div>
      </Card>
    </div>
  )
}
