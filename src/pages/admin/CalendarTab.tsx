import { useState, useEffect, useCallback, useRef } from 'react'
import { CalendarDays, Upload, X, RefreshCw, AlertCircle, CheckCircle2, Calendar } from 'lucide-react'
import { adminApi } from '@/lib/api'
import type { CalendarDay, CalendarEventGroup, CalendarResponse, EventKind, CalendarAdminEvent } from '@/types/calendar'
import CalendarEventsTable from '@/components/admin/CalendarEventsTable'
import CalendarEventModal from '@/components/admin/CalendarEventModal'

const MONTHS: Record<string, number> = {
  января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
  июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
}

const WD_MAP: Record<string, string> = {
  пн: 'пн', вт: 'вт', ср: 'ср', чт: 'чт', пт: 'пт', сб: 'сб', вс: 'вс',
}

const COMPANY_RE = /^([АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯA-Z])\s+(.+?)\s+([A-Z][A-Z0-9.]*)$/

interface RawInvestmintItem {
  date: string
  events: string[]
  fullText?: string
}

interface RawSmartlabItem {
  date: string
  time?: string
  title: string
  text?: string
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function inferYear(month: number): number {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  return month < currentMonth ? currentYear + 1 : currentYear
}

function parseDate(str: string): { date: string; weekday: string } | null {
  const m = str.match(/^(\d{1,2})\s+([а-яё]+)\s+(\S+)\s*$/i)
  if (!m) return null
  const [, day, monthRaw, wdRaw] = m
  const month = MONTHS[monthRaw.toLowerCase()]
  if (!month) return null
  const weekday = WD_MAP[wdRaw.toLowerCase()] || wdRaw.toLowerCase()
  const year = inferYear(month)
  const date = `${year}-${pad(month)}-${pad(parseInt(day, 10))}`
  return { date, weekday }
}

function splitTokens(s: string): string[] {
  return s
    .split(/\s{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function parseCompany(token: string): { name: string; ticker: string } | null {
  const m = token.match(COMPANY_RE)
  if (!m) return null
  return { name: m[2].trim(), ticker: m[3].trim().toUpperCase() }
}

function hasWord(text: string, word: string): boolean {
  const tokens = text.toLowerCase().split(/[^a-zа-яё0-9]+/).filter(Boolean)
  return tokens.includes(word.toLowerCase())
}

function detectKind(title: string): EventKind {
  const t = title.toLowerCase()
  // СД: совет директоров или отдельное слово «сд»
  if (t.includes('совет директоров') || hasWord(t, 'сд')) return 'СД'
  // СА: собрания акционеров / ГОСА / ВОСА / общее слово «собрание»
  if (hasWord(t, 'госа') || hasWord(t, 'воса') || t.includes('собрание акционеров') || hasWord(t, 'собрание')) {
    return 'СА'
  }
  // Отчётности
  if (t.includes('мсфо')) return 'МСФО'
  if (t.includes('рсбу')) return 'РСБУ'
  // Дивиденды — после СД, чтобы «СД по дивидендам» шло в СД
  if (t.includes('дивиденд')) return 'Дивиденды'
  return 'Другое'
}

function detectStatus(title: string): 'confirmed' | 'expected' {
  const t = title.toLowerCase()
  return t.includes('ожидается') || t.includes('предварительно') ? 'expected' : 'confirmed'
}

function parseInvestmintCalendar(raw: RawInvestmintItem[]): CalendarDay[] {
  const days = new Map<string, { weekday: string; groups: Map<string, CalendarEventGroup> }>()

  for (const item of raw) {
    const parsedDate = parseDate(item.date)
    if (!parsedDate) continue

    if (!days.has(parsedDate.date)) {
      days.set(parsedDate.date, { weekday: parsedDate.weekday, groups: new Map() })
    }
    const day = days.get(parsedDate.date)!

    for (const ev of item.events || []) {
      const tokens = splitTokens(ev)
      if (tokens.length < 2) continue

      const title = tokens[0]
      const companies: { name: string; ticker: string }[] = []
      for (const tok of tokens.slice(1)) {
        const c = parseCompany(tok)
        if (c) companies.push(c)
      }
      if (companies.length === 0) continue

      const kind = detectKind(title)
      const status = detectStatus(title)
      const key = `${title}|${kind}`

      if (!day.groups.has(key)) {
        day.groups.set(key, { title, kind, status, companies: [] })
      }
      const group = day.groups.get(key)!
      for (const c of companies) {
        if (!group.companies.some((x) => x.ticker === c.ticker)) {
          group.companies.push(c)
        }
      }
    }
  }

  const result: CalendarDay[] = []
  for (const date of Array.from(days.keys()).sort()) {
    const d = days.get(date)!
    const groups = Array.from(d.groups.values())
    groups.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    for (const g of groups) {
      g.companies.sort((a, b) => a.ticker.localeCompare(b.ticker))
    }
    result.push({ date, weekday: d.weekday, groups })
  }

  return result
}

function isSmartlabItem(item: unknown): item is RawSmartlabItem {
  if (!item || typeof item !== 'object') return false
  const i = item as any
  return (
    typeof i.date === 'string' &&
    /^\d{2}\.\d{2}\.\d{4}$/.test(i.date) &&
    typeof i.title === 'string'
  )
}

function parseSmartlabDate(str: string): { date: string; weekday: string } | null {
  const m = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m) return null
  const [, day, month, year] = m
  const date = `${year}-${month}-${day}`
  const d = new Date(`${date}T00:00:00`)
  const weekday = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][d.getDay()]
  return { date, weekday }
}

function parseSmartlabTickerTitle(fullTitle: string): { ticker: string; title: string } {
  const m = fullTitle.match(/^([A-Z][A-Z0-9]{1,5})(?:\s*[:\-]\s*)(.+)$/)
  if (m) {
    return { ticker: m[1].trim().toUpperCase(), title: m[2].trim() }
  }
  return { ticker: '', title: fullTitle.trim() }
}

function parseSmartlabCalendar(raw: RawSmartlabItem[]): { days: CalendarDay[]; noTicker: number; skipped: number } {
  const days = new Map<string, { weekday: string; groups: Map<string, CalendarEventGroup> }>()
  let skipped = 0
  let noTicker = 0

  for (const item of raw) {
    const parsedDate = parseSmartlabDate(item.date)
    if (!parsedDate) continue

    if (!days.has(parsedDate.date)) {
      days.set(parsedDate.date, { weekday: parsedDate.weekday, groups: new Map() })
    }
    const day = days.get(parsedDate.date)!

    const fullTitle = (item.title || '').trim()
    if (!fullTitle) {
      skipped++
      continue
    }

    const parsedTitle = parseSmartlabTickerTitle(fullTitle)
    const kind = detectKind(parsedTitle.title)
    const status = detectStatus(parsedTitle.title)
    const title = parsedTitle.title
    const key = `${title}|${kind}`

    if (!day.groups.has(key)) {
      day.groups.set(key, { title, kind, status, companies: [] })
    }
    const group = day.groups.get(key)!

    const ticker = parsedTitle.ticker || 'UNKNOWN'
    if (!parsedTitle.ticker) {
      noTicker++
    }
    if (!group.companies.some((x) => x.ticker === ticker)) {
      group.companies.push({ name: parsedTitle.ticker ? parsedTitle.ticker : fullTitle, ticker })
    }
  }

  if (noTicker > 0) {
    console.warn(`[Smartlab parser] ${noTicker} entries saved with UNKNOWN ticker`)
  }
  if (skipped > 0) {
    console.warn(`[Smartlab parser] skipped ${skipped} empty entries`)
  }

  const result: CalendarDay[] = []
  for (const date of Array.from(days.keys()).sort()) {
    const d = days.get(date)!
    const groups = Array.from(d.groups.values())
    if (groups.length === 0) continue
    groups.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    for (const g of groups) {
      g.companies.sort((a, b) => a.ticker.localeCompare(b.ticker))
    }
    result.push({ date, weekday: d.weekday, groups })
  }

  return { days: result, noTicker, skipped }
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

export default function CalendarTab() {
  const [data, setData] = useState<CalendarResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pendingDays, setPendingDays] = useState<CalendarDay[] | null>(null)
  const [preview, setPreview] = useState<{
    days: number
    events: number
    companies: number
    firstDate: string
    lastDate: string
    noTicker?: number
    skipped?: number
  } | null>(null)
  const [uploadMode, setUploadMode] = useState<'replace' | 'merge'>('merge')

  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarAdminEvent | null>(null)
  const [refreshTable, setRefreshTable] = useState(0)

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
    load()
    setRefreshTable(n => n + 1)
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

  const handleUpload = async () => {
    if (!pendingDays) return
    setUploading(true)
    setUploadError(null)
    setUploadSuccess(false)

    try {
      const res = await adminApi.post(`/api/admin/calendar?mode=${uploadMode}`, { days: pendingDays })
      setUploadSuccess(true)
      setFile(null)
      setPendingDays(null)
      setPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
      console.log('[Calendar upload]', res)
      setTimeout(() => setIsModalOpen(false), 1200)
    } catch (err: any) {
      setUploadError(err?.message || 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  const resetModal = () => {
    setFile(null)
    setUploadError(null)
    setUploadSuccess(false)
    setUploading(false)
    setPendingDays(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = async (selectedFile: File | null) => {
    setFile(selectedFile)
    setUploadError(null)
    setUploadSuccess(false)
    setPreview(null)
    setPendingDays(null)

    if (!selectedFile) return

    try {
      const text = await readFile(selectedFile)
      const parsed = JSON.parse(text)
      let days: CalendarDay[]

      let noTicker = 0
      let skipped = 0

      if (Array.isArray(parsed) && parsed.length > 0 && isSmartlabItem(parsed[0])) {
        const smartlab = parseSmartlabCalendar(parsed as RawSmartlabItem[])
        days = smartlab.days
        noTicker = smartlab.noTicker
        skipped = smartlab.skipped
      } else if (Array.isArray(parsed)) {
        days = parseInvestmintCalendar(parsed as RawInvestmintItem[])
      } else if (parsed?.days && Array.isArray(parsed.days)) {
        days = parsed.days as CalendarDay[]
      } else {
        throw new Error('Непонятный формат файла. Ожидается массив дней или объект { days: [...] }')
      }

      if (days.length === 0) {
        throw new Error('В файле не найдено ни одного дня')
      }

      const events = days.reduce((acc, d) => acc + d.groups.length, 0)
      const companies = days.reduce(
        (acc, d) => acc + d.groups.reduce((gAcc, g) => gAcc + g.companies.length, 0),
        0
      )
      const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))

      setPreview({
        days: days.length,
        events,
        companies,
        firstDate: sorted[0].date,
        lastDate: sorted[sorted.length - 1].date,
        noTicker,
        skipped,
      })
      setPendingDays(days)
    } catch (err: any) {
      setUploadError(err?.message || 'Не удалось распознать файл')
    }
  }

  const openModal = () => {
    resetModal()
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (uploading) return
    setIsModalOpen(false)
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
              onClick={openModal}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: '#00D4FF', color: '#060606' }}
            >
              <Upload size={14} />
              Загрузить снапшот
            </button>
          </div>
        </div>
      </div>

      {/* State messages */}
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
          className="rounded-xl border p-12 text-center"
          style={{ backgroundColor: '#111111', borderColor: '#222222' }}
        >
          <Calendar size={40} className="mx-auto mb-4" style={{ color: '#6B7280' }} />
          <p className="text-sm" style={{ color: '#9CA3AF' }}>
            Снапшот календаря не загружен. Нажмите «Загрузить снапшот».
          </p>
        </div>
      )}

      {data && (
        <div
          className="rounded-xl border overflow-hidden"
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

      {/* Events table */}
      <div className="mt-6">
        <CalendarEventsTable
          onEdit={openEdit}
          onAdd={openCreate}
          refreshSignal={refreshTable}
        />
      </div>

      {/* Event editor modal */}
      <CalendarEventModal
        isOpen={editorOpen}
        event={selectedEvent}
        onClose={closeEditor}
        onSaved={handleSaved}
      />

      {/* Upload modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={closeModal}
        >
          <div
            className="rounded-xl border w-full overflow-hidden"
            style={{ backgroundColor: '#111111', borderColor: '#222222', maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#222222' }}>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Upload size={16} style={{ color: '#00D4FF' }} />
                Загрузка снапшота
              </h3>
              <button
                onClick={closeModal}
                disabled={uploading}
                className="p-1 rounded-lg hover:bg-[#222222] disabled:opacity-50"
                style={{ color: '#6B7280' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div
                className="rounded-lg border border-dashed p-6 text-center cursor-pointer transition-colors hover:border-[#333333]"
                style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={28} className="mx-auto mb-3" style={{ color: '#6B7280' }} />
                <p className="text-sm text-white mb-1">
                  {file ? file.name : 'Выберите JSON-файл'}
                </p>
                <p className="text-xs" style={{ color: '#6B7280' }}>
                  Поддерживается raw-формат investmint_calendar.json или готовый {'{ days: [...] }'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
              </div>

              {preview && (
                <div
                  className="rounded-lg border p-3 space-y-2"
                  style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}
                >
                  <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>
                    Предпросмотр файла:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span style={{ color: '#6B7280' }}>Дней:</span>{' '}
                      <span className="text-white font-medium">{preview.days}</span>
                    </div>
                    <div>
                      <span style={{ color: '#6B7280' }}>Событий:</span>{' '}
                      <span className="text-white font-medium">{preview.events}</span>
                    </div>
                    <div>
                      <span style={{ color: '#6B7280' }}>Компаний:</span>{' '}
                      <span className="text-white font-medium">{preview.companies}</span>
                    </div>
                    <div>
                      <span style={{ color: '#6B7280' }}>Период:</span>{' '}
                      <span className="text-white font-medium">
                        {preview.firstDate} — {preview.lastDate}
                      </span>
                    </div>
                  </div>
                  {(preview.noTicker || 0) > 0 && (
                    <div className="text-xs" style={{ color: '#F59E0B' }}>
                      ⚠️ {preview.noTicker} записей без тикера сохранятся с тикером UNKNOWN (название взято из заголовка).
                    </div>
                  )}
                  {(preview.skipped || 0) > 0 && (
                    <div className="text-xs" style={{ color: '#F59E0B' }}>
                      ⚠️ Пропущено {preview.skipped} пустых записей.
                    </div>
                  )}
                </div>
              )}

              <div
                className="rounded-lg border p-3 space-y-2"
                style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}
              >
                <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>
                  Режим загрузки
                </p>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="merge"
                      checked={uploadMode === 'merge'}
                      onChange={() => setUploadMode('merge')}
                      className="mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="text-white font-medium">Добавить новое (merge)</span>
                      <p style={{ color: '#6B7280' }}>
                        Проверяет дубли по (дата + заголовок + тип) и добавляет только отсутствующие события. Существующие не трогает.
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="replace"
                      checked={uploadMode === 'replace'}
                      onChange={() => setUploadMode('replace')}
                      className="mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="text-white font-medium">Полная замена (replace)</span>
                      <p style={{ color: '#6B7280' }}>
                        Удаляет весь старый календарь и загружает только этот файл.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {uploadError && (
                <div className="flex items-center gap-2 text-xs" style={{ color: '#EF4444' }}>
                  <AlertCircle size={14} />
                  {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div className="flex items-center gap-2 text-xs" style={{ color: '#34D399' }}>
                  <CheckCircle2 size={14} />
                  Снапшот загружен успешно
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#222222' }}>
              <button
                onClick={closeModal}
                disabled={uploading}
                className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[#222222] disabled:opacity-50"
                style={{ color: '#9CA3AF' }}
              >
                Отмена
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !pendingDays}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{ backgroundColor: '#00D4FF', color: '#060606' }}
              >
                {uploading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Загрузка…
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Загрузить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
