import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { RefreshCw, Tag, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface TagRow {
  tag_id: string
  tag_name: string
  tag_type: string
  keywords: string[]
  created_at: string
  subscriber_count: number
  articles_24h: number
  articles_7d: number
  articles_30d: number
  avg_sentiment: number
  llm_success: number
  llm_failed: number
  last_article_at: string
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

interface TagsTabProps {
  onSelectTag: (tagId: string) => void
}

export default function TagsTab({ onSelectTag }: TagsTabProps) {
  const [tags, setTags] = useState<TagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'24h' | '7d' | '30d' | 'subscribers' | 'name'>('24h')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.get('/admin/tags')
      setTags(data.tags || [])
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Tags load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])
  useEffect(() => {
    const handler = (e: any) => {
      const deletedTagId = e.detail?.tagId
      setTags(prev => prev.filter(t => t.tag_id !== deletedTagId))
    }
    window.addEventListener('tag:deleted', handler)
    return () => window.removeEventListener('tag:deleted', handler)
  }, [])

  const filtered = tags
    .filter(t =>
      !search ||
      t.tag_name.toLowerCase().includes(search.toLowerCase()) ||
      t.tag_id.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === '24h') return b.articles_24h - a.articles_24h
      if (sortBy === '7d') return b.articles_7d - a.articles_7d
      if (sortBy === '30d') return b.articles_30d - a.articles_30d
      if (sortBy === 'subscribers') return b.subscriber_count - a.subscriber_count
      return a.tag_name.localeCompare(b.tag_name)
    })

  const total24h = tags.reduce((s, t) => s + t.articles_24h, 0)
  const totalSubs = tags.reduce((s, t) => s + t.subscriber_count, 0)
  const inactiveCount = tags.filter(t => t.articles_24h === 0 && t.articles_7d === 0).length

  return (
    <div>
      {/* Summary + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: '#9CA3AF' }}>{tags.length} tags</span>
          <span className="text-sm" style={{ color: '#6B7280' }}>{total24h} articles (24h)</span>
          <span className="text-sm" style={{ color: '#6B7280' }}>{totalSubs} subscribers</span>
          {inactiveCount > 0 && (
            <span className="text-sm" style={{ color: '#FBBF24' }}>{inactiveCount} inactive</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border focus:outline-none focus:border-[#444444]"
            style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF', width: 160 }}
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg text-sm border focus:outline-none"
            style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
          >
            <option value="24h">Sort: 24h</option>
            <option value="7d">Sort: 7d</option>
            <option value="30d">Sort: 30d</option>
            <option value="subscribers">Sort: Subs</option>
            <option value="name">Sort: Name</option>
          </select>
          {lastRefresh && (
            <span className="text-xs hidden sm:inline" style={{ color: '#6B7280' }}>
              {formatDate(lastRefresh.toISOString())}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-all hover:border-[#333333] disabled:opacity-50"
            style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tags table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#111111', borderColor: '#222222' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#0A0A0A' }}>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Tag</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>24h</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>7d</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>30d</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-20" style={{ color: '#6B7280' }}>Subs</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>LLM</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-24" style={{ color: '#6B7280' }}>Sent</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-32" style={{ color: '#6B7280' }}>Last</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const llmTotal = t.llm_success + t.llm_failed
                const llmRate = llmTotal > 0 ? Math.round((t.llm_success / llmTotal) * 100) : 0
                const SentIcon = t.avg_sentiment > 0 ? TrendingUp : t.avg_sentiment < 0 ? TrendingDown : Minus
                const sentColor = t.avg_sentiment > 0 ? '#34D399' : t.avg_sentiment < 0 ? '#EF4444' : '#6B7280'
                const isInactive = t.articles_24h === 0 && t.articles_7d === 0

                return (
                  <tr
                    key={t.tag_id}
                    className="transition-colors hover:bg-[#161616] cursor-pointer"
                    style={{ borderTop: '1px solid #1a1a1a', opacity: isInactive ? 0.5 : 1 }}
                    onClick={() => onSelectTag(t.tag_id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Tag size={13} style={{ color: '#60A5FA' }} />
                        <span className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{t.tag_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#1a1a1a', color: '#9CA3AF' }}>
                        {t.tag_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium" style={{ color: t.articles_24h > 0 ? '#FFFFFF' : '#6B7280' }}>{t.articles_24h}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm" style={{ color: '#9CA3AF' }}>{t.articles_7d}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm" style={{ color: '#9CA3AF' }}>{t.articles_30d}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm" style={{ color: t.subscriber_count > 0 ? '#60A5FA' : '#6B7280' }}>{t.subscriber_count}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {llmTotal > 0 ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-8 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#222222' }}>
                            <div className="h-full rounded-full" style={{ width: `${llmRate}%`, backgroundColor: llmRate >= 80 ? '#34D399' : llmRate >= 50 ? '#FBBF24' : '#EF4444' }} />
                          </div>
                          <span className="text-xs font-mono" style={{ color: '#9CA3AF' }}>{llmRate}%</span>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: '#6B7280' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <SentIcon size={12} style={{ color: sentColor }} />
                        <span className="text-xs font-mono" style={{ color: sentColor }}>
                          {t.avg_sentiment > 0 ? '+' : ''}{t.avg_sentiment}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: '#6B7280' }}>
                        {t.last_article_at ? formatDate(t.last_article_at) : '—'}
                      </span>
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
