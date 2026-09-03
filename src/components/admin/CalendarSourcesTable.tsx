import { Fragment, useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle, Upload, Trash2, AlertTriangle, ChevronDown, ChevronUp, Database } from 'lucide-react'
import { adminApi } from '@/lib/api'
import type { CalendarSource } from '@/types/calendar'

interface Props {
  /** Открыть модалку загрузки с предвыбранным провайдером ('auto' — без предвыбора). */
  onUpload: (source: string) => void
  refreshSignal?: number
}

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function CalendarSourcesTable({ onUpload, refreshSignal = 0 }: Props) {
  const [sources, setSources] = useState<CalendarSource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedWarnings, setExpandedWarnings] = useState<Set<string>>(new Set())
  const [clearingLegacy, setClearingLegacy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.get('/api/admin/calendar/sources')
      setSources((res || []) as CalendarSource[])
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить источники')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshSignal])

  const toggleWarnings = (source: string) => {
    setExpandedWarnings(prev => {
      const next = new Set(prev)
      if (next.has(source)) next.delete(source)
      else next.add(source)
      return next
    })
  }

  const handleClearLegacy = async () => {
    const legacy = sources.find(s => s.source === 'legacy')
    if (!legacy || legacy.events_count === 0) return
    if (!window.confirm(`Очистить legacy-срез? Будет удалено ${legacy.events_count} строк, канон пересоберётся.`)) return
    setClearingLegacy(true)
    setError(null)
    try {
      await adminApi.delete('/api/admin/calendar/sources/legacy')
      await load()
    } catch (err: any) {
      setError(err?.message || 'Не удалось очистить legacy')
    } finally {
      setClearingLegacy(false)
    }
  }

  const legacy = sources.find(s => s.source === 'legacy')

  return (
    <div
      className="rounded-xl border overflow-hidden mb-6"
      style={{ backgroundColor: '#111111', borderColor: '#222222' }}
    >
      <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#222222' }}>
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Database size={16} style={{ color: '#00D4FF' }} />
          Источники
        </h3>
        <div className="flex items-center gap-2">
          {legacy && legacy.events_count > 0 && (
            <button
              onClick={handleClearLegacy}
              disabled={clearingLegacy}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors hover:border-[#333333] disabled:opacity-50"
              style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
              title="Удалить legacy-срез из raw и пересобрать канон"
            >
              {clearingLegacy ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Очистить legacy
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors hover:border-[#333333] disabled:opacity-50"
            style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>
      </div>

      {error && (
        <div
          className="mx-6 mt-4 rounded-lg border p-3 flex items-center gap-2 text-xs"
          style={{ backgroundColor: '#EF444411', borderColor: '#EF444430', color: '#EF4444' }}
        >
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead style={{ backgroundColor: '#0A0A0A' }}>
            <tr>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>
                Провайдер
              </th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>
                Дней
              </th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>
                Событий
              </th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>
                Обновлён
              </th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>
                Статус
              </th>
              <th className="px-6 py-3 text-xs font-medium text-right" style={{ color: '#6B7280' }}>
                Действия
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm" style={{ color: '#6B7280' }}>
                  Источники не найдены
                </td>
              </tr>
            ) : (
              sources.map(s => {
                const warnings = s.last_warnings || []
                const isExpanded = expandedWarnings.has(s.source)
                return (
                  <Fragment key={s.source}>
                    <tr
                      className="border-t transition-colors hover:bg-[#161616]"
                      style={{ borderColor: '#222222' }}
                    >
                      <td className="px-6 py-3 font-medium text-white whitespace-nowrap">
                        {s.source}
                        {!s.feed && (
                          <span className="ml-2 text-xs" style={{ color: '#6B7280' }}>
                            (не загружается файлами)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3" style={{ color: '#D1D5DB' }}>
                        {s.days}
                      </td>
                      <td className="px-6 py-3" style={{ color: '#D1D5DB' }}>
                        {s.events_count}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap" style={{ color: '#9CA3AF' }}>
                        {formatUpdatedAt(s.uploaded_at)}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {s.stale && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs border"
                              style={{ backgroundColor: '#F59E0B15', borderColor: '#F59E0B40', color: '#FBBF24' }}
                            >
                              stale
                            </span>
                          )}
                          {warnings.length > 0 && (
                            <button
                              onClick={() => toggleWarnings(s.source)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-colors hover:border-[#333333]"
                              style={{ backgroundColor: '#F59E0B15', borderColor: '#F59E0B40', color: '#FBBF24' }}
                              title="Показать предупреждения последней загрузки"
                            >
                              <AlertTriangle size={12} />
                              {warnings.length}
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          )}
                          {!s.stale && warnings.length === 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border"
                              style={{ backgroundColor: '#10B98115', borderColor: '#10B98140', color: '#34D399' }}
                            >
                              ок
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right whitespace-nowrap">
                        {s.feed ? (
                          <button
                            onClick={() => onUpload(s.source)}
                            disabled={!s.adapter_ready}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors hover:border-[#333333] disabled:opacity-40"
                            style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#D1D5DB' }}
                            title={s.adapter_ready ? 'Загрузить файл' : 'Источник появится позже'}
                          >
                            <Upload size={12} />
                            {s.adapter_ready ? 'Загрузить' : 'скоро'}
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: '#6B7280' }}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                    {warnings.length > 0 && isExpanded && (
                      <tr className="border-t" style={{ borderColor: '#222222' }}>
                        <td colSpan={6} className="px-6 py-3" style={{ backgroundColor: '#0A0A0A' }}>
                          <ul className="space-y-1">
                            {warnings.map((w, i) => (
                              <li key={i} className="text-xs" style={{ color: '#FBBF24' }}>
                                • {w}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
            {loading && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center" style={{ color: '#6B7280' }}>
                  <RefreshCw size={18} className="inline animate-spin mr-2" />
                  Загрузка…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
