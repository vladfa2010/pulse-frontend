import { useState, useEffect, useCallback } from 'react'
import { CalendarDays, Upload, RefreshCw, AlertCircle, CheckCircle2, Calendar } from 'lucide-react'
import { adminApi, API_BASE } from '@/lib/api'
import type { CalendarAdminEvent, CalendarResponse } from '@/types/calendar'
import CalendarEventsTable from '@/components/admin/CalendarEventsTable'
import CalendarEventModal from '@/components/admin/CalendarEventModal'
import CalendarSourcesTable from '@/components/admin/CalendarSourcesTable'
import CalendarUploadModal from '@/components/admin/CalendarUploadModal'

export default function CalendarTab() {
  const [data, setData] = useState<CalendarResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [uploadSource, setUploadSource] = useState<string>('auto')

  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarAdminEvent | null>(null)
  const [refreshTable, setRefreshTable] = useState(0)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  const [llmEnabled, setLlmEnabled] = useState<boolean | null>(null)
  const [llmLoading, setLlmLoading] = useState(false)

  useEffect(() => {
    adminApi
      .get('/api/admin/calendar/settings')
      .then((res: any) => setLlmEnabled(res.llm_enabled === true))
      .catch((err) => console.error('[CalendarTab] Failed to load settings:', err))
  }, [])

  const handleToggleLlm = async () => {
    if (llmLoading || llmEnabled === null) return
    const next = !llmEnabled
    setLlmLoading(true)
    try {
      const res: any = await adminApi.put('/api/admin/calendar/settings', { llm_enabled: next })
      setLlmEnabled(res.llm_enabled === true)
    } catch (err: any) {
      console.error('[CalendarTab] Failed to update settings:', err)
    } finally {
      setLlmLoading(false)
    }
  }

  const openCreate = () => {
    setSelectedEvent(null)
    setEditorOpen(true)
  }

  const openEdit = (event: CalendarAdminEvent) => {
    setSelectedEvent(event)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setSelectedEvent(null)
  }

  const handleSaved = () => {
    closeEditor()
    setSaveSuccess('Событие сохранено. Список обновится автоматически через несколько секунд.')
    setRefreshTable(n => n + 1)
    window.setTimeout(() => setSaveSuccess(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.get('/api/calendar')
      setData(res as CalendarResponse)
    } catch (err: any) {
      if (err?.status === 503 && err?.message === 'calendar_not_loaded') {
        setData(null)
      } else {
        setError(err?.message || 'Failed to load calendar')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // SSE: фоновая пересборка канона завершена → обновляем таблицы.
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/news/stream`)
    es.addEventListener('calendar:refresh', () => {
      console.log('[CalendarTab] SSE calendar:refresh received')
      load()
      setRefreshTable(n => n + 1)
    })
    es.onerror = (err) => {
      console.warn('[CalendarTab] SSE error:', err)
    }
    return () => es.close()
  }, [load])

  const openModal = (source: string) => {
    setUploadSource(source)
    setIsModalOpen(true)
  }

  return (
    <div>
      {/* Header */}
      <div
        className="rounded-xl border p-6 mb-6"
        style={{ backgroundColor: '#111111', borderColor: '#222222' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <CalendarDays size={18} style={{ color: '#00D4FF' }} />
              Календарь инвестора
            </h2>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              {data
                ? `Загружено: ${data.days.length} дней, сгенерировано ${new Date(data.generated_at).toLocaleString('ru-RU')}`
                : 'Снапшот ещё не загружен'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={llmEnabled ?? true}
                onChange={handleToggleLlm}
                disabled={llmLoading || llmEnabled === null}
              />
              <div
                className="w-9 h-5 rounded-full transition-colors peer-checked:bg-[#00D4FF]"
                style={{ backgroundColor: llmEnabled ? '#00D4FF' : '#222222' }}
              >
                <div
                  className="absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-white transition-transform"
                  style={{ transform: llmEnabled ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </div>
              <span className="ml-2 text-xs" style={{ color: '#9CA3AF' }}>
                LLM-матчинг тегов
              </span>
            </label>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all hover:border-[#333333] disabled:opacity-50"
              style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Обновить
            </button>
            <button
              onClick={() => openModal('auto')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: '#00D4FF', color: '#060606' }}
            >
              <Upload size={14} />
              Загрузить срез
            </button>
          </div>
        </div>
      </div>

      {/* State messages */}
      {saveSuccess && (
        <div
          className="rounded-xl border p-4 mb-6 flex items-center gap-3"
          style={{ backgroundColor: '#34D39915', borderColor: '#34D39930', color: '#34D399' }}
        >
          <CheckCircle2 size={18} />
          <p className="text-sm">{saveSuccess}</p>
        </div>
      )}

      {error && (
        <div
          className="rounded-xl border p-4 mb-6 flex items-center gap-3"
          style={{ backgroundColor: '#EF444415', borderColor: '#EF444430', color: '#EF4444' }}
        >
          <AlertCircle size={18} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!data && !error && !loading && (
        <div
          className="rounded-xl border p-12 text-center mb-6"
          style={{ backgroundColor: '#111111', borderColor: '#222222' }}
        >
          <Calendar size={40} className="mx-auto mb-4" style={{ color: '#6B7280' }} />
          <p className="text-sm" style={{ color: '#9CA3AF' }}>
            Снапшот календаря не загружен. Нажмите «Загрузить срез».
          </p>
        </div>
      )}

      {data && (
        <div
          className="rounded-xl border overflow-hidden mb-6"
          style={{ backgroundColor: '#111111', borderColor: '#222222' }}
        >
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#222222' }}>
            <span className="text-sm font-medium" style={{ color: '#9CA3AF' }}>
              Ближайшие даты
            </span>
            <span className="text-xs" style={{ color: '#6B7280' }}>
              server_date: {data.server_date}
            </span>
          </div>
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.days.slice(0, 18).map((day) => (
              <div
                key={day.date}
                className="rounded-lg p-3 border"
                style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}
              >
                <div className="text-xs" style={{ color: '#6B7280' }}>
                  {day.date} · {day.weekday}
                </div>
                <div className="text-sm font-medium mt-1 text-white">
                  {day.groups.length} событий
                </div>
                <div className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                  {day.groups.reduce((acc, g) => acc + g.companies.length, 0)} компаний
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources table */}
      <CalendarSourcesTable onUpload={openModal} refreshSignal={refreshTable} />

      {/* Events table */}
      <CalendarEventsTable
        onEdit={openEdit}
        onAdd={openCreate}
        refreshSignal={refreshTable}
      />

      {/* Event editor modal */}
      <CalendarEventModal
        isOpen={editorOpen}
        event={selectedEvent}
        onClose={closeEditor}
        onSaved={handleSaved}
      />

      {/* Upload modal */}
      <CalendarUploadModal
        isOpen={isModalOpen}
        initialSource={uploadSource}
        onClose={() => setIsModalOpen(false)}
        onUploaded={() => {
          load()
          setRefreshTable(n => n + 1)
        }}
      />
    </div>
  )
}
