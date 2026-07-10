import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router'
import { adminApi } from '@/lib/api'
import { createPortal } from 'react-dom'
import { RefreshCw, Download, Eye, RotateCcw, Ban, X, Users, Tag as TagLucide, Settings, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import UsersTab from './admin/UsersTab'
import ActivityFeed from './admin/ActivityFeed'
import UserDetailModal from './admin/UserDetailModal'
import TagsTab from './admin/TagsTab'
import TagDetailModal from './admin/TagDetailModal'
import SourcesSettingsTab from './admin/SourcesTab'

// ─── Types ───────────────────────────────────────────────────────────────────

interface LlmDashboard {
  today: {
    batches_total: number
    batches_success: number
    batches_partial: number
    batches_failed: number
    success_rate: number
    articles_processed: number
    articles_failed: number
    manual_queue: number
  }
  errors_by_type: { sentiment_source: string; count: number }[]
  hourly_trend: { hour: string; success: number; failed: number; partial: number }[]
  per_tag: { tag: string; articles: number; success: number }[]
}

interface FailedArticle {
  id: string
  title_ru: string
  published_at: string
  sentiment_source: string
  llm_error: string
  llm_attempts: number
  llm_raw_preview: string
  matched_tags: string[]
}

interface LlmErrorsResponse {
  total_failed: number
  by_type: { sentiment_source: string; count: number }[]
  manual_queue_count: number
  recent: FailedArticle[]
}

interface BackfillResult {
  processed: number
  succeeded: number
  failed: number
}

interface SourceStat {
  source: string
  total_articles: number
  tagged_articles: number
  untagged_articles: number
  llm_success: number
  llm_failed: number
  llm_timeout: number
  avg_sentiment: number
  last_article_at: string
  language: string
  top_tags: { tag: string; count: number }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getErrorBarColor(errorType: string): string {
  if (errorType === 'llm-timeout') return '#FBBF24'
  if (errorType === 'llm-rate-limit') return '#F59E0B'
  if (errorType === 'llm-parse') return '#EF4444'
  if (errorType === 'llm-empty') return '#9CA3AF'
  return '#EF4444'
}

function getSuccessRateColor(rate: number): string {
  if (rate >= 90) return '#34D399'
  if (rate >= 70) return '#FBBF24'
  return '#EF4444'
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string
  value: string | number
  subtitle: string
  accentColor: string
}

function KpiCard({ title, value, subtitle, accentColor }: KpiCardProps) {
  return (
    <div
      className="rounded-xl p-6 border transition-all hover:border-[#333333]"
      style={{ backgroundColor: '#111111', borderColor: '#222222' }}
    >
      <p className="text-sm font-medium" style={{ color: '#9CA3AF' }}>
        {title}
      </p>
      <p className="text-3xl font-bold mt-2" style={{ color: accentColor }}>
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
        {subtitle}
      </p>
    </div>
  )
}

// ─── SVG Chart ───────────────────────────────────────────────────────────────

interface HourlyPoint {
  hour: string
  success: number
  failed: number
  partial: number
}

function SuccessRateChart({ data }: { data: HourlyPoint[] }) {
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    point: HourlyPoint
  } | null>(null)

  const svgWidth = 800
  const svgHeight = 200
  const padding = { top: 10, right: 10, bottom: 30, left: 10 }
  const chartW = svgWidth - padding.left - padding.right
  const chartH = svgHeight - padding.top - padding.bottom

  const points = data.map((d, i) => {
    const total = d.success + d.failed + d.partial
    const rate = total === 0 ? 0 : (d.success / total) * 100
    return {
      x: padding.left + (i / (data.length - 1 || 1)) * chartW,
      y: padding.top + chartH - (rate / 100) * chartH,
      rate,
      data: d,
    }
  })

  // Grid lines
  const gridLines = [0, 25, 50, 75, 100].map((pct) => ({
    y: padding.top + chartH - (pct / 100) * chartH,
    label: `${pct}%`,
  }))

  // Path for line
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  // Path for area fill
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? 0} ${
    padding.top + chartH
  } L ${points[0]?.x ?? 0} ${padding.top + chartH} Z`

  return (
    <div className="relative w-full" style={{ height: svgHeight }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34D399" stopOpacity={0.1} />
            <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridLines.map((g) => (
          <g key={g.label}>
            <line
              x1={padding.left}
              y1={g.y}
              x2={svgWidth - padding.right}
              y2={g.y}
              stroke="#222222"
              strokeWidth={1}
            />
            <text
              x={padding.left - 4}
              y={g.y - 2}
              fill="#6B7280"
              fontSize={9}
              textAnchor="end"
            >
              {g.label}
            </text>
          </g>
        ))}

        {/* Hour labels */}
        {data.map((d, i) => {
          if (i % 2 !== 0) return null
          const x =
            padding.left + (i / (data.length - 1 || 1)) * chartW
          return (
            <text
              key={d.hour}
              x={x}
              y={svgHeight - 4}
              fill="#6B7280"
              fontSize={9}
              textAnchor="middle"
            >
              {d.hour.slice(-5)}
            </text>
          )
        })}

        {/* Area fill */}
        {points.length > 0 && (
          <path d={areaPath} fill="url(#areaGrad)" />
        )}

        {/* Line */}
        {points.length > 0 && (
          <path
            d={linePath}
            fill="none"
            stroke="#34D399"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="#111111"
            stroke="#34D399"
            strokeWidth={2}
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => {
              const rect = (
                e.target as SVGCircleElement
              ).getBoundingClientRect()
              const parent = (
                e.target as SVGCircleElement
              ).closest('svg')?.getBoundingClientRect()
              if (parent) {
                setTooltip({
                  x: rect.left - parent.left,
                  y: rect.top - parent.top,
                  point: p.data,
                })
              }
            }}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-lg px-3 py-2 text-xs border"
          style={{
            left: tooltip.x,
            top: tooltip.y - 80,
            transform: 'translateX(-50%)',
            backgroundColor: '#1a1a1a',
            borderColor: '#333333',
            color: '#FFFFFF',
          }}
        >
          <div className="font-medium" style={{ color: '#9CA3AF' }}>
            {tooltip.point.hour}
          </div>
          <div style={{ color: '#34D399' }}>
            Success: {tooltip.point.success}
          </div>
          <div style={{ color: '#EF4444' }}>
            Failed: {tooltip.point.failed}
          </div>
          <div style={{ color: '#FBBF24' }}>
            Partial: {tooltip.point.partial}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Error Bars ──────────────────────────────────────────────────────────────

function ErrorBars({
  errors,
}: {
  errors: { sentiment_source: string; count: number }[]
}) {
  if (errors.length === 0) return null
  const maxCount = Math.max(...errors.map((e) => e.count))

  return (
    <div className="space-y-3">
      {errors.map((e) => {
        const pct = maxCount === 0 ? 0 : (e.count / maxCount) * 100
        const color = getErrorBarColor(e.sentiment_source)
        return (
          <div key={e.sentiment_source} className="flex items-center gap-3">
            <span
              className="text-xs font-medium shrink-0 w-28 truncate text-right"
              style={{ color: '#9CA3AF' }}
            >
              {e.sentiment_source}
            </span>
            <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                  minWidth: e.count > 0 ? '4px' : '0px',
                }}
              />
            </div>
            <span
              className="text-xs font-bold shrink-0 w-8 text-right"
              style={{ color }}
            >
              {e.count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Raw Preview Modal ───────────────────────────────────────────────────────

function RawPreviewModal({
  raw,
  onClose,
}: {
  raw: string
  onClose: () => void
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  let formatted = raw
  try {
    formatted = JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    // raw is not JSON, display as-is
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-xl border overflow-hidden flex flex-col"
        style={{
          width: '80vw',
          height: '80vh',
          backgroundColor: '#111111',
          borderColor: '#222222',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: '#222222' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
            Raw LLM Response
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors hover:bg-[#222222]"
            style={{ color: '#9CA3AF' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          <pre
            className="text-xs leading-relaxed whitespace-pre-wrap break-all font-mono"
            style={{ color: '#D1D5DB' }}
          >
            {formatted}
          </pre>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Sources Tab ─────────────────────────────────────────────────────────────

function SourcesTab({ hours }: { hours: number }) {
  const [sources, setSources] = useState<SourceStat[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.get(`/admin/source-stats?hours=${hours}`)
      setSources(data.sources || [])
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Source stats load error:', err)
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => {
    load()
  }, [load])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  if (loading && sources.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={20} className="animate-spin mr-2" style={{ color: '#60A5FA' }} />
        <span className="text-sm" style={{ color: '#9CA3AF' }}>Loading sources...</span>
      </div>
    )
  }

  if (sources.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm" style={{ color: '#6B7280' }}>No source data available</span>
      </div>
    )
  }

  return (
    <div>
      {/* Summary row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: '#9CA3AF' }}>
            {sources.length} sources
          </span>
          <span className="text-sm" style={{ color: '#6B7280' }}>
            {sources.reduce((s, x) => s + x.total_articles, 0)} articles
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs" style={{ color: '#6B7280' }}>
              Last updated: {formatDate(lastRefresh.toISOString())}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all hover:border-[#333333] disabled:opacity-50"
            style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Sources table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#111111', borderColor: '#222222' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#0A0A0A' }}>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Source</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>Lang</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Tagged</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Untagged</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>LLM OK</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>LLM Fail</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Timeout</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-28" style={{ color: '#6B7280' }}>Avg Sent</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Top Tags</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const llmRate = s.total_articles > 0 ? Math.round((s.llm_success / s.total_articles) * 100) : 0
                return (
                  <tr key={s.source} className="transition-colors hover:bg-[#161616]" style={{ borderTop: '1px solid #1a1a1a' }}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{s.source}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>
                        Last: {s.last_article_at ? formatDate(s.last_article_at) : '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        backgroundColor: s.language === 'en' ? '#2563EB22' : '#F59E0B22',
                        color: s.language === 'en' ? '#60A5FA' : '#FBBF24'
                      }}>
                        {s.language?.toUpperCase() || 'RU'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{s.total_articles}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm" style={{ color: '#34D399' }}>{s.tagged_articles}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm" style={{ color: s.untagged_articles > 0 ? '#FBBF24' : '#6B7280' }}>{s.untagged_articles}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#222222' }}>
                          <div className="h-full rounded-full" style={{ width: `${llmRate}%`, backgroundColor: llmRate >= 80 ? '#34D399' : llmRate >= 50 ? '#FBBF24' : '#EF4444' }} />
                        </div>
                        <span className="text-xs font-mono w-8 text-right" style={{ color: '#9CA3AF' }}>{s.llm_success}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm" style={{ color: s.llm_failed > 0 ? '#EF4444' : '#6B7280' }}>{s.llm_failed}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm" style={{ color: s.llm_timeout > 0 ? '#FBBF24' : '#6B7280' }}>{s.llm_timeout}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono" style={{
                        color: s.avg_sentiment > 0 ? '#34D399' : s.avg_sentiment < 0 ? '#EF4444' : '#9CA3AF'
                      }}>
                        {s.avg_sentiment > 0 ? '+' : ''}{s.avg_sentiment}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(s.top_tags || []).map((t) => (
                          <span key={t.tag} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#1a1a1a', color: '#9CA3AF' }}>
                            {t.tag} ({t.count})
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Admin() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  // Guard redirect
  useEffect(() => {
    if (!isLoading && !user?.isAdmin) {
      navigate('/')
    }
  }, [isLoading, user, navigate])

  // ── State ──────────────────────────────────────────────────────────────

  const [dashboard, setDashboard] = useState<LlmDashboard | null>(null)
  const [errorsData, setErrorsData] = useState<LlmErrorsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Raw preview modal
  const [rawPreview, setRawPreview] = useState<string | null>(null)

  // Backfill
  const [backfillTag, setBackfillTag] = useState('')
  const [backfillIds, setBackfillIds] = useState('')
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(
    null
  )
  const [backfillLoading, setBackfillLoading] = useState(false)

  // Cleanup failed articles
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [showCleanupSuccess, setShowCleanupSuccess] = useState(false)
  const [cleanupCount, setCleanupCount] = useState(0)

  const [activeTab, setActiveTab] = useState<'llm' | 'sources' | 'source_settings' | 'users' | 'tags'>('llm')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  // TZ_DELETE_SUCCESS_MODAL: force UsersTab refresh after delete
  const [usersRefreshKey, setUsersRefreshKey] = useState(0)

  const loadingRef = useRef(false)

  // ── Data Loading ───────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)

    try {
      const [dash, errs] = await Promise.all([
        adminApi.get('/admin/llm-dashboard'),
        adminApi.get('/admin/llm-errors?limit=20&hours=24'),
      ])
      setDashboard(dash)
      setErrorsData(errs)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Admin dashboard load error:', err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (user?.isAdmin) {
      loadData()
    }
  }, [user, loadData])

  // Auto-refresh every 60s
  useEffect(() => {
    if (!user?.isAdmin) return
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [user, loadData])

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (!errorsData?.recent) return
    const allIds = errorsData.recent.map((a) => a.id)
    const allSelected = allIds.every((id) => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  const handleRetrySelected = async () => {
    if (selectedIds.size === 0) return
    setBackfillLoading(true)
    try {
      const result = await adminApi.post('/admin/backfill', {
        newsIds: Array.from(selectedIds),
      })
      setBackfillResult(result)
      setSelectedIds(new Set())
      await loadData()
    } catch (err) {
      console.error('Retry failed:', err)
    } finally {
      setBackfillLoading(false)
    }
  }

  const handleIgnoreSelected = async () => {
    // For now, same as retry — backend can differentiate or we can add separate endpoint later
    if (selectedIds.size === 0) return
    setBackfillLoading(true)
    try {
      const result = await adminApi.post('/admin/backfill', {
        newsIds: Array.from(selectedIds),
      })
      setBackfillResult(result)
      setSelectedIds(new Set())
      await loadData()
    } catch (err) {
      console.error('Ignore failed:', err)
    } finally {
      setBackfillLoading(false)
    }
  }

  const handleRetrySingle = async (id: string) => {
    setBackfillLoading(true)
    try {
      const result = await adminApi.post('/admin/backfill', {
        newsIds: [id],
      })
      setBackfillResult(result)
      await loadData()
    } catch (err) {
      console.error('Retry single failed:', err)
    } finally {
      setBackfillLoading(false)
    }
  }

  const handleIgnoreSingle = async (id: string) => {
    setBackfillLoading(true)
    try {
      const result = await adminApi.post('/admin/backfill', {
        newsIds: [id],
      })
      setBackfillResult(result)
      await loadData()
    } catch (err) {
      console.error('Ignore single failed:', err)
    } finally {
      setBackfillLoading(false)
    }
  }

  const handleCleanup = async () => {
    setCleanupLoading(true)
    try {
      const result = await adminApi.post('/cleanup-failed-articles', {})
      setCleanupCount(result.deleted || 0)
      setShowCleanupConfirm(false)
      setShowCleanupSuccess(true)
      await loadData()
    } catch (err: any) {
      console.error('Cleanup failed:', err)
      alert(err.message || 'Cleanup failed')
    } finally {
      setCleanupLoading(false)
    }
  }

  const handleBackfill = async () => {
    const tag = backfillTag.trim()
    const ids = backfillIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (!tag && ids.length === 0) return

    setBackfillLoading(true)
    setBackfillResult(null)
    try {
      const payload = tag ? { tag } : { newsIds: ids }
      const result = await adminApi.post('/admin/backfill', payload)
      setBackfillResult(result)
      setBackfillTag('')
      setBackfillIds('')
      await loadData()
    } catch (err) {
      console.error('Backfill failed:', err)
    } finally {
      setBackfillLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (!errorsData?.recent || errorsData.recent.length === 0) return

    const headers = [
      'id',
      'title_ru',
      'error_type',
      'error_message',
      'attempts',
      'last_retry',
      'tags',
    ]
    const rows = errorsData.recent.map((a) => [
      a.id,
      `"${(a.title_ru || '').replace(/"/g, '""')}"`,
      a.sentiment_source,
      `"${(a.llm_error || '').replace(/"/g, '""')}"`,
      String(a.llm_attempts),
      a.published_at,
      `"${(a.matched_tags || []).join(', ')}"`,
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join(
      '\n'
    )
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `failed-articles-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // ── Render guards ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0A0A0A' }}
      >
        <div className="text-sm" style={{ color: '#9CA3AF' }}>
          Loading...
        </div>
      </div>
    )
  }

  if (!user?.isAdmin) return null

  const t = dashboard?.today

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#0A0A0A', color: '#FFFFFF' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
              LLM Processing Metrics & Error Tracking
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs" style={{ color: '#6B7280' }}>
                Last updated: {formatDate(lastRefresh.toISOString())}
              </span>
            )}
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all hover:border-[#333333] disabled:opacity-50"
              style={{
                backgroundColor: '#111111',
                borderColor: '#222222',
                color: '#9CA3AF',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              disabled={!errorsData?.recent?.length}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all hover:border-[#333333] disabled:opacity-50"
              style={{
                backgroundColor: '#111111',
                borderColor: '#222222',
                color: '#9CA3AF',
              }}
            >
              <Download size={14} />
              Export CSV
            </button>
            {activeTab === 'llm' && (
              <button
                onClick={() => setShowCleanupConfirm(true)}
                disabled={!errorsData?.total_failed}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all hover:border-[#EF4444] disabled:opacity-50"
                style={{
                  backgroundColor: '#111111',
                  borderColor: '#EF444433',
                  color: '#EF4444',
                }}
              >
                <Trash2 size={14} />
                Удалить ошибки
              </button>
            )}
          </div>
        </div>

        {/* ─── Tabs ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-6 rounded-lg p-1 border" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
          <button
            onClick={() => setActiveTab('llm')}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all"
            style={{
              backgroundColor: activeTab === 'llm' ? '#111111' : 'transparent',
              color: activeTab === 'llm' ? '#FFFFFF' : '#6B7280',
              border: activeTab === 'llm' ? '1px solid #222222' : '1px solid transparent',
            }}
          >
            LLM Metrics
          </button>
          <button
            onClick={() => setActiveTab('sources')}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all"
            style={{
              backgroundColor: activeTab === 'sources' ? '#111111' : 'transparent',
              color: activeTab === 'sources' ? '#FFFFFF' : '#6B7280',
              border: activeTab === 'sources' ? '1px solid #222222' : '1px solid transparent',
            }}
          >
            Sources
          </button>
          <button
            onClick={() => setActiveTab('source_settings')}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all"
            style={{
              backgroundColor: activeTab === 'source_settings' ? '#111111' : 'transparent',
              color: activeTab === 'source_settings' ? '#FFFFFF' : '#6B7280',
              border: activeTab === 'source_settings' ? '1px solid #222222' : '1px solid transparent',
            }}
          >
            <Settings size={13} className="inline mr-1" />
            Settings
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all"
            style={{
              backgroundColor: activeTab === 'users' ? '#111111' : 'transparent',
              color: activeTab === 'users' ? '#FFFFFF' : '#6B7280',
              border: activeTab === 'users' ? '1px solid #222222' : '1px solid transparent',
            }}
          >
            <Users size={13} className="inline mr-1" />
            Users
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all"
            style={{
              backgroundColor: activeTab === 'tags' ? '#111111' : 'transparent',
              color: activeTab === 'tags' ? '#FFFFFF' : '#6B7280',
              border: activeTab === 'tags' ? '1px solid #222222' : '1px solid transparent',
            }}
          >
            <TagLucide size={13} className="inline mr-1" />
            Tags
          </button>
        </div>

        {/* ─── LLM Tab ─────────────────────────────────────────────── */}
        {activeTab === 'llm' && (
        <>
        {/* ─── KPI Cards ────────────────────────────────────────────── */}
        {t && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <KpiCard
              title="Success Rate"
              value={`${t.success_rate.toFixed(1)}%`}
              subtitle={`${t.batches_success}\u2713  ${t.batches_partial}\u223C  ${t.batches_failed}\u2717`}
              accentColor={getSuccessRateColor(t.success_rate)}
            />
            <KpiCard
              title="Batches"
              value={t.batches_total}
              subtitle={`${t.batches_success}\u2713  ${t.batches_partial}\u223C  ${t.batches_failed}\u2717`}
              accentColor="#60A5FA"
            />
            <KpiCard
              title="Articles Processed"
              value={t.articles_processed}
              subtitle={`failed: ${t.articles_failed}`}
              accentColor="#34D399"
            />
            <KpiCard
              title="Queue"
              value={t.manual_queue}
              subtitle="needs attention"
              accentColor={t.manual_queue > 0 ? '#EF4444' : '#9CA3AF'}
            />
          </div>
        )}

        {/* ─── Chart + Error Bars ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* SVG Chart */}
          <div
            className="rounded-xl border p-6"
            style={{ backgroundColor: '#111111', borderColor: '#222222' }}
          >
            <h2
              className="text-sm font-semibold mb-4"
              style={{ color: '#9CA3AF' }}
            >
              Success Rate (12h)
            </h2>
            {dashboard?.hourly_trend && dashboard.hourly_trend.length > 0 ? (
              <SuccessRateChart data={dashboard.hourly_trend} />
            ) : (
              <div
                className="flex items-center justify-center rounded-lg"
                style={{ height: 200, backgroundColor: '#0A0A0A' }}
              >
                <span className="text-xs" style={{ color: '#6B7280' }}>
                  No data available
                </span>
              </div>
            )}
          </div>

          {/* Error Bars */}
          <div
            className="rounded-xl border p-6"
            style={{ backgroundColor: '#111111', borderColor: '#222222' }}
          >
            <h2
              className="text-sm font-semibold mb-4"
              style={{ color: '#9CA3AF' }}
            >
              Errors by Type
            </h2>
            {dashboard?.errors_by_type &&
            dashboard.errors_by_type.length > 0 ? (
              <ErrorBars errors={dashboard.errors_by_type} />
            ) : (
              <div
                className="flex items-center justify-center rounded-lg"
                style={{ height: 200, backgroundColor: '#0A0A0A' }}
              >
                <span className="text-xs" style={{ color: '#6B7280' }}>
                  No errors today
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ─── Problem Articles Table ──────────────────────────────── */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: '#111111', borderColor: '#222222' }}
        >
          {/* Table header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: '#222222' }}
          >
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-semibold" style={{ color: '#9CA3AF' }}>
                Problem Articles
                {errorsData?.total_failed !== undefined && (
                  <span
                    className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: '#EF444422',
                      color: '#EF4444',
                    }}
                  >
                    {errorsData.total_failed} total
                  </span>
                )}
              </h2>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs mr-2" style={{ color: '#9CA3AF' }}>
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={handleRetrySelected}
                  disabled={backfillLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all hover:border-[#333333] disabled:opacity-50"
                  style={{
                    backgroundColor: '#111111',
                    borderColor: '#34D39944',
                    color: '#34D399',
                  }}
                >
                  <RotateCcw size={12} />
                  Retry Selected
                </button>
                <button
                  onClick={handleIgnoreSelected}
                  disabled={backfillLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all hover:border-[#333333] disabled:opacity-50"
                  style={{
                    backgroundColor: '#111111',
                    borderColor: '#EF444444',
                    color: '#EF4444',
                  }}
                >
                  <Ban size={12} />
                  Ignore Selected
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#0A0A0A' }}>
                  <th className="px-6 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={
                        !!errorsData?.recent?.length &&
                        errorsData.recent.every((a) =>
                          selectedIds.has(a.id)
                        )
                      }
                      onChange={handleSelectAll}
                      className="rounded"
                      style={{
                        accentColor: '#60A5FA',
                        cursor: 'pointer',
                      }}
                    />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: '#6B7280' }}
                  >
                    Title
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: '#6B7280' }}
                  >
                    Error
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-16"
                    style={{ color: '#6B7280' }}
                  >
                    Atm
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-32"
                    style={{ color: '#6B7280' }}
                  >
                    Last Retry
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-40"
                    style={{ color: '#6B7280' }}
                  >
                    Tags
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-32"
                    style={{ color: '#6B7280' }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && !errorsData ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-sm"
                      style={{ color: '#6B7280' }}
                    >
                      <RefreshCw
                        size={20}
                        className="animate-spin mx-auto mb-2"
                        style={{ color: '#60A5FA' }}
                      />
                      Loading...
                    </td>
                  </tr>
                ) : !errorsData?.recent || errorsData.recent.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-sm"
                      style={{ color: '#6B7280' }}
                    >
                      No failed articles found
                    </td>
                  </tr>
                ) : (
                  errorsData.recent.map((article) => (
                    <tr
                      key={article.id}
                      className="transition-colors hover:bg-[#161616]"
                      style={{ borderTop: '1px solid #1a1a1a' }}
                    >
                      <td className="px-6 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(article.id)}
                          onChange={() => handleToggleSelect(article.id)}
                          className="rounded"
                          style={{
                            accentColor: '#60A5FA',
                            cursor: 'pointer',
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="group relative"
                          title={article.title_ru}
                        >
                          <p
                            className="text-sm font-medium truncate max-w-[280px]"
                            style={{ color: '#FFFFFF' }}
                          >
                            {article.title_ru}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${getErrorBarColor(
                              article.sentiment_source
                            )}22`,
                            color: getErrorBarColor(article.sentiment_source),
                          }}
                        >
                          {article.sentiment_source}
                        </span>
                        <p
                          className="text-xs mt-1 max-w-[240px] truncate"
                          style={{ color: '#6B7280' }}
                          title={article.llm_error}
                        >
                          {article.llm_error}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-sm font-mono font-medium"
                          style={{
                            color:
                              article.llm_attempts >= 3
                                ? '#EF4444'
                                : '#9CA3AF',
                          }}
                        >
                          {article.llm_attempts}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-xs"
                        style={{ color: '#6B7280' }}
                      >
                        {article.published_at
                          ? formatDate(article.published_at)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(article.matched_tags || []).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: '#1a1a1a',
                                color: '#9CA3AF',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleRetrySingle(article.id)}
                            disabled={backfillLoading}
                            className="p-1.5 rounded-lg transition-colors hover:bg-[#222222] disabled:opacity-50"
                            title="Retry"
                            style={{ color: '#34D399' }}
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            onClick={() => handleIgnoreSingle(article.id)}
                            disabled={backfillLoading}
                            className="p-1.5 rounded-lg transition-colors hover:bg-[#222222] disabled:opacity-50"
                            title="Ignore"
                            style={{ color: '#EF4444' }}
                          >
                            <Ban size={14} />
                          </button>
                          <button
                            onClick={() =>
                              setRawPreview(article.llm_raw_preview)
                            }
                            className="p-1.5 rounded-lg transition-colors hover:bg-[#222222]"
                            title="View Raw"
                            style={{ color: '#60A5FA' }}
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Per-Tag Stats ────────────────────────────────────────── */}
        {dashboard?.per_tag && dashboard.per_tag.length > 0 && (
          <div
            className="rounded-xl border p-6 mt-6"
            style={{ backgroundColor: '#111111', borderColor: '#222222' }}
          >
            <h2
              className="text-sm font-semibold mb-4"
              style={{ color: '#9CA3AF' }}
            >
              Per-Tag Stats (Today)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {dashboard.per_tag.map((t) => (
                <div
                  key={t.tag}
                  className="rounded-lg border p-3"
                  style={{
                    backgroundColor: '#0A0A0A',
                    borderColor: '#222222',
                  }}
                >
                  <p
                    className="text-xs font-medium truncate"
                    style={{ color: '#FFFFFF' }}
                  >
                    {t.tag}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                    {t.articles} articles
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div
                      className="flex-1 h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: '#222222' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${t.articles === 0 ? 0 : (t.success / t.articles) * 100}%`,
                          backgroundColor:
                            t.success === t.articles
                              ? '#34D399'
                              : t.success > 0
                              ? '#FBBF24'
                              : '#EF4444',
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-mono shrink-0"
                      style={{ color: '#9CA3AF' }}
                    >
                      {t.success}/{t.articles}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Backfill Section ──────────────────────────────────────── */}
        <div
          className="rounded-xl border p-6 mt-6"
          style={{ backgroundColor: '#111111', borderColor: '#222222' }}
        >
          <h2
            className="text-sm font-semibold mb-4"
            style={{ color: '#9CA3AF' }}
          >
            Backfill Articles
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Tag name (e.g. apple)"
              value={backfillTag}
              onChange={(e) => setBackfillTag(e.target.value)}
              className="flex-1 min-w-0 px-4 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444]"
              style={{
                backgroundColor: '#0A0A0A',
                borderColor: '#222222',
                color: '#FFFFFF',
              }}
            />
            <span className="text-xs flex items-center" style={{ color: '#6B7280' }}>
              OR
            </span>
            <input
              type="text"
              placeholder="News IDs (comma-separated)"
              value={backfillIds}
              onChange={(e) => setBackfillIds(e.target.value)}
              className="flex-1 min-w-0 px-4 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444]"
              style={{
                backgroundColor: '#0A0A0A',
                borderColor: '#222222',
                color: '#FFFFFF',
              }}
            />
            <button
              onClick={handleBackfill}
              disabled={
                backfillLoading ||
                (!backfillTag.trim() &&
                  !backfillIds
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean).length)
              }
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 shrink-0"
              style={{
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
              }}
            >
              {backfillLoading ? 'Processing...' : 'Run Backfill'}
            </button>
          </div>
          {backfillResult && (
            <div
              className="mt-3 flex items-center gap-4 text-xs rounded-lg px-4 py-2 border"
              style={{
                backgroundColor: '#0A0A0A',
                borderColor: '#222222',
                color: '#9CA3AF',
              }}
            >
              <span>
                Processed:{" "}
                <strong style={{ color: '#60A5FA' }}>
                  {backfillResult.processed}
                </strong>
              </span>
              <span>
                Succeeded:{" "}
                <strong style={{ color: '#34D399' }}>
                  {backfillResult.succeeded}
                </strong>
              </span>
              <span>
                Failed:{" "}
                <strong style={{ color: '#EF4444' }}>
                  {backfillResult.failed}
                </strong>
              </span>
            </div>
          )}
        </div>

        </>
        )}

        {/* ─── Sources Tab ──────────────────────────────────────────── */}
        {activeTab === 'sources' && <SourcesTab hours={24} />}
        {activeTab === 'source_settings' && <SourcesSettingsTab />}

        {/* ─── Users Tab ────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <>
            <ActivityFeed />
            <UsersTab onSelectUser={setSelectedUserId} refreshKey={usersRefreshKey} />
          </>
        )}

        {/* ─── Tags Tab ─────────────────────────────────────────────── */}
        {activeTab === 'tags' && <TagsTab onSelectTag={setSelectedTagId} />}

      </div>

      {/* ─── Raw Preview Modal ─────────────────────────────────────── */}
      {rawPreview && (
        <RawPreviewModal
          raw={rawPreview}
          onClose={() => setRawPreview(null)}
        />
      )}

      {/* ─── User Detail Modal ────────────────────────────────────── */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onDeleted={() => {
            // TZ_DELETE_SUCCESS_MODAL: refresh user list without full reload
            setUsersRefreshKey(k => k + 1)
          }}
        />
      )}

      {/* ─── Tag Detail Modal ─────────────────────────────────────── */}
      {selectedTagId && (
        <TagDetailModal
          tagId={selectedTagId}
          onClose={() => setSelectedTagId(null)}
        />
      )}

      {/* ─── Cleanup Confirm Modal ────────────────────────────────── */}
      {showCleanupConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={() => !cleanupLoading && setShowCleanupConfirm(false)}
        >
          <div
            className="rounded-xl border w-full mx-4 overflow-hidden"
            style={{ backgroundColor: '#111111', borderColor: '#222222', maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: '#222222' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EF444422' }}>
                <AlertTriangle size={16} style={{ color: '#EF4444' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Удалить ошибки LLM</h3>
              </div>
              <button
                onClick={() => setShowCleanupConfirm(false)}
                disabled={cleanupLoading}
                className="p-1 rounded-lg hover:bg-[#222222] disabled:opacity-50"
                style={{ color: '#6B7280' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm" style={{ color: '#D1D5DB' }}>
                Вы уверены? Будут безвозвратно удалены все статьи с LLM-ошибками
                ({errorsData?.total_failed || 0} шт.).
              </p>
              <p className="text-xs" style={{ color: '#6B7280' }}>
                Это действие нельзя отменить. Успешно обработанные статьи не пострадают.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#222222' }}>
              <button
                onClick={() => setShowCleanupConfirm(false)}
                disabled={cleanupLoading}
                className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[#222222] disabled:opacity-50"
                style={{ color: '#9CA3AF' }}
              >
                Отмена
              </button>
              <button
                onClick={handleCleanup}
                disabled={cleanupLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: cleanupLoading ? '#333333' : '#EF4444',
                  color: '#FFFFFF',
                }}
              >
                <Trash2 size={14} />
                {cleanupLoading ? 'Удаление...' : 'Да, удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cleanup Success Modal ────────────────────────────────── */}
      {showCleanupSuccess && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={() => setShowCleanupSuccess(false)}
        >
          <div
            className="rounded-xl border w-full mx-4 overflow-hidden"
            style={{ backgroundColor: '#111111', borderColor: '#222222', maxWidth: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: '#34D39922' }}>
                <CheckCircle2 size={24} style={{ color: '#34D399' }} />
              </div>
              <div>
                <h3 className="text-base font-semibold" style={{ color: '#FFFFFF' }}>Ошибки удалены</h3>
                <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>
                  Удалено {cleanupCount} статей с LLM-ошибками.
                </p>
              </div>
              <button
                onClick={() => setShowCleanupSuccess(false)}
                className="w-full px-4 py-2 rounded-lg text-sm transition-colors hover:opacity-90"
                style={{ backgroundColor: '#34D399', color: '#000000' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
