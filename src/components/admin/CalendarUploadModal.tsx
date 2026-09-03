import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { adminApi } from '@/lib/api'
import type {
  CalendarIngestLiveResponse,
  CalendarIngestResponse,
  CalendarSource,
  ManualUploadResponse,
} from '@/types/calendar'

interface Props {
  isOpen: boolean
  /** Предвыбранный источник: 'auto' или feed-провайдер. */
  initialSource: string
  onClose: () => void
  /** После успешной загрузки — обновить таблицы. */
  onUploaded: () => void
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

export default function CalendarUploadModal({ isOpen, initialSource, onClose, onUploaded }: Props) {
  const [sources, setSources] = useState<CalendarSource[]>([])
  const [source, setSource] = useState<string>(initialSource)
  const [file, setFile] = useState<File | null>(null)
  const [rawPayload, setRawPayload] = useState<unknown | null>(null)
  const [preview, setPreview] = useState<CalendarIngestResponse | null>(null)
  const [manualPreview, setManualPreview] = useState<ManualUploadResponse | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CalendarIngestLiveResponse | null>(null)
  const [manualResult, setManualResult] = useState<ManualUploadResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isManual = source === 'manual-upload'

  // Селектор: только feed-источники + «Определить автоматически».
  useEffect(() => {
    if (!isOpen) return
    adminApi
      .get('/api/admin/calendar/sources')
      .then((res: any) => setSources(((res || []) as CalendarSource[]).filter(s => s.feed)))
      .catch(() => setSources([]))
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setSource(initialSource)
      setResult(null)
      setManualResult(null)
    }
  }, [isOpen, initialSource])

  const resetFile = useCallback(() => {
    setFile(null)
    setRawPayload(null)
    setPreview(null)
    setManualPreview(null)
    setResult(null)
    setManualResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const runDryRun = useCallback(async (payload: unknown, src: string) => {
    setPreviewLoading(true)
    setError(null)
    try {
      if (src === 'manual-upload') {
        const res = (await adminApi.post(
          '/api/admin/calendar/manual/upload?dry_run=1',
          payload
        )) as ManualUploadResponse
        setManualPreview(res)
        setPreview(null)
      } else {
        const res = (await adminApi.post(
          `/api/admin/calendar/${encodeURIComponent(src)}?dry_run=1`,
          payload
        )) as CalendarIngestResponse
        setPreview(res)
        setManualPreview(null)
      }
    } catch (err: any) {
      setPreview(null)
      setManualPreview(null)
      setError(err?.message || 'Не удалось получить превью')
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  const handleFileChange = async (selectedFile: File | null) => {
    resetFile()
    setError(null)
    if (!selectedFile) return

    let payload: unknown
    try {
      const text = await readFile(selectedFile)
      payload = JSON.parse(text)
    } catch {
      setError('Файл не является валидным JSON')
      return
    }

    setFile(selectedFile)
    setRawPayload(payload)
    await runDryRun(payload, source === 'manual-upload' ? 'manual-upload' : source === 'auto' ? 'auto' : source)
  }

  const handleSourceChange = async (next: string) => {
    setSource(next)
    setResult(null)
    setManualResult(null)
    if (rawPayload) {
      await runDryRun(rawPayload, next)
    }
  }

  const handleUpload = async () => {
    if (!rawPayload) return
    setUploading(true)
    setError(null)
    try {
      if (isManual) {
        const res = (await adminApi.post(
          '/api/admin/calendar/manual/upload',
          rawPayload
        )) as ManualUploadResponse
        setManualResult(res)
        setManualPreview(null)
      } else {
        const res = (await adminApi.post(
          `/api/admin/calendar/${encodeURIComponent(source)}`,
          rawPayload
        )) as CalendarIngestLiveResponse
        setResult(res)
        setPreview(null)
      }
      onUploaded()
    } catch (err: any) {
      setError(err?.message || 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    if (uploading) return
    resetFile()
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  const p = preview?.parsed
  const d = preview?.diff

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={handleClose}
    >
      <div
        className="rounded-xl border w-full overflow-hidden flex flex-col"
        style={{ backgroundColor: '#111111', borderColor: '#222222', maxWidth: 520, maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: '#222222' }}>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Upload size={16} style={{ color: '#00D4FF' }} />
            Загрузка среза провайдера
          </h3>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-1 rounded-lg hover:bg-[#222222] disabled:opacity-50"
            style={{ color: '#6B7280' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Provider selector */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>
              Источник <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              value={source}
              onChange={e => handleSourceChange(e.target.value)}
              disabled={uploading}
              className="w-full text-sm px-3 py-2 rounded border bg-transparent outline-none focus:border-[#333333] disabled:opacity-50"
              style={{ borderColor: '#222222', color: '#FFFFFF' }}
            >
              <option value="manual-upload" style={{ backgroundColor: '#111111' }}>
                Ручной срез (добавить, без замены)
              </option>
              <option value="auto" style={{ backgroundColor: '#111111' }}>
                Определить автоматически
              </option>
              {sources.map(s => (
                <option
                  key={s.source}
                  value={s.source}
                  disabled={!s.adapter_ready}
                  style={{ backgroundColor: '#111111' }}
                >
                  {s.source}
                  {s.adapter_ready ? '' : ' (скоро)'}
                </option>
              ))}
            </select>
            <p className="text-xs mt-1.5" style={{ color: '#6B7280' }}>
              {isManual
                ? 'События добавляются к существующим, ничего не удаляется. Свободный формат: date + title, остальное опционально.'
                : 'Загрузка заменяет предыдущий срез этого источника; канон пересобирается с учётом приоритетов.'}
            </p>
          </div>

          {/* File picker */}
          <div
            className="rounded-lg border border-dashed p-6 text-center cursor-pointer transition-colors hover:border-[#333333]"
            style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={28} className="mx-auto mb-3" style={{ color: '#6B7280' }} />
            <p className="text-sm text-white mb-1">{file ? file.name : 'Выберите JSON-файл'}</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Сырое содержимое уходит на бэкенд без локального парсинга. Превию — из dry_run-ответа.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={e => handleFileChange(e.target.files?.[0] || null)}
            />
          </div>

          {/* Preview from dry_run */}
          {previewLoading && (
            <div className="text-xs flex items-center gap-2" style={{ color: '#6B7280' }}>
              <RefreshCw size={14} className="animate-spin" />
              Получаем превью (dry_run)…
            </div>
          )}

          {p && d && !result && (
            <div className="rounded-lg border p-3 space-y-2" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>
                Превью (dry_run):
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span style={{ color: '#6B7280' }}>Дней:</span>{' '}
                  <span className="text-white font-medium">{p.days}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Событий:</span>{' '}
                  <span className="text-white font-medium">{p.events}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Период:</span>{' '}
                  <span className="text-white font-medium">
                    {p.date_from && p.date_to ? `${p.date_from} — ${p.date_to}` : '—'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Без тикера:</span>{' '}
                  <span className="text-white font-medium">{p.no_ticker}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Пропущено:</span>{' '}
                  <span className="text-white font-medium">{p.skipped}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Новых:</span>{' '}
                  <span className="text-white font-medium">{d.new_events}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Обновлено:</span>{' '}
                  <span className="text-white font-medium">{d.updated_events}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Подтверждений:</span>{' '}
                  <span className="text-white font-medium">{d.confirmations + d.confirmed_upgrades}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Будет снято:</span>{' '}
                  <span className="text-white font-medium">{d.removed_events}</span>
                </div>
              </div>
            </div>
          )}

          {/* Preview from dry_run: manual-upload (merge-счётчики) */}
          {manualPreview && !manualResult && (
            <div className="rounded-lg border p-3 space-y-2" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
              <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>
                Превью (dry_run):
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span style={{ color: '#6B7280' }}>Добавится:</span>{' '}
                  <span className="text-white font-medium">{manualPreview.added}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Дубли:</span>{' '}
                  <span className="text-white font-medium">{manualPreview.duplicates}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Воскреснет:</span>{' '}
                  <span className="text-white font-medium">{manualPreview.resurrected}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Ошибок:</span>{' '}
                  <span className="text-white font-medium">{manualPreview.invalid.length}</span>
                </div>
              </div>
              {manualPreview.invalid.length > 0 && (
                <ul className="text-xs space-y-1" style={{ color: '#F59E0B' }}>
                  {manualPreview.invalid.map((inv) => (
                    <li key={inv.index}>
                      #{inv.index + 1}: {inv.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Upload result: manual-upload */}
          {manualResult && (
            <div className="rounded-lg border p-3 space-y-2" style={{ backgroundColor: '#0A0A0A', borderColor: '#10B98140' }}>
              <p className="text-xs font-medium flex items-center gap-2" style={{ color: '#34D399' }}>
                <CheckCircle2 size={14} />
                События добавлены
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span style={{ color: '#6B7280' }}>Добавлено:</span>{' '}
                  <span className="text-white font-medium">{manualResult.added}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Дубли:</span>{' '}
                  <span className="text-white font-medium">{manualResult.duplicates}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Воскрешено:</span>{' '}
                  <span className="text-white font-medium">{manualResult.resurrected}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Ошибок:</span>{' '}
                  <span className="text-white font-medium">{manualResult.invalid.length}</span>
                </div>
              </div>
              <p className="text-xs flex items-center gap-2" style={{ color: '#6B7280' }}>
                <RefreshCw size={12} className="animate-spin" />
                Список обновится автоматически
              </p>
              {manualResult.invalid.length > 0 && (
                <ul className="text-xs space-y-1" style={{ color: '#F59E0B' }}>
                  {manualResult.invalid.map((inv) => (
                    <li key={inv.index}>
                      #{inv.index + 1}: {inv.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Upload result: live-ответ фида — только parse-статистика, канон в фоне */}
          {result && (
            <div className="rounded-lg border p-3 space-y-2" style={{ backgroundColor: '#0A0A0A', borderColor: '#10B98140' }}>
              <p className="text-xs font-medium flex items-center gap-2" style={{ color: '#34D399' }}>
                <CheckCircle2 size={14} />
                Срез загружен
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span style={{ color: '#6B7280' }}>Дней:</span>{' '}
                  <span className="text-white font-medium">{result.parsed.days}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Событий:</span>{' '}
                  <span className="text-white font-medium">{result.parsed.events}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Период:</span>{' '}
                  <span className="text-white font-medium">
                    {result.parsed.date_from && result.parsed.date_to
                      ? `${result.parsed.date_from} — ${result.parsed.date_to}`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Без тикера:</span>{' '}
                  <span className="text-white font-medium">{result.parsed.no_ticker}</span>
                </div>
                <div>
                  <span style={{ color: '#6B7280' }}>Пропущено:</span>{' '}
                  <span className="text-white font-medium">{result.parsed.skipped}</span>
                </div>
              </div>
              <p className="text-xs flex items-center gap-2" style={{ color: '#6B7280' }}>
                <RefreshCw size={12} className="animate-spin" />
                Канон пересобирается, список обновится автоматически
              </p>
              {result.parsed.warnings.length > 0 && (
                <p className="text-xs" style={{ color: '#F59E0B' }}>
                  {result.parsed.warnings.join('; ')}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#EF4444' }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: '#222222' }}>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[#222222] disabled:opacity-50"
            style={{ color: '#9CA3AF' }}
          >
            {result || manualResult ? 'Закрыть' : 'Отмена'}
          </button>
          {!result && !manualResult && (
            <button
              onClick={handleUpload}
              disabled={
                uploading ||
                previewLoading ||
                !rawPayload ||
                (isManual ? !manualPreview : !preview)
              }
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
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
