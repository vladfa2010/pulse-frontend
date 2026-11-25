/**
 * =============================================================================
 * PULSE — Админка календаря: «Архив событий» — ТЗ-232
 * =============================================================================
 *
 * Канонические события старше grace-окна (14 дней) — `GET /api/admin/calendar/history`
 * с фильтрами search/ticker/from/to и пагинацией по 25. Read-only (без колонки
 * действий). Фильтр тикера — ТОЧНОЕ совпадение после приведения к верхнему
 * регистру на бэкенде (`ticker = $N`, calendar.ts:702,713-717), НЕ подстрока —
 * плейсхолдер поля честно это отражает. Оформление — паттерн
 * CalendarEventsTable, корень с mb-6 (аудит ТЗ-232), пагинация — его блок.
 */

import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, AlertCircle, Archive, AlertTriangle } from 'lucide-react'
import { adminApi } from '@/lib/api'
import type { CalendarAdminEvent } from '@/types/calendar'

const PAGE_SIZE = 25

interface Props {
  refreshSignal?: number
}

export default function CalendarArchiveSection({ refreshSignal = 0 }: Props) {
  const [events, setEvents] = useState<CalendarAdminEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [ticker, setTicker] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
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
      if (ticker.trim()) params.set('ticker', ticker.trim())
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const res = await adminApi.get(`/api/admin/calendar/history?${params.toString()}`)
      setEvents((res?.events || []) as CalendarAdminEvent[])
      setTotal(Number(res?.total || 0))
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить архив')
    } finally {
      setLoading(false)
    }
  }, [page, search, ticker, from, to])

  useEffect(() => {
    load()
  }, [load, refreshSignal])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    load()
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="rounded-xl border overflow-hidden mb-6" style={{ backgroundColor: '#111111', borderColor: '#222222' }}>
      {/* Toolbar */}
      <div className="px-6 py-4 border-b" style={{ borderColor: '#222222' }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Archive size={16} style={{ color: '#00D4FF' }} />
            Архив событий (старше 14 дней)
            {total > 0 && (
              <span className="text-xs font-normal" style={{ color: '#6B7280' }}>
                · {total}
              </span>
            )}
          </h3>
          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6B7280' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по заголовку или компании"
                className="text-sm pl-9 pr-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333] w-52"
                style={{ borderColor: '#222222', color: '#FFFFFF' }}
              />
            </div>
            <input
              type="text"
              value={ticker}
              onChange={e => setTicker(e.target.value)}
              placeholder="Тикер (точное совпадение)"
              className="text-sm px-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333] w-44"
              style={{ borderColor: '#222222', color: '#FFFFFF' }}
            />
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              title="С даты"
              className="text-sm px-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333]"
              style={{ borderColor: '#222222', color: '#9CA3AF' }}
            />
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              title="По дату"
              className="text-sm px-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333]"
              style={{ borderColor: '#222222', color: '#9CA3AF' }}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-2 rounded border text-sm transition-colors hover:border-[#333333] disabled:opacity-50"
              style={{ borderColor: '#222222', color: '#9CA3AF' }}
            >
              Найти
            </button>
          </form>
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
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Дата</th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Заголовок</th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Тип</th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Статус</th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Компании</th>
            </tr>
          </thead>
          <tbody>
            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-xs" style={{ color: '#6B7280' }}>
                  Архив пуст
                </td>
              </tr>
            )}
            {events.map((event) => (
              <tr key={`${event.date}|${event.title}|${event.kind}`} className="border-t" style={{ borderColor: '#1A1A1A' }}>
                <td className="px-6 py-3 whitespace-nowrap" style={{ color: '#D1D5DB' }}>
                  {event.date}
                  {event.weekday && (
                    <span className="ml-1.5 text-xs" style={{ color: '#6B7280' }}>
                      {event.weekday}
                    </span>
                  )}
                </td>
                <td className="px-6 py-3" style={{ color: '#E5E7EB' }}>
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
                <td className="px-6 py-3" style={{ color: '#D1D5DB' }}>
                  {(() => {
                    // разворачиваемый список компаний — паттерн CalendarEventsTable
                    const key = `${event.date}|${event.title}|${event.kind}`
                    const isExpanded = expanded.has(key)
                    const companies = event.companies || []
                    const visible = isExpanded ? companies : companies.slice(0, 3)
                    const rest = companies.length - 3
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
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpanded(prev => {
                                const next = new Set(prev)
                                if (next.has(key)) next.delete(key)
                                else next.add(key)
                                return next
                              })
                            }}
                            className="text-xs hover:underline"
                            style={{ color: '#00D4FF' }}
                          >
                            {isExpanded ? 'Свернуть' : `+${rest} ещё`}
                          </button>
                        )}
                        {companies.length === 0 && (
                          <span className="text-xs" style={{ color: '#6B7280' }}>—</span>
                        )}
                      </div>
                    )
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination — паттерн CalendarEventsTable */}
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
