import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Trash2, RefreshCw, CalendarDays } from 'lucide-react'
import { adminApi } from '@/lib/api'
import type { CalendarAdminEvent, CalendarCompany, EventKind, EventStatus } from '@/types/calendar'
import InstrumentSearchInput from '@/components/admin/InstrumentSearchInput'

interface Props {
  isOpen: boolean
  event: CalendarAdminEvent | null // null = create
  onClose: () => void
  onSaved: () => void
}

const KINDS: EventKind[] = ['МСФО', 'РСБУ', 'СД', 'СА', 'Дивиденды', 'Другое']
const STATUSES: EventStatus[] = ['confirmed', 'expected']

const WEEKDAYS_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function computeWeekday(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00`)
    return WEEKDAYS_RU[d.getDay()]
  } catch {
    return 'пн'
  }
}

function encodeGroupPath(date: string, title: string, kind: string): string {
  return `/api/admin/calendar/events/${encodeURIComponent(date)}/${encodeURIComponent(title)}/${encodeURIComponent(kind)}`
}

const emptyCompany = (): CalendarCompany => ({ name: '', ticker: '' })

export default function CalendarEventModal({ isOpen, event, onClose, onSaved }: Props) {
  const isEdit = Boolean(event)

  const [date, setDate] = useState('')
  const [weekday, setWeekday] = useState('')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<EventKind>('Другое')
  const [status, setStatus] = useState<EventStatus>('confirmed')
  const [companies, setCompanies] = useState<CalendarCompany[]>([emptyCompany()])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    if (event) {
      setDate(event.date)
      setWeekday(event.weekday)
      setTitle(event.title)
      setKind(event.kind)
      setStatus(event.status)
      setCompanies(event.companies.length > 0 ? event.companies.map(c => ({ ...c })) : [emptyCompany()])
    } else {
      setDate('')
      setWeekday('')
      setTitle('')
      setKind('Другое')
      setStatus('confirmed')
      setCompanies([emptyCompany()])
    }
  }, [event])

  useEffect(() => {
    if (!isOpen) return
    resetForm()
    setError(null)
    setSaving(false)
    setLoading(false)
  }, [isOpen, resetForm])

  // Load full event data when editing
  useEffect(() => {
    if (!isOpen || !event) return
    let mounted = true
    setLoading(true)
    adminApi
      .get(encodeGroupPath(event.date, event.title, event.kind))
      .then((data: any) => {
        if (!mounted) return
        const full = data?.event as CalendarAdminEvent | undefined
        if (full) {
          setDate(full.date)
          setWeekday(full.weekday)
          setTitle(full.title)
          setKind(full.kind)
          setStatus(full.status)
          setCompanies(full.companies.length > 0 ? full.companies.map(c => ({ ...c })) : [emptyCompany()])
        }
      })
      .catch((err: any) => {
        if (!mounted) return
        setError(err?.message || 'Не удалось загрузить событие')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [isOpen, event])

  const handleDateChange = (value: string) => {
    setDate(value)
    if (value) {
      setWeekday(computeWeekday(value))
    }
  }

  const updateCompany = (index: number, patch: Partial<CalendarCompany>) => {
    setCompanies(prev =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    )
  }

  const addCompany = () => {
    setCompanies(prev => [...prev, emptyCompany()])
  }

  const removeCompany = (index: number) => {
    setCompanies(prev => {
      const next = [...prev]
      next.splice(index, 1)
      return next.length === 0 ? [emptyCompany()] : next
    })
  }

  const validate = (): string | null => {
    if (!date) return 'Укажите дату'
    if (!title.trim()) return 'Укажите заголовок'
    if (!KINDS.includes(kind)) return 'Выберите тип события'
    if (!STATUSES.includes(status)) return 'Выберите статус'
    const validCompanies = companies.filter(c => c.name.trim() && c.ticker.trim())
    if (validCompanies.length === 0) return 'Добавьте хотя бы одну компанию'
    const tickers = new Set<string>()
    for (const c of validCompanies) {
      const t = c.ticker.trim().toUpperCase()
      if (tickers.has(t)) return `Повторяющийся тикер: ${t}`
      tickers.add(t)
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    const payload: CalendarAdminEvent = {
      date,
      weekday: weekday || computeWeekday(date),
      title: title.trim(),
      kind,
      status,
      companies: companies
        .filter(c => c.name.trim() && c.ticker.trim())
        .map(c => ({ name: c.name.trim(), ticker: c.ticker.trim().toUpperCase() }))
        .sort((a, b) => a.ticker.localeCompare(b.ticker)),
      companies_count: 0,
    }

    setSaving(true)
    setError(null)
    try {
      if (isEdit && event) {
        await adminApi.put(encodeGroupPath(event.date, event.title, event.kind), payload)
      } else {
        await adminApi.post('/api/admin/calendar/events', payload)
      }
      onSaved()
    } catch (err: any) {
      if (err?.isTransportError) {
        setError('Нет ответа от сервера. Событие могло сохраниться — закройте форму и проверьте список (он обновляется автоматически).')
      } else {
        setError(err?.message || 'Ошибка сохранения')
      }
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl border w-full overflow-hidden flex flex-col"
        style={{ backgroundColor: '#111111', borderColor: '#222222', maxWidth: 640, maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: '#222222' }}>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <CalendarDays size={16} style={{ color: '#00D4FF' }} />
            {isEdit ? 'Редактировать событие' : 'Новое событие'}
          </h3>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1 rounded-lg hover:bg-[#222222] disabled:opacity-50"
            style={{ color: '#6B7280' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form id="calendar-event-form" onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {loading && (
            <div className="text-sm text-center py-4" style={{ color: '#6B7280' }}>
              <RefreshCw size={16} className="inline animate-spin mr-2" />
              Загрузка…
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>
                Дата <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={e => handleDateChange(e.target.value)}
                disabled={loading || saving}
                className="w-full text-sm px-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333] disabled:opacity-50"
                style={{ borderColor: '#222222', color: '#FFFFFF' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>
                День недели
              </label>
              <input
                type="text"
                value={weekday}
                onChange={e => setWeekday(e.target.value)}
                disabled={loading || saving}
                placeholder="пн"
                className="w-full text-sm px-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333] disabled:opacity-50"
                style={{ borderColor: '#222222', color: '#FFFFFF' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>
              Заголовок <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={loading || saving}
              placeholder="Например, Ожидается публикация МСФО"
              className="w-full text-sm px-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333] disabled:opacity-50"
              style={{ borderColor: '#222222', color: '#FFFFFF' }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>
                Тип <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={kind}
                onChange={e => setKind(e.target.value as EventKind)}
                disabled={loading || saving}
                className="w-full text-sm px-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333] disabled:opacity-50"
                style={{ borderColor: '#222222', color: '#FFFFFF' }}
              >
                {KINDS.map(k => (
                  <option key={k} value={k} style={{ backgroundColor: '#111111' }}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>
                Статус <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as EventStatus)}
                disabled={loading || saving}
                className="w-full text-sm px-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333] disabled:opacity-50"
                style={{ borderColor: '#222222', color: '#FFFFFF' }}
              >
                <option value="confirmed" style={{ backgroundColor: '#111111' }}>
                  Подтверждено
                </option>
                <option value="expected" style={{ backgroundColor: '#111111' }}>
                  Ожидается
                </option>
              </select>
            </div>
          </div>

          {/* Companies */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs" style={{ color: '#9CA3AF' }}>
                Компании <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <button
                type="button"
                onClick={addCompany}
                disabled={loading || saving}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors hover:border-[#333333] disabled:opacity-50"
                style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#D1D5DB' }}
              >
                <Plus size={12} />
                Добавить
              </button>
            </div>

            <div className="space-y-2">
              {companies.map((company, index) => (
                <div key={index}>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={company.name}
                      onChange={e => updateCompany(index, { name: e.target.value })}
                      disabled={loading || saving}
                      placeholder="Название"
                      className="flex-1 min-w-0 text-sm px-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333] disabled:opacity-50"
                      style={{ borderColor: '#222222', color: '#FFFFFF' }}
                    />
                    <div className="w-52 shrink-0">
                      <InstrumentSearchInput
                        compact
                        dropdownAlign="right"
                        disabled={loading || saving}
                        initialQuery={company.ticker}
                        placeholder="Тикер"
                        onQueryChange={(q) => updateCompany(index, { ticker: q })}
                        onPick={(match) => updateCompany(index, { ticker: match.ticker, name: match.name })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCompany(index)}
                      disabled={loading || saving}
                      className="p-2 rounded border transition-colors hover:border-[#333333] disabled:opacity-50"
                      style={{ borderColor: '#222222', color: '#6B7280' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {(company.sources || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 ml-1">
                      {(company.sources || []).map(src => (
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-xs py-2 px-3 rounded" style={{ color: '#EF4444', backgroundColor: '#EF444411' }}>
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: '#222222' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[#222222] disabled:opacity-50"
            style={{ color: '#9CA3AF' }}
          >
            Отмена
          </button>
          <button
            type="submit"
            form="calendar-event-form"
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            style={{ backgroundColor: '#00D4FF', color: '#060606' }}
          >
            {saving && <RefreshCw size={14} className="animate-spin" />}
            {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
