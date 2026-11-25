/**
 * =============================================================================
 * PULSE — Админка календаря: «Удалённые события» (tombstones) — ТЗ-232
 * =============================================================================
 *
 * Список tombstone-записей (`GET /api/admin/calendar/events?tombstones=true`)
 * с восстановлением (`DELETE /api/admin/calendar/events/tombstone` — restore
 * по ключу date/title/company[/original_title], все параметры через
 * encodeURIComponent: бэкенд применяет decodeURIComponent к каждому).
 * Восстановление на бэкенде само шлёт SSE calendar:refresh — обновление
 * остальных секций приходит через refreshSignal из CalendarTab, отдельный
 * EventSource не вводим. Оформление — паттерн CalendarEventsTable (#111111 /
 * #222222 / #00D4FF), корень с mb-6 (аудит ТЗ-232: секции иначе прилипнут).
 */

import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, CalendarDays, RotateCcw } from 'lucide-react'
import { adminApi } from '@/lib/api'
import type { CalendarTombstoneEvent } from '@/types/calendar'

interface Props {
  refreshSignal?: number
}

export default function CalendarTombstonesSection({ refreshSignal = 0 }: Props) {
  const [events, setEvents] = useState<CalendarTombstoneEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ТЗ-232 (правка аудита П1): лимит НЕ передаём — дефолт бэкенда 50; limit=25
  // молча урезал бы выдачу ниже дефолта
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.get('/api/admin/calendar/events?tombstones=true')
      setEvents((res?.events || []) as CalendarTombstoneEvent[])
      setTotal(Number(res?.total || 0))
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить удалённые события')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshSignal])

  const handleRestore = async (event: CalendarTombstoneEvent) => {
    // title для бэкенда: известный тикер — deleted_ticker; UNKNOWN — имя компании
    // (бэкенд сам пробует оба ключа: keyAsTicker → fallback keyAsCompany)
    const keyTitle = event.deleted_ticker || event.companies[0]?.name || ''
    const company = event.companies[0]?.name || ''
    if (!window.confirm(`Восстановить событие «${event.title}» (${event.kind}) на ${event.date}?`)) return
    const params = new URLSearchParams()
    params.set('date', event.date)
    params.set('title', keyTitle)
    params.set('company', company)
    if (event.original_title) params.set('original_title', event.original_title)
    setRestoring(`${event.date}|${event.title}|${event.kind}`)
    try {
      await adminApi.delete(`/api/admin/calendar/events/tombstone?${params.toString()}`)
      // запись должна исчезнуть сразу; остальные секции обновит SSE-refresh
      await load()
    } catch (err: any) {
      setError(err?.message || 'Не удалось восстановить событие')
    } finally {
      setRestoring(null)
    }
  }

  return (
    <div className="rounded-xl border overflow-hidden mb-6" style={{ backgroundColor: '#111111', borderColor: '#222222' }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: '#222222' }}>
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <CalendarDays size={16} style={{ color: '#00D4FF' }} />
          Удалённые события
          {total > 0 && (
            <span className="text-xs font-normal" style={{ color: '#6B7280' }}>
              · {total}
            </span>
          )}
        </h3>
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
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Дата</th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Заголовок</th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Тип</th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Компания</th>
              <th className="px-6 py-3 text-xs font-medium" style={{ color: '#6B7280' }}>Тикер</th>
              <th className="px-6 py-3 text-xs font-medium text-right" style={{ color: '#6B7280' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-xs" style={{ color: '#6B7280' }}>
                  Удалённых событий нет
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
                <td className="px-6 py-3" style={{ color: '#D1D5DB' }}>
                  {event.companies.map((c, i) => (
                    <div key={i} className="text-xs">{c.name}</div>
                  ))}
                </td>
                <td className="px-6 py-3 whitespace-nowrap" style={{ color: '#9CA3AF' }}>
                  {event.deleted_ticker || '—'}
                </td>
                <td className="px-6 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => handleRestore(event)}
                    disabled={restoring != null}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs transition-colors hover:border-[#333333] disabled:opacity-50"
                    style={{ borderColor: '#222222', color: '#00D4FF' }}
                  >
                    <RotateCcw size={13} />
                    Восстановить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > events.length && (
        <div className="px-6 py-3 border-t text-xs" style={{ borderColor: '#222222', color: '#6B7280' }}>
          Показано {events.length} из {total}
        </div>
      )}
      {loading && (
        <div className="px-6 py-3 text-xs" style={{ color: '#6B7280' }}>
          Загрузка…
        </div>
      )}
    </div>
  )
}
