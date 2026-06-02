import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router'
import { api } from '@/lib/api'

interface LlmMetric {
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

export default function Admin() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const [llmMetrics, setLlmMetrics] = useState<LlmMetric | null>(null)
  const [failedArticles, setFailedArticles] = useState<FailedArticle[]>([])
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [loadingErrors, setLoadingErrors] = useState(true)
  const [backfillTag, setBackfillTag] = useState('')
  const [backfillResult, setBackfillResult] = useState('')

  // Redirect non-admins
  useEffect(() => {
    if (!isLoading && !user?.isAdmin) {
      navigate('/')
    }
  }, [isLoading, user, navigate])

  // Load LLM metrics
  useEffect(() => {
    if (!user?.isAdmin) return
    api.get('/admin/llm-dashboard')
      .then(setLlmMetrics)
      .catch(console.error)
      .finally(() => setLoadingMetrics(false))
  }, [user])

  // Load failed articles
  useEffect(() => {
    if (!user?.isAdmin) return
    api.get('/admin/llm-errors?limit=20')
      .then((data: any) => setFailedArticles(data.recent || []))
      .catch(console.error)
      .finally(() => setLoadingErrors(false))
  }, [user])

  const handleBackfill = async () => {
    if (!backfillTag) return
    setBackfillResult('Processing...')
    try {
      const result = await api.post('/admin/backfill', { tag: backfillTag })
      setBackfillResult(`Processed: ${result.processed}, Succeeded: ${result.succeeded}, Failed: ${result.failed}`)
    } catch (err: any) {
      setBackfillResult(`Error: ${err.message}`)
    }
  }

  if (isLoading) return <div className="text-white p-8">Loading...</div>
  if (!user?.isAdmin) return null

  const m = llmMetrics?.today

  return (
    <div className="min-h-screen bg-[#0B0C15] text-white p-6 pt-24">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-gray-400 mt-1">LLM Error Tracking & Metrics</p>
        </div>

        {/* Stats Cards */}
        {m && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Batches Today" value={m.batches_total} color="blue" />
            <StatCard label="Success Rate" value={`${m.success_rate}%`} color={m.success_rate >= 90 ? 'green' : m.success_rate >= 70 ? 'yellow' : 'red'} />
            <StatCard label="Articles Processed" value={m.articles_processed} color="green" />
            <StatCard label="Articles Failed" value={m.articles_failed} color="red" />
            <StatCard label="Success" value={m.batches_success} color="green" />
            <StatCard label="Partial" value={m.batches_partial} color="yellow" />
            <StatCard label="Failed" value={m.batches_failed} color="red" />
            <StatCard label="Manual Queue" value={m.manual_queue} color="purple" />
          </div>
        )}

        {/* Backfill Section */}
        <div className="bg-[#1a1d29] rounded-xl p-6 border border-white/10">
          <h2 className="text-xl font-semibold mb-4">Backfill Articles</h2>
          <div className="flex gap-3 items-center">
            <input
              type="text"
              placeholder="Tag name (e.g. apple)"
              value={backfillTag}
              onChange={e => setBackfillTag(e.target.value)}
              className="px-4 py-2 rounded-lg bg-[#0B0C15] border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleBackfill}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
            >
              Run Backfill
            </button>
          </div>
          {backfillResult && (
            <p className="mt-3 text-sm text-gray-300">{backfillResult}</p>
          )}
        </div>

        {/* Errors by Type */}
        {llmMetrics?.errors_by_type && llmMetrics.errors_by_type.length > 0 && (
          <div className="bg-[#1a1d29] rounded-xl p-6 border border-white/10">
            <h2 className="text-xl font-semibold mb-4">Errors by Type (Today)</h2>
            <div className="space-y-2">
              {llmMetrics.errors_by_type.map(e => (
                <div key={e.sentiment_source} className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-gray-300">{e.sentiment_source}</span>
                  <span className="font-mono text-red-400">{e.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failed Articles */}
        <div className="bg-[#1a1d29] rounded-xl p-6 border border-white/10">
          <h2 className="text-xl font-semibold mb-4">Recent Failed Articles</h2>
          {loadingErrors ? (
            <p className="text-gray-400">Loading...</p>
          ) : failedArticles.length === 0 ? (
            <p className="text-gray-400">No failed articles found</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {failedArticles.map(a => (
                <div key={a.id} className="p-3 rounded-lg bg-[#0B0C15] border border-red-500/20">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.title_ru}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {a.published_at} | Attempts: {a.llm_attempts} | {a.sentiment_source}
                      </p>
                      <p className="text-xs text-red-400 mt-1">{a.llm_error}</p>
                      {a.llm_raw_preview && (
                        <details className="mt-2">
                          <summary className="text-xs text-blue-400 cursor-pointer">Raw Preview</summary>
                          <pre className="text-xs text-gray-400 mt-1 p-2 bg-black/30 rounded overflow-x-auto">{a.llm_raw_preview}</pre>
                        </details>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 shrink-0">
                      {a.matched_tags?.join(', ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per-Tag Stats */}
        {llmMetrics?.per_tag && llmMetrics.per_tag.length > 0 && (
          <div className="bg-[#1a1d29] rounded-xl p-6 border border-white/10">
            <h2 className="text-xl font-semibold mb-4">Per-Tag Stats (Today)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {llmMetrics.per_tag.map(t => (
                <div key={t.tag} className="p-3 rounded-lg bg-[#0B0C15] border border-white/10">
                  <p className="text-sm font-medium">{t.tag}</p>
                  <p className="text-xs text-gray-400">{t.articles} articles</p>
                  <p className="text-xs text-green-400">{t.success} success</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400 border-blue-500/30',
    green: 'text-green-400 border-green-500/30',
    yellow: 'text-yellow-400 border-yellow-500/30',
    red: 'text-red-400 border-red-500/30',
    purple: 'text-purple-400 border-purple-500/30',
  }
  return (
    <div className={`p-4 rounded-xl bg-[#1a1d29] border ${colorMap[color] || colorMap.blue}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  )
}