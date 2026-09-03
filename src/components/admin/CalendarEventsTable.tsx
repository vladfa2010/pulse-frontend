import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  RefreshCw,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CalendarDays,
  AlertTriangle,
} from 'lucide-react'
import { adminApi } from '@/lib/api'
import type { CalendarAdminEvent, EventKind, EventStatus } from '@/types/calendar'

interface Props {
  onEdit: (event: CalendarAdminEvent) => void
  onAdd: () => void
  refreshSignal?: number
}

const KINDS: EventKind[] = ['МСФО', 'РСБУ', 'СД', 'СА', 'Дивиденды', 'Другое']

const PAGE_SIZE = 25

function encodeGroupPath(date: string, title: string, kind: string): string {
  return `/api/admin/calendar/events/${encodeURIComponent(date)}/${encodeURIComponent(title)}/${encodeURIComponent(kind)}`
}

export default function CalendarEventsTable({ onEdit, onAdd, refreshSignal = 0 }: Props) {
  const [events, setEvents] = useState<CalendarAdminEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<EventKind | ''>('')
  const [statusFilter, setStatusFilter] = useState<EventStatus | ''>('')
  const [duplicatesOnly, setDuplicatesOnly] = useState(false)
  const [duplicatesCount, setDuplicatesCount] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(page * PAGE_SIZE))
      if (search.trim()) params.set('search', search.trim())
      if (kindFilter) params.set('kind', kindFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (duplicatesOnly) params.set('possible_duplicate', 'true')

      const res = await adminApi.get(`/api/admin/calendar/events?${params.toString()}`)
      setEvents((res?.events || []) as CalendarAdminEvent[])
      setTotal(Number(res?.total || 0))

      // Счётчик «возможных дублей» — отдельный запрос с тем же фильтром.
      const dupParams = new URLSearchParams()
      if (search.trim()) dupParams.set('search', search.trim())
      if (kindFilter) dupParams.set('kind', kindFilter)
      if (statusFilter) dupParams.set('status', statusFilter)
      dupParams.set('possible_duplicate', 'true')
      dupParams.set('limit', '1')
      const dupRes = await adminApi.get(`/api/admin/calendar/events?${dupParams.toString()}`)
      setDuplicatesCount(Number(dupRes?.total || 0))
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить события')
    } finally {
      setLoading(false)
    }
  }, [page, search, kindFilter, statusFilter, duplicatesOnly])

  useEffect(() => {
    load()
  }, [load, refreshSignal])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    load()
  }

  const handleDelete = async (event: CalendarAdminEvent) => {
    if (!window.confirm(`Удалить событие «${event.title}» (${event.kind}) на ${event.date}?`)) return
    try {
      await adminApi.delete(encodeGroupPath(event.date, event.title, event.kind))
      load()
    } catch (err: any) {
      setError(err?.message || 'Не удалось удалить событие')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function toggleExpanded(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: '#111111', borderColor: '#222222' }}
    >
      {/* Toolbar */}
      <div className="px-6 py-4 border-b" style={{ borderColor: '#222222' }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <CalendarDays size={16} style={{ color: '#00D4FF' }} />
            События календаря
          </h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6B7280' }} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск по заголовку или компании"
                  className="w-full text-sm pl-9 pr-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333]"
                  style={{ borderColor: '#222222', color: '#FFFFFF' }}
                />
              </div>
              <select
                value={kindFilter}
                onChange={e => {
                  setKindFilter(e.target.value as EventKind | '')
                  setPage(0)
                }}
                className="text-sm px-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333]"
                style={{ borderColor: '#222222', color: '#FFFFFF' }}
              >
                <option value="" style={{ backgroundColor: '#111111' }}>
                  Все типы
                </option>
                {KINDS.map(k => (
                  <option key={k} value={k} style={{ backgroundColor: '#111111' }}>
                    {k}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value as EventStatus | '')
                  setPage(0)
                }}
                className="text-sm px-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333]"
                style={{ borderColor: '#222222', color: '#FFFFFF' }}
              >
                <option value="" style={{ backgroundColor: '#111111' }}>
                  Все статусы
                </option>
                <option value="confirmed" style={{ backgroundColor: '#111111' }}>
                  Подтверждено
                </option>
                <option value="expected" style={{ backgroundColor: '#111111' }}>
                  Ожидается
                </option>
              </select>
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-2 rounded-lg text-sm border transition-colors hover:border-[#333333] disabled:opacity-50"
                style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
              >
                Найти
              </button>
              <button
                type="button"
                onClick={() => {
                  setDuplicatesOnly(v => !v)
                  setPage(0)
                }}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors hover:border-[#333333] disabled:opacity-50"
                style={{
                  backgroundColor: duplicatesOnly ? '#F59E0B15' : '#0A0A0A',
                  borderColor: duplicatesOnly ? '#F59E0B40' : '#222222',
                  color: duplicatesOnly ? '#FBBF24' : '#9CA3AF',
                }}
                title="Показать только группы с флагом possible_duplicate"
              >
                <AlertTriangle size={14} />
                Возможные дубли
                {duplicatesCount !== null && (
                  <span className="px-1.5 rounded text-xs" style={{ backgroundColor: '#F59E0B25', color: '#FBBF24' }}>
                    {duplicatesCount}
                  </span>
                )}
              </button>
            </form>
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors hover:border-[#333333] disabled:opacity-50"
                style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Обновить
              </button>
              <button
                onClick={onAdd}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: '#00D4FF', color: '#060606' }}
              >
                <Plus size={14} />
                Добавить
              </button>
            </div>
          </div>
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead style={{ backgroundColor: '#0A0A0A' }}>
            <tr>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>
                Дата
              </th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>
                Заголовок
              </th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>
                Тип
              </th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>
                Статус
              </th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>
                Источники
              </th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>
                Компании
              </th>
              <th className="px-6 py-3 text-xs font-medium text-right" style={{ color: '#6B7280' }}>
                Действия
              </th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-sm"
                  style={{ color: '#6B7280' }}
                >
                  События не найдены
                </td>
              </tr>
            ) : (
              events.map(event => (
                <tr
                  key={`${event.date}|${event.title}|${event.kind}`}
                  className="border-t cursor-pointer transition-colors hover:bg-[#161616]"
                  style={{ borderColor: '#222222' }}
                  onClick={() => onEdit(event)}
                >
                  <td className="px-6 py-3 whitespace-nowrap" style={{ color: '#D1D5DB' }}>
                    <div className="font-medium text-white">{event.date}</div>
                    <div className="text-xs" style={{ color: '#6B7280' }}>
                      {event.weekday}
                    </div>
                  </td>
                  <td className="px-6 py-3" style={{ color: '#FFFFFF' }}>
                    {event.title}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap" style={{ color: '#9CA3AF' }}>
                    {event.kind}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs border"
                      style={{
                        backgroundColor: event.status === 'confirmed' ? '#10B98115' : '#F59E0B15',
                        borderColor: event.status === 'confirmed' ? '#10B98140' : '#F59E0B40',
                        color: event.status === 'confirmed' ? '#34D399' : '#FBBF24',
                      }}
                    >
                      {event.status === 'confirmed' ? 'Подтверждено' : 'Ожидается'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(event.sources || []).map(src => (
                        <span
                          key={src}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs border"
                          style={{
                            backgroundColor: src === 'manual' ? '#8B5CF615' : '#00D4FF10',
                            borderColor: src === 'manual' ? '#8B5CF640' : '#00D4FF30',
                            color: src === 'manual' ? '#A78BFA' : '#67E8F9',
                          }}
                        >
                          {src === 'manual' ? 'вручную' : src}
                        </span>
                      ))}
                      {(event.sources || []).length === 0 && (
                        <span className="text-xs" style={{ color: '#6B7280' }}>
                          —
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3" style={{ color: '#D1D5DB' }}>
                    {(() => {
                      const key = `${event.date}|${event.title}|${event.kind}`
                      const isExpanded = expanded.has(key)
                      const visible = isExpanded ? event.companies : event.companies.slice(0, 3)
                      const rest = event.companies.length - 3
                      return (
                        <div className="space-y-1">
                          {visible.map((c, i) => (
                            <div key={i} className="text-xs">
                              <span style={{ color: '#D1D5DB' }}>{c.name}</span>
                              {c.ticker && c.ticker !== 'UNKNOWN' && (
                                <span style={{ color: '#9CA3AF' }}> ({c.ticker})</span>
                              )}
                              {c.ticker === 'UNKNOWN' && (
                                <span
                                  className="ml-1 inline-flex items-center px-1 rounded border"
                                  style={{ backgroundColor: '#F59E0B15', borderColor: '#F59E0B40', color: '#FBBF24' }}
                                  title="Тикер не распознан — событие не привяжется к инструменту"
                                >
                                  <AlertTriangle size={10} className="mr-0.5" />
                                  UNKNOWN
                                </span>
                              )}
                            </div>
                          ))}
                          {rest > 0 && (
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                toggleExpanded(key)
                              }}
                              className="text-xs hover:underline"
                              style={{ color: '#00D4FF' }}
                            >
                              {isExpanded ? 'Свернуть' : `+${rest} ещё`}
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        handleDelete(event)
                      }}
                      className="p-1.5 rounded transition-colors hover:bg-[#EF444422]"
                      style={{ color: '#6B7280' }}
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
            {loading && (
              <tr>
                <td colSpan={7} className="px-6 py-6 text-center" style={{ color: '#6B7280' }}>
                  <RefreshCw size={18} className="inline animate-spin mr-2" />
                  Загрузка…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {events.length > 0 && (
        <div
          className="px-6 py-4 border-t flex items-center justify-between"
          style={{ borderColor: '#222222' }}
        >
          <span className="text-xs" style={{ color: '#6B7280' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} из {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="p-2 rounded border transition-colors hover:border-[#333333] disabled:opacity-50"
              style={{ borderColor: '#222222', color: '#9CA3AF' }}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs" style={{ color: '#9CA3AF' }}>
              Стр. {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="p-2 rounded border transition-colors hover:border-[#333333] disabled:opacity-50"
              style={{ borderColor: '#222222', color: '#9CA3AF' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
