import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { createPortal } from 'react-dom'
import { X, Tag, RefreshCw, Users, FileText, RotateCcw } from 'lucide-react'

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

interface DailyStat {
  day: string
  count: number
  avg_sentiment: number
}

interface Article {
  id: string
  title: string
  published_at: string
  sentiment_score: number
  sentiment_source: string
  source: string
}

interface Subscriber {
  email: string
  username: string
  created_at: string
}

interface TagDetail {
  tag_id: string
  tag_name: string
  tag_type: string
  keywords: string[]
  created_at: string
  related_tags: string[]
  ticker: string | null
  website: string | null
  description: string | null
  key_products: string[]
}

interface TagDetailResponse {
  tag: TagDetail
  daily_stats: DailyStat[]
  recent_articles: Article[]
  subscribers: Subscriber[]
  subscriber_count: number
}

interface Props {
  tagId: string
  onClose: () => void
}

function ActivityChart({ data }: { data: DailyStat[] }) {
  if (!data || data.length === 0) {
    return <div className="text-xs py-8 text-center" style={{ color: '#6B7280' }}>No activity data</div>
  }

  const maxCount = Math.max(...data.map(d => d.count), 1)
  const barWidth = Math.max(8, 340 / data.length - 2)
  const chartH = 100

  return (
    <svg width={data.length * (barWidth + 2)} height={chartH + 20} className="mx-auto">
      {data.map((d, i) => {
        const h = (d.count / maxCount) * chartH
        const date = new Date(d.day).getDate()
        return (
          <g key={d.day}>
            <rect
              x={i * (barWidth + 2)} y={chartH - h} width={barWidth} height={h} rx={2}
              fill={d.count > 0 ? '#60A5FA' : '#222222'} opacity={0.8}
            />
            <text x={i * (barWidth + 2) + barWidth / 2} y={chartH + 14} textAnchor="middle" fill="#6B7280" fontSize="9">
              {date}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function TagDetailModal({ tagId, onClose }: Props) {
  const [data, setData] = useState<TagDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [backfillResult, setBackfillResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.get(`/admin/tags/${tagId}`)
      setData(res)
    } catch (err) {
      console.error('Tag detail load error:', err)
    } finally {
      setLoading(false)
    }
  }, [tagId])

  useEffect(() => { load() }, [load])

  const handleBackfill = async () => {
    try {
      setBackfillResult('Processing...')
      const res = await adminApi.post('/admin/backfill', { tag: tagId })
      setBackfillResult(`Processed: ${res.processed}, OK: ${res.succeeded}, Fail: ${res.failed}`)
    } catch (err: any) {
      setBackfillResult(err.message || 'Failed')
    }
  }

  if (loading || !data) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <div className="flex items-center gap-2" style={{ color: '#9CA3AF' }}>
          <RefreshCw size={18} className="animate-spin" /> Loading...
        </div>
      </div>,
      document.body
    )
  }

  const t = data.tag

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div
        className="rounded-xl border w-full mx-4 overflow-hidden flex flex-col"
        style={{ backgroundColor: '#111111', borderColor: '#222222', maxWidth: 720, maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#222222' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2563EB22' }}>
              <Tag size={18} style={{ color: '#60A5FA' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#FFFFFF' }}>{t.tag_name}</h2>
              <p className="text-xs" style={{ color: '#6B7280' }}>
                ID: {t.tag_id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackfill}
              title="Пересчитает LLM-анализ для статей этого тега (до 100 шт). Очищает ошибки, обновляет sentiment и reasoning."
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all hover:border-[#333333]"
              style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
            >
              <RotateCcw size={12} /> Backfill
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#222222] ml-2" style={{ color: '#9CA3AF' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">

          {/* Backfill result */}
          {backfillResult && (
            <div className="rounded-lg border px-4 py-2 text-xs" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: backfillResult.includes('OK') ? '#34D399' : '#EF4444' }}>
              {backfillResult}
            </div>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>Subscribers</p>
              <p className="text-sm font-semibold mt-1" style={{ color: '#60A5FA' }}>{data.subscriber_count}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>30d Articles</p>
              <p className="text-sm font-semibold mt-1" style={{ color: '#FFFFFF' }}>{data.daily_stats.reduce((s, d) => s + d.count, 0)}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>Keywords</p>
              <p className="text-sm font-semibold mt-1" style={{ color: '#FFFFFF' }}>{t.keywords.length}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>Created</p>
              <p className="text-sm font-semibold mt-1" style={{ color: '#FFFFFF' }}>{formatDate(t.created_at).split(',')[0]}</p>
            </div>
          </div>

          {/* Type */}
          <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
            <p className="text-xs font-medium mb-2" style={{ color: '#9CA3AF' }}>Type</p>
            <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{t.tag_type}</p>
          </div>

          {/* Ticker */}
          <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
            <p className="text-xs font-medium mb-2" style={{ color: '#9CA3AF' }}>Ticker</p>
            <p className="text-sm font-semibold" style={{ color: '#60A5FA' }}>
              {t.ticker && t.ticker !== 'null' && t.ticker !== '' ? t.ticker : <span className="text-xs font-normal" style={{ color: '#6B7280' }}>Not set</span>}
            </p>
          </div>

          {/* Website */}
          <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
            <p className="text-xs font-medium mb-2" style={{ color: '#9CA3AF' }}>Website</p>
            <p className="text-xs">
              {t.website && t.website !== 'null' && t.website !== '' ? (
                <a href={t.website} target="_blank" rel="noopener" style={{ color: '#60A5FA' }}>{t.website} ↗</a>
              ) : (
                <span style={{ color: '#6B7280' }}>Not set</span>
              )}
            </p>
          </div>

          {/* Description */}
          <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
            <p className="text-xs font-medium mb-2" style={{ color: '#9CA3AF' }}>Description</p>
            <p className="text-xs leading-relaxed" style={{ color: '#D1D5DB' }}>
              {t.description && t.description !== 'null' ? t.description : <span style={{ color: '#6B7280' }}>Not set</span>}
            </p>
          </div>

          {/* Key Products */}
          <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
            <p className="text-xs font-medium mb-2" style={{ color: '#9CA3AF' }}>Key Products</p>
            <div className="flex flex-wrap gap-1.5">
              {t.key_products.length > 0 ? t.key_products.map(kp => (
                <span key={kp} className="text-xs px-2 py-0.5 rounded border" style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#D1D5DB' }}>
                  {kp}
                </span>
              )) : <span className="text-xs" style={{ color: '#6B7280' }}>Not set</span>}
            </div>
          </div>

          {/* Keywords */}
          {t.keywords.length > 0 && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs font-medium mb-2" style={{ color: '#9CA3AF' }}>Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {t.keywords.map(kw => (
                  <span key={kw} className="text-xs px-2 py-0.5 rounded border" style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#D1D5DB' }}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related tags */}
          {t.related_tags.length > 0 && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs font-medium mb-2" style={{ color: '#9CA3AF' }}>Related</p>
              <div className="flex flex-wrap gap-1.5">
                {t.related_tags.map(rt => (
                  <span key={rt} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#1a1a1a', color: '#9CA3AF' }}>
                    {rt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activity Chart */}
          {data.daily_stats.length > 0 && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Articles (30 days)</p>
              </div>
              <ActivityChart data={data.daily_stats} />
            </div>
          )}

          {/* Recent articles */}
          {data.recent_articles.length > 0 && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Recent Articles ({data.recent_articles.length})</p>
              </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {data.recent_articles.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-xs truncate" style={{ color: '#FFFFFF' }} title={a.title}>{a.title}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{a.source} · {formatDate(a.published_at)}</p>
                    </div>
                    {a.sentiment_score !== null && (
                      <span className="text-xs font-mono shrink-0" style={{
                        color: a.sentiment_score > 0 ? '#34D399' : a.sentiment_score < 0 ? '#EF4444' : '#9CA3AF'
                      }}>
                        {a.sentiment_score > 0 ? '+' : ''}{a.sentiment_score}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subscribers */}
          {data.subscribers.length > 0 && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>Subscribers ({data.subscribers.length})</p>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-auto">
                {data.subscribers.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <span className="text-xs" style={{ color: '#FFFFFF' }}>{s.username || s.email}</span>
                    <span className="text-xs" style={{ color: '#6B7280' }}>{formatDate(s.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  )
}
