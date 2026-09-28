/**
 * PULSE — Админка: SFX Library (TZ71).
 *
 * Загрузка и управление звуковыми эффектами («пилик» о новой новости).
 * Папка /opt/pulse/sfx на VDS (bind-mount в контейнер). Имя без метаданных:
 * [a-z0-9_]+.(mp3|wav|ogg) — см. backend services/radioSfx.ts.
 *
 *   upload  — drag&drop или выбор файла, POST /api/admin/radio/sfx/upload
 *             (multipart через adminApi.postForm с progress-bar, TZ70 v3;
 *             бэк валидирует имя, magic bytes формата, лимиты 20 файлов /
 *             2 МБ на файл / 100 МБ папка)
 *   rename  — PATCH …/:filename
 *   delete  — DELETE …/:filename
 *   preview — <audio> по публичному /api/radio/sfx/file/:filename
 *
 * Список поллится раз в 30 с (как Music Library).
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Upload, Trash2, Edit3, Play, Square, X } from 'lucide-react'
import { adminApi, type UploadProgress } from '@/lib/api'

export interface SfxFile {
  filename: string
  sizeBytes: number
  addedAt: string
}

const FORMAT_HINT = '[a-z0-9_]+.(mp3|wav|ogg) — например news_cue.mp3'

export function SfxLibraryTab() {
  const [files, setFiles] = useState<SfxFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewingFilename, setPreviewingFilename] = useState<string | null>(null)
  const [editingFilename, setEditingFilename] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await adminApi.get('/api/radio/sfx/list')
      setFiles(res.files || [])
      setError(null)
    } catch (err: any) {
      setError(err?.message || 'Не удалось получить список SFX')
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  // Cleanup audio on unmount
  useEffect(() => () => {
    audioRef.current?.pause()
    audioRef.current = null
  }, [])

  const formatBytes = (n: number) => {
    if (n < 1024) return `${n} Б`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`
    return `${(n / 1024 / 1024).toFixed(2)} МБ`
  }

  const doUpload = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    setUploadProgress({ loaded: 0, total: file.size, percent: 0 })
    const abortController = new AbortController()
    uploadAbortRef.current = abortController
    try {
      const fd = new FormData()
      fd.append('file', file)
      await adminApi.postForm('/api/admin/radio/sfx/upload', fd, (p) => {
        if (p.total > 0) setUploadProgress(p)
      }, abortController.signal)
      await load()
      setTimeout(() => setUploadProgress(null), 600)
    } catch (err: any) {
      setError(err?.message || 'Upload failed')
      setUploadProgress(null)
    } finally {
      setUploading(false)
      uploadAbortRef.current = null
    }
  }, [load])

  const cancelUpload = () => {
    uploadAbortRef.current?.abort()
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) doUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (filename: string) => {
    if (!confirm(`Удалить ${filename}?`)) return
    try {
      await adminApi.delete(`/api/admin/radio/sfx/${encodeURIComponent(filename)}`)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Delete failed')
    }
  }

  const handleRename = async () => {
    if (!editingFilename) return
    try {
      await adminApi.patch(
        `/api/admin/radio/sfx/${encodeURIComponent(editingFilename)}`,
        { newFilename: newName },
      )
      setEditingFilename(null)
      setNewName('')
      await load()
    } catch (err: any) {
      setError(err?.message || 'Rename failed')
    }
  }

  const togglePreview = (filename: string) => {
    if (previewingFilename === filename) {
      audioRef.current?.pause()
      audioRef.current = null
      setPreviewingFilename(null)
      return
    }
    audioRef.current?.pause()
    const audio = new Audio(`/api/radio/sfx/file/${encodeURIComponent(filename)}`)
    audio.onended = () => setPreviewingFilename(null)
    audio.onerror = () => setPreviewingFilename(null)
    audio.play().catch(() => setPreviewingFilename(null))
    audioRef.current = audio
    setPreviewingFilename(filename)
  }

  const totalKB = (files.reduce((s, f) => s + (f.sizeBytes || 0), 0) / 1024).toFixed(1)

  return (
    <div
      className="rounded-xl border overflow-hidden mt-6"
      style={{ backgroundColor: '#111111', borderColor: '#222222' }}
    >
      <div
        className="px-6 py-4 border-b flex items-center justify-between gap-4"
        style={{ borderColor: '#222222' }}
      >
        <span className="text-sm font-medium flex items-center gap-2" style={{ color: '#9CA3AF' }}>
          <Bell size={14} />
          SFX Library · «пилик» о новой новости
        </span>
        <span className="text-xs whitespace-nowrap" style={{ color: '#6B7280' }}>
          {files.length} файлов · {totalKB} КБ · /opt/pulse/sfx
        </span>
      </div>

      {error && (
        <div
          className="m-4 rounded-lg border p-3 text-sm flex items-start justify-between gap-3"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#EF4444' }}
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Drop-zone / upload */}
        <div
          className="rounded-lg border-2 border-dashed p-6 text-center transition-colors"
          style={{ borderColor: uploading ? '#00D4FF' : '#333333' }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files?.[0]
            if (file && !uploading) doUpload(file)
          }}
        >
          <Upload size={28} className="mx-auto" style={{ color: uploading ? '#00D4FF' : '#9CA3AF' }} />
          <div className="mt-2 text-sm" style={{ color: '#9CA3AF' }}>
            {uploading ? 'Загрузка на сервер…' : 'Перетащите .mp3/.wav/.ogg сюда или кликните для выбора'}
          </div>

          {/* Progress bar (TZ70 v3-паттерн) */}
          {uploadProgress && (uploading || uploadProgress.percent === 100) && (
            <div className="mt-3 max-w-md mx-auto">
              <div className="flex items-center justify-between text-[11px] mb-1" style={{ color: '#9CA3AF' }}>
                <span>
                  {uploadProgress.total > 0 && uploadProgress.percent < 100
                    ? `Отправлено ${uploadProgress.percent}%`
                    : 'Обрабатывается на сервере…'}
                </span>
                <span className="font-mono">
                  {uploadProgress.total > 0
                    ? `${formatBytes(uploadProgress.loaded)} / ${formatBytes(uploadProgress.total)}`
                    : '…'}
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="h-full transition-all duration-200 ease-out"
                  style={{
                    width: `${uploadProgress.percent}%`,
                    backgroundColor: uploadProgress.percent === 100 ? '#22c55e' : '#00D4FF',
                  }}
                />
              </div>
              {uploading && uploadProgress.percent < 100 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    cancelUpload()
                  }}
                  className="mt-2 text-[11px] underline"
                  style={{ color: '#EF4444' }}
                >
                  Отменить
                </button>
              )}
            </div>
          )}

          <div className="text-[10px] mt-1 font-mono" style={{ color: '#71717a' }}>
            Формат имени: {FORMAT_HINT}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: '#71717a' }}>
            Лимиты: до 20 файлов · до 2 МБ на файл
          </div>
          <input ref={fileInputRef} type="file" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg" onChange={handleUpload} className="hidden" />
        </div>

        {/* Список файлов */}
        <div className="space-y-2">
          {files.length === 0 && !error && (
            <div className="p-8 text-center text-sm" style={{ color: '#71717a' }}>
              Нет SFX. Без файлов «пилик» — синтетический тон (как раньше).
            </div>
          )}
          {files.map((f) => (
            <div
              key={f.filename}
              className="flex items-center gap-3 p-3 rounded-lg border"
              style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}
            >
              <button
                onClick={() => togglePreview(f.filename)}
                title={previewingFilename === f.filename ? 'Остановить' : 'Прослушать'}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  backgroundColor: previewingFilename === f.filename ? '#00D4FF' : 'rgba(0,212,255,0.10)',
                  border: '1px solid rgba(0,212,255,0.30)',
                  color: previewingFilename === f.filename ? '#060606' : '#00D4FF',
                }}
              >
                {previewingFilename === f.filename ? <Square size={13} /> : <Play size={13} className="ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                {editingFilename === f.filename ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename()
                        if (e.key === 'Escape') setEditingFilename(null)
                      }}
                      className="flex-1 px-2 py-1 rounded text-xs font-mono"
                      style={{ backgroundColor: '#18181b', border: '1px solid #27272a', color: '#FFFFFF' }}
                    />
                    <button
                      onClick={handleRename}
                      className="text-xs px-2 py-1 rounded"
                      style={{ backgroundColor: '#00D4FF', color: '#060606' }}
                    >
                      OK
                    </button>
                    <button
                      onClick={() => setEditingFilename(null)}
                      className="text-xs px-2 py-1 rounded"
                      style={{ backgroundColor: '#27272a', color: '#9CA3AF' }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-white truncate font-mono">{f.filename}</div>
                    <div className="text-[10px] flex gap-2 mt-0.5 font-mono" style={{ color: '#71717a' }}>
                      <span>{formatBytes(f.sizeBytes || 0)}</span>
                      <span>·</span>
                      <span>{new Date(f.addedAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => {
                    setEditingFilename(f.filename)
                    setNewName(f.filename)
                  }}
                  title="Переименовать"
                  className="w-8 h-8 rounded flex items-center justify-center hover:bg-zinc-800"
                  style={{ color: '#9CA3AF' }}
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => handleDelete(f.filename)}
                  title="Удалить"
                  className="w-8 h-8 rounded flex items-center justify-center hover:bg-red-900/40"
                  style={{ color: '#EF4444' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SfxLibraryTab
