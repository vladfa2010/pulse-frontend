/**
 * PULSE — Админка: Music Library (TZ70).
 *
 * Загрузка и управление фоновыми треками радио (папка /opt/pulse/music на VDS,
 * проброшена в контейнер bind-mount'ом). Имя файла несёт метаданные:
 * N_title_YY_tempo_genre.mp3 (например 3_market_pulse_26_fast_dubstep.mp3).
 *
 *   upload  — drag&drop или выбор файла, POST /api/admin/radio/music/upload
 *             (multipart через adminApi.postForm; бэк валидирует имя, magic
 *             bytes, лимиты 50 файлов / 10 МБ / 2 ГБ папка)
 *   rename  — PATCH …/:filename (коррекция метаданных в имени)
 *   delete  — DELETE …/:filename
 *   preview — <audio> по публичному /api/radio/music/file/:filename
 *
 * Список поллится раз в 30 с (M-3 аудита: 10 с × N табов = лишняя нагрузка
 * на fs.readdir; 30 с достаточно — upload сам делает load() после успеха).
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Music, Upload, Trash2, Edit3, Play, Square, X } from 'lucide-react'
import { adminApi, type UploadProgress } from '@/lib/api'

export interface MusicTrack {
  filename: string
  id: number
  title: string
  year: number
  tempo: 'slow' | 'medium' | 'fast'
  genre: string
  sizeBytes: number
  addedAt: string
}

const FORMAT_HINT = 'N_title_YY_tempo_genre.mp3 (например 3_mysong_26_slow_rnb.mp3)'

export function MusicLibraryTab() {
  const [files, setFiles] = useState<MusicTrack[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewingFilename, setPreviewingFilename] = useState<string | null>(null)
  const [editingFilename, setEditingFilename] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // TZ70 v3: AbortController текущего upload'а — для кнопки «Отменить»
  const uploadAbortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await adminApi.get('/api/radio/music/list')
      setFiles(res.files || [])
      setError(null)
    } catch (err: any) {
      setError(err?.message || 'Не удалось получить список треков')
    }
  }, [])

  useEffect(() => {
    load()
    // M-3 аудита: 30 с вместо 10 с — меньше fs.readdir на бэке
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

const MAX_MUSIC_FILE_BYTES = 10 * 1024 * 1024 // 10 МБ — зеркало PULSE_MUSIC_MAX_FILE_SIZE на бэке

  const doUpload = useCallback(async (file: File) => {
    if (file.size > MAX_MUSIC_FILE_BYTES) {
      setError(`Файл слишком большой: ${(file.size / 1024 / 1024).toFixed(1)} МБ. Лимит — 10 МБ.`)
      return
    }
    setUploading(true)
    setError(null)
    setUploadProgress({ loaded: 0, total: file.size, percent: 0 })
    const abortController = new AbortController()
    uploadAbortRef.current = abortController
    try {
      const fd = new FormData()
      fd.append('file', file)
      await adminApi.postForm('/api/admin/radio/music/upload', fd, (p) => {
        // p.total > 0 — реальный прогресс; total = -1 — тело отправлено, бэк обрабатывает
        if (p.total > 0) setUploadProgress(p)
      }, abortController.signal)
      await load()
      // Показать 100% ещё 600 мс, потом очистить
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
    uploadAbortRef.current?.abort() // → xhr.onabort → reject «Загрузка отменена.»
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) doUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (filename: string) => {
    if (!confirm(`Удалить ${filename}?`)) return
    try {
      await adminApi.delete(`/api/admin/radio/music/${encodeURIComponent(filename)}`)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Delete failed')
    }
  }

  const handleRename = async () => {
    if (!editingFilename) return
    try {
      await adminApi.patch(
        `/api/admin/radio/music/${encodeURIComponent(editingFilename)}`,
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
    const audio = new Audio(`/api/radio/music/file/${encodeURIComponent(filename)}`)
    audio.onended = () => setPreviewingFilename(null)
    audio.onerror = () => setPreviewingFilename(null)
    audio.play().catch(() => setPreviewingFilename(null))
    audioRef.current = audio
    setPreviewingFilename(filename)
  }

  const totalMB = (files.reduce((s, f) => s + (f.sizeBytes || 0), 0) / 1024 / 1024).toFixed(1)

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
          <Music size={14} />
          Music Library · фоновая музыка в эфире
        </span>
        <span className="text-xs whitespace-nowrap" style={{ color: '#6B7280' }}>
          {files.length} файлов · {totalMB} МБ · /opt/pulse/music
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
            {uploading ? 'Загрузка на сервер…' : 'Перетащите .mp3 сюда или кликните для выбора'}
          </div>

          {/* TZ70 v3: progress-bar (пока идёт upload или показываем 100% 600 мс после) */}
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
                    e.stopPropagation() // не открывать file picker родительским onClick
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
            Лимиты: до 50 файлов · до 10 МБ на файл
          </div>
          <input ref={fileInputRef} type="file" accept=".mp3,audio/mpeg" onChange={handleUpload} className="hidden" />
        </div>

        {/* Список файлов */}
        <div className="space-y-2">
          {files.length === 0 && !error && (
            <div className="p-8 text-center text-sm" style={{ color: '#71717a' }}>
              Нет треков. Загрузите первый — без треков в эфире просто тишина.
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
                    <div className="text-sm text-white truncate">{f.title}</div>
                    <div className="text-[10px] flex gap-2 mt-0.5 font-mono" style={{ color: '#71717a' }}>
                      <span>{f.filename}</span>
                      <span>·</span>
                      <span>{f.year}</span>
                      <span>·</span>
                      <span>{f.tempo}</span>
                      <span>·</span>
                      <span>{f.genre}</span>
                      <span>·</span>
                      <span>{((f.sizeBytes || 0) / 1024 / 1024).toFixed(1)}МБ</span>
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

export default MusicLibraryTab
