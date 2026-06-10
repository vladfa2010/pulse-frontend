import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { RefreshCw, Rss, Globe, Power, PowerOff } from 'lucide-react'

interface NewsSource {
  id: number
  name: string
  display_name: string
  type: 'rss' | 'api_search' | 'api_feed'
  enabled: boolean
  last_fetch_at: string | null
  created_at: string
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function SourcesTab() {
  const [sources, setSources] = useState<NewsSource[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.get('/admin/news-sources')
      setSources(data.sources || [])
    } catch (err) {
      console.error('Sources load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = async (id: number) => {
    try {
      const data = await adminApi.put(`/admin/news-sources/${id}/toggle`, {})
      setSources(prev => prev.map(s => s.id === id ? { ...s, enabled: data.source.enabled } : s))
    } catch (err) {
      console.error('Toggle error:', err)
    }
  }

  const rssCount = sources.filter(s => s.type === 'rss').length
  const apiCount = sources.filter(s => s.type === 'api_search').length
  const enabledCount = sources.filter(s => s.enabled).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#E5E7EB' }}>Источники новостей</h2>
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            RSS: {rssCount} | API: {apiCount} | Активно: {enabledCount}/{sources.length}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={{ backgroundColor: '#161616', border: '1px solid #222222', color: '#9CA3AF' }}
        >
          <RefreshCw size={12} /> Обновить
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12" style={{ color: '#6B7280' }}>Загрузка...</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1a', backgroundColor: '#0a0a0a' }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Источник</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Тип</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Последний fetch</th>
                <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(source => (
                <tr
                  key={source.id}
                  className="transition-colors hover:bg-white/5"
                  style={{ borderBottom: '1px solid #0f0f0f' }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {source.type === 'rss' ? (
                        <Rss size={14} style={{ color: '#F97316' }} />
                      ) : (
                        <Globe size={14} style={{ color: '#00D4FF' }} />
                      )}
                      <span className="text-sm" style={{ color: '#E5E7EB' }}>{source.display_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: source.type === 'rss' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(0, 212, 255, 0.1)',
                        color: source.type === 'rss' ? '#F97316' : '#00D4FF',
                      }}
                    >
                      {source.type === 'rss' ? 'RSS' : 'API'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#9CA3AF' }}>
                    {formatDate(source.last_fetch_at)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggle(source.id)}
                      className="transition-colors"
                      title={source.enabled ? 'Выключить' : 'Включить'}
                    >
                      {source.enabled ? (
                        <Power size={16} style={{ color: '#22C55E' }} />
                      ) : (
                        <PowerOff size={16} style={{ color: '#EF4444' }} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
