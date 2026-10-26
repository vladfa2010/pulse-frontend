import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, FileArchive, FileAudio, FileSpreadsheet, FileText, File as FileIcon, Film, Trash2 } from 'lucide-react'
import {
  deleteFile,
  fetchFiles,
  fetchTrash,
  mediaUrl,
  purgeTrashFile,
  restoreTrashFile,
} from './api'
import type { EduFileEntry, FileUsage, FilesListResponse, TrashEntry } from './api'
import { C } from './ui'

// Под-вкладка «Файлы» (ТЗ-199): медиатека storage LMS — превью, привязки
// «где используется», копирование пути, удаление с защитой (409 + модалка),
// корзина tmp/trash с восстановлением и purge. Дизайн — §8 ТЗ-199 (мокап
// перенесён 1:1: токены, геометрия сетки/карточек, вертикальный hover-оверлей,
// модалки, корзина строками). Панель держится смонтированной в EducationTab
// (display:none), ленивая загрузка при первом рендере — как StatsPanel.

type Segment = 'all' | 'courses' | 'content' | 'materials' | 'trash'

const SEGMENTS: { id: Segment; label: string; kind?: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'courses', label: 'Обложки', kind: 'courses' },
  { id: 'content', label: 'Контент уроков', kind: 'content' },
  { id: 'materials', label: 'Материалы', kind: 'materials' },
  { id: 'trash', label: 'Корзина' },
]

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg'])
const TRASH_RETENTION_DAYS = 30

// ─── Мелкие форматтеры ──────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU')
}

function fileExt(path: string): string {
  const name = path.split('/').pop() || ''
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

function ExtIcon({ path, size = 22 }: { path: string; size?: number }) {
  const ext = fileExt(path)
  const color = C.textMuted
  if (ext === 'pdf') return <FileText size={size} color={color} />
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return <FileText size={size} color={color} />
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={size} color={color} />
  if (['zip', 'rar', '7z'].includes(ext)) return <FileArchive size={size} color={color} />
  if (['mp3', 'wav', 'ogg'].includes(ext)) return <FileAudio size={size} color={color} />
  if (['mp4', 'mov', 'webm'].includes(ext)) return <Film size={size} color={color} />
  return <FileIcon size={size} color={color} />
}

// ─── Тексты бейджей привязок (§8.6) ─────────────────────────────────────────

const USAGE_BADGE_META: Record<FileUsage['type'], { color: string; border: string }> = {
  course_cover: { color: C.accent, border: 'rgba(0,212,255,.3)' },
  path_cover: { color: C.accent, border: 'rgba(0,212,255,.3)' },
  lesson_content: { color: C.violet, border: 'rgba(167,139,250,.3)' },
  material: { color: C.success, border: 'rgba(52,211,153,.3)' },
}

const UGC_STATUS_LABEL: Record<string, string> = {
  pending: 'на проверке',
  approved: 'одобрена',
  rejected: 'отклонена',
}

function usageBadgeLabel(u: FileUsage): string {
  if (u.type === 'course_cover') return `Обложка: ${u.title}`
  if (u.type === 'path_cover') return `Обложка программы: ${u.title}`
  if (u.type === 'lesson_content') return `Конспект: ${u.title}`
  if (u.origin === 'user') return `UGC-заявка · ${UGC_STATUS_LABEL[u.status || ''] || u.status || ''}`.trim()
  return `Материал: ${u.course_title || u.title}`
}

function UsageBadges({
  usages,
  onOpenCourse,
}: {
  usages: FileUsage[]
  onOpenCourse: (id: string) => void
}) {
  if (usages.length === 0) {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
          color: C.textMuted, border: '1px solid #2a2a2a', background: 'none',
        }}
      >
        <i style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
        Не используется
      </span>
    )
  }
  return (
    <>
      {usages.map((u, i) => {
        const meta = USAGE_BADGE_META[u.type]
        const isUgc = u.type === 'material' && u.origin === 'user'
        const color = isUgc ? C.amber : meta.color
        const border = isUgc ? 'rgba(251,191,36,.35)' : meta.border
        // Куда ведёт клик: у урока/материала/обложки есть course_id;
        // у программы (path_cover) — нет, бейдж некликабелен.
        const target = u.course_id
        const title = u.course_deleted ? 'Курс в корзине — привязка битая' : undefined
        return (
          <button
            key={`${u.type}-${u.id}-${i}`}
            type="button"
            title={title}
            onClick={target ? () => onOpenCourse(target) : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
              border: `1px solid ${border}`, background: 'none',
              color, cursor: target ? 'pointer' : 'default',
              fontFamily: 'inherit', opacity: u.course_deleted ? 0.55 : 1,
            }}
          >
            <i style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
            {usageBadgeLabel(u)}
            {u.course_deleted ? ' (курс удалён)' : ''}
          </button>
        )
      })}
    </>
  )
}

// ─── Модалки (§8.7) ─────────────────────────────────────────────────────────

function Modal({
  onClose,
  children,
}: {
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        style={{
          width: 'min(520px,100%)', background: '#111', border: '1px solid #2a2a2a',
          borderRadius: 16, padding: 22,
          transform: 'scale(1) translateY(0)', transition: 'transform 180ms',
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

const modalTitle: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 12,
}
const modalText: React.CSSProperties = {
  fontSize: 12.5, color: C.textSecondary, lineHeight: 1.6, marginBottom: 12,
}
const warnBox: React.CSSProperties = {
  background: 'rgba(248,113,113,.07)', border: '1px solid rgba(248,113,113,.25)',
  color: '#fca5a5', borderRadius: 10, padding: '10px 13px',
  fontSize: 12, lineHeight: 1.55, marginBottom: 14,
}
const modalActions: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6,
}

function modalBtn(variant: 'ghost' | 'danger' | 'accent'): React.CSSProperties {
  return {
    fontFamily: 'inherit', fontSize: 12, fontWeight: 700, height: 34,
    padding: '0 16px', borderRadius: 999, cursor: 'pointer', transition: 'all .15s',
    border:
      variant === 'danger'
        ? '1px solid rgba(248,113,113,.5)'
        : variant === 'accent'
          ? 'none'
          : `1px solid ${C.border}`,
    background:
      variant === 'danger' ? 'rgba(248,113,113,.12)' : variant === 'accent' ? C.accent : 'transparent',
    color: variant === 'danger' ? '#F87171' : variant === 'accent' ? '#060606' : C.textSecondary,
  }
}

// ─── Карточка файла (§8.4 + §8.5) ───────────────────────────────────────────

function FileCard({
  file,
  onOpenCourse,
  onCopy,
  onDelete,
}: {
  file: EduFileEntry
  onOpenCourse: (id: string) => void
  onCopy: (path: string) => void
  onDelete: (file: EduFileEntry) => void
}) {
  const name = file.path.split('/').pop() || file.path
  const isImage = IMAGE_EXTS.has(fileExt(file.path))
  const overlayBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 7, height: 30, padding: '0 11px',
    borderRadius: 8, border: '1px solid rgba(255,255,255,.14)',
    background: 'rgba(14,14,14,.9)', color: '#9CA3AF',
    fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    whiteSpace: 'nowrap', cursor: 'pointer', width: '100%',
  }
  return (
    <div
      className="tz199-file-card"
      style={{
        background: '#101010', border: `1px solid ${C.border}`, borderRadius: 14,
        overflow: 'hidden', position: 'relative', transition: 'border-color .15s, transform .15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#333'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = C.border
        e.currentTarget.style.transform = 'none'
      }}
    >
      {/* Превью: картинки — img, прочие — иконка по расширению. */}
      <div style={{ aspectRatio: '16 / 10', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isImage ? (
          <img
            src={mediaUrl(file.path)}
            alt={name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <ExtIcon path={file.path} />
        )}
      </div>

      {/* Hover-оверлей действий — ВЕРТИКАЛЬНЫЙ список (§8.5), открывается и по focus-within. */}
      <div
        className="tz199-overlay"
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(6,6,6,.25), rgba(6,6,6,.88))',
          opacity: 0, transition: 'opacity .18s',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 10,
        }}
      >
        <style>{`
          .tz199-file-card:hover .tz199-overlay,
          .tz199-file-card:focus-within .tz199-overlay { opacity: 1; }
          .tz199-act:hover { color: #fff; border-color: rgba(255,255,255,.35); }
          .tz199-act-danger:hover { color: #F87171; border-color: rgba(248,113,113,.5); }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          <button type="button" className="tz199-act" style={overlayBtn} onClick={() => onCopy(file.path)}>
            <Copy size={12} /> Скопировать путь
          </button>
          <a
            href={mediaUrl(file.path)}
            target="_blank"
            rel="noreferrer"
            className="tz199-act"
            style={{ ...overlayBtn, textDecoration: 'none' }}
          >
            <Download size={12} /> Скачать
          </a>
          <button
            type="button"
            className="tz199-act tz199-act-danger"
            style={overlayBtn}
            onClick={() => onDelete(file)}
          >
            <Trash2 size={12} /> Удалить
          </button>
        </div>
      </div>

      <div style={{ padding: '11px 13px 12px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.path}>
          {name}
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, display: 'flex', gap: 8, fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>
          <span>{fmtSize(file.size)}</span>
          <span>{fmtDate(file.mtime)}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 }}>
          <UsageBadges usages={file.usages} onOpenCourse={onOpenCourse} />
        </div>
      </div>
    </div>
  )
}

// ─── Корзина: строки (§8.8) ─────────────────────────────────────────────────

function TrashThumb({ entry }: { entry: TrashEntry }) {
  const isImage = entry.originalRelPath ? IMAGE_EXTS.has(fileExt(entry.originalRelPath)) : false
  return (
    <div style={{ width: 52, height: 36, borderRadius: 7, overflow: 'hidden', flex: 'none', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {isImage && entry.originalRelPath ? (
        <img src={mediaUrl(entry.originalRelPath)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <ExtIcon path={entry.originalRelPath || entry.trashName} size={16} />
      )}
    </div>
  )
}

// ─── Панель ─────────────────────────────────────────────────────────────────

type ModalState =
  | { kind: 'used'; file: EduFileEntry; usages: FileUsage[] }
  | { kind: 'trash-confirm'; file: EduFileEntry }
  | { kind: 'purge-confirm'; entry: TrashEntry }

export default function FilesPanel({
  onOpenCourse,
  toast,
  toastError,
}: {
  onOpenCourse: (id: string) => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
  toastError: (msg: string) => void
}) {
  const [segment, setSegment] = useState<Segment>('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<FilesListResponse | null>(null)
  const [trash, setTrash] = useState<TrashEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [busy, setBusy] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadFiles = useCallback(
    async (seg: Segment, query: string, p: number) => {
      setLoading(true)
      setFailed(false)
      try {
        const kind = SEGMENTS.find(s => s.id === seg)?.kind
        setData(await fetchFiles({ kind, q: query, page: p }))
      } catch (err: any) {
        setFailed(true)
        toastError(err?.message || 'Не удалось загрузить файлы')
      } finally {
        setLoading(false)
      }
    },
    [toastError],
  )

  const loadTrash = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetchTrash()
      setTrash(res.items)
    } catch (err: any) {
      setFailed(true)
      toastError(err?.message || 'Не удалось загрузить корзину')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  // Ленивая загрузка при первом рендере (панель держится смонтированной).
  useEffect(() => {
    void loadFiles('all', '', 1)
    void loadTrash()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchSegment = (seg: Segment) => {
    setSegment(seg)
    setPage(1)
    if (seg === 'trash') void loadTrash()
    else void loadFiles(seg, q, 1)
  }

  const onSearch = (value: string) => {
    setQ(value)
    setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (segment !== 'trash') void loadFiles(segment, value, 1)
    }, 300)
  }

  const summary = data?.summary
  const segCount = (seg: Segment): number | null => {
    if (seg === 'trash') return trash.length
    if (!summary) return null
    if (seg === 'all') return summary.total
    return summary.by_kind?.[seg as 'courses' | 'content' | 'materials'] ?? null
  }

  const copyPath = (path: string) => {
    navigator.clipboard
      ?.writeText(path)
      .then(() => toast(`Путь скопирован: ${path}`, 'success'))
      .catch(() => toastError('Не удалось скопировать путь'))
  }

  // Удаление: заюзанный файл → модалка со списком привязок; сирота → простой confirm.
  const requestDelete = (file: EduFileEntry) => {
    if (file.usages.length > 0) setModal({ kind: 'used', file, usages: file.usages })
    else setModal({ kind: 'trash-confirm', file })
  }

  const doDelete = async (file: EduFileEntry, force: boolean) => {
    setBusy(true)
    try {
      await deleteFile(file.path, force)
      toast('Файл в корзине', 'success')
      setModal(null)
      void loadFiles(segment, q, page)
      void loadTrash()
    } catch (err: any) {
      if (err?.status === 409 && Array.isArray(err?.data?.usages)) {
        // Привязки появились/изменились с момента листинга — показываем свежий список.
        setModal({ kind: 'used', file, usages: err.data.usages })
      } else {
        toastError(err?.message || 'Не удалось удалить файл')
        setModal(null)
      }
    } finally {
      setBusy(false)
    }
  }

  const doRestore = async (entry: TrashEntry) => {
    setBusy(true)
    try {
      const res = await restoreTrashFile(entry.trashName)
      toast(`Восстановлен: ${res.path}`, 'success')
      if (res.usages_count === 0) {
        // Restore возвращает файл, НЕ запись в БД (ТЗ-199 §3): сирота.
        toast('Записи в БД не найдены — файл вернулся «сиротой»', 'info')
      }
      void loadTrash()
      if (segment !== 'trash') void loadFiles(segment, q, page)
    } catch (err: any) {
      toastError(err?.message || 'Не удалось восстановить файл')
    } finally {
      setBusy(false)
    }
  }

  const doPurge = async (entry: TrashEntry) => {
    setBusy(true)
    try {
      await purgeTrashFile(entry.trashName)
      toast('Удалено навсегда', 'success')
      setModal(null)
      void loadTrash()
    } catch (err: any) {
      toastError(err?.message || 'Не удалось удалить файл')
      setModal(null)
    } finally {
      setBusy(false)
    }
  }

  const statVal: React.CSSProperties = {
    display: 'block', fontSize: 16, color: C.textPrimary, fontVariantNumeric: 'tabular-nums',
  }
  const statLbl: React.CSSProperties = { fontSize: 12, color: C.textMuted }

  const files = useMemo(() => data?.files ?? [], [data])

  return (
    <div>
      {/* Фильтры-сегменты (§8.2); «Корзина» в активном состоянии amber, не cyan. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {SEGMENTS.map(s => {
          const on = segment === s.id
          const active = s.id === 'trash'
          const color = on ? (active ? C.amber : C.accent) : C.textMuted
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => switchSegment(s.id)}
              style={{
                padding: '7px 13px', borderRadius: 999, background: 'transparent',
                border: on
                  ? `1px solid ${active ? 'rgba(251,191,36,.35)' : 'rgba(0,212,255,.35)'}`
                  : '1px solid transparent',
                backgroundColor: on ? (active ? 'rgba(251,191,36,.08)' : 'rgba(0,212,255,.12)') : 'transparent',
                color, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {s.label}
              {segCount(s.id) !== null && (
                <span style={{ opacity: 0.65, fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
                  {segCount(s.id)}
                </span>
              )}
            </button>
          )
        })}
        <input
          value={q}
          onChange={e => onSearch(e.target.value)}
          placeholder="Поиск по имени файла…"
          aria-label="Поиск по имени файла"
          style={{
            marginLeft: 'auto', minWidth: 220, background: '#0a0a0a',
            border: `1px solid ${C.border}`, borderRadius: 999, color: C.textPrimary,
            fontSize: 12.5, padding: '7px 14px', outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Сводная строка (§8.3) — только вне корзины. */}
      {segment !== 'trash' && summary && (
        <div style={{ display: 'flex', gap: 22, padding: '12px 16px', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={statLbl}>
            <b style={statVal}>{summary.total}</b>
            файлов
          </div>
          <div style={statLbl}>
            <b style={statVal}>{fmtSize(summary.bytes)}</b>
            занято
          </div>
          <div style={statLbl}>
            <b style={{ ...statVal, color: C.amber }}>{summary.unused}</b>
            не используются
          </div>
          <div style={statLbl}>
            <b style={statVal}>{summary.trash}</b>
            в корзине
          </div>
        </div>
      )}

      {failed && !loading && (
        <div style={{ color: C.error, fontSize: 12.5, padding: '18px 0' }}>
          Не удалось загрузить данные. Попробуйте обновить страницу.
        </div>
      )}

      {/* Сетка файлов (§8.4) / корзина строками (§8.8). */}
      {segment !== 'trash' && (
        <>
          <style>{`
            @media (max-width: 640px) {
              .tz199-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
            }
          `}</style>
          <div className="tz199-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: 16 }}>
            {files.map(f => (
              <FileCard key={f.path} file={f} onOpenCourse={onOpenCourse} onCopy={copyPath} onDelete={requestDelete} />
            ))}
          </div>
          {!loading && files.length === 0 && !failed && (
            <div style={{ color: C.textMuted, fontSize: 12.5, padding: '24px 0', textAlign: 'center' }}>
              {q ? 'Ничего не найдено по этому запросу' : 'Файлов пока нет'}
            </div>
          )}
          {(data?.pages ?? 1) > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, justifyContent: 'center' }}>
              <button type="button" style={modalBtn('ghost')} disabled={page <= 1} onClick={() => { setPage(page - 1); void loadFiles(segment, q, page - 1) }}>
                ← Назад
              </button>
              <span style={{ fontSize: 12, color: C.textMuted }}>
                стр. {data?.page} из {data?.pages}
              </span>
              <button type="button" style={modalBtn('ghost')} disabled={page >= (data?.pages ?? 1)} onClick={() => { setPage(page + 1); void loadFiles(segment, q, page + 1) }}>
                Далее →
              </button>
            </div>
          )}
        </>
      )}

      {segment === 'trash' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {trash.map(t => (
            <div
              key={t.trashName}
              style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#101010', border: `1px solid ${C.border}`, borderRadius: 12, padding: '11px 16px', flexWrap: 'wrap' }}
            >
              <TrashThumb entry={t} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.originalRelPath || t.trashName}>
                  {t.originalRelPath || `${t.trashName} (исходный путь неизвестен)`}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
                  {fmtSize(t.size)} · удалён {fmtDate(t.deletedAt)}
                  {t.originalRelPath === null && ' · запись без манифеста (до ТЗ-199) — восстановление невозможно'}
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.amber, whiteSpace: 'nowrap' }}>
                {t.daysLeft !== null ? `автоочистка через ${t.daysLeft} дн.` : 'срок автоочистки неизвестен'}
              </div>
              <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                <button
                  type="button"
                  style={modalBtn('accent')}
                  disabled={busy || t.originalRelPath === null}
                  onClick={() => doRestore(t)}
                >
                  Восстановить
                </button>
                <button
                  type="button"
                  style={modalBtn('danger')}
                  disabled={busy}
                  onClick={() => setModal({ kind: 'purge-confirm', entry: t })}
                >
                  Удалить навсегда
                </button>
              </div>
            </div>
          ))}
          {!loading && trash.length === 0 && !failed && (
            <div style={{ color: C.textMuted, fontSize: 12.5, padding: '24px 0', textAlign: 'center' }}>
              Корзина пуста
            </div>
          )}
        </div>
      )}

      {/* Модалка «Файл используется» (§8.7): список привязок + «Удалить всё равно». */}
      {modal?.kind === 'used' && (
        <Modal onClose={() => setModal(null)}>
          <div style={modalTitle}>Файл используется</div>
          <div style={{ ...modalText, wordBreak: 'break-all' }}>{modal.file.path}</div>
          <div style={warnBox}>
            Файл используется в {modal.usages.length} {modal.usages.length === 1 ? 'месте' : 'местах'}. Удалить всё равно? Сломается отображение в этих местах.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
            {modal.usages.map((u, i) => {
              const meta = USAGE_BADGE_META[u.type]
              const isUgc = u.type === 'material' && u.origin === 'user'
              const color = isUgc ? C.amber : meta.color
              return (
                <div key={`${u.type}-${u.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textSecondary }}>
                  <i style={{ width: 6, height: 6, borderRadius: '50%', background: color, flex: 'none' }} />
                  {usageBadgeLabel(u)}
                </div>
              )
            })}
          </div>
          <div style={modalActions}>
            <button type="button" style={modalBtn('ghost')} onClick={() => setModal(null)}>Отмена</button>
            <button type="button" style={modalBtn('danger')} disabled={busy} onClick={() => void doDelete(modal.file, true)}>
              Удалить всё равно
            </button>
          </div>
        </Modal>
      )}

      {/* Модалка «В корзину?» для неиспользуемого файла (§8.7). */}
      {modal?.kind === 'trash-confirm' && (
        <Modal onClose={() => setModal(null)}>
          <div style={modalTitle}>В корзину?</div>
          <div style={{ ...modalText, wordBreak: 'break-all', marginBottom: 6 }}>{modal.file.path}</div>
          <div style={{ ...modalText, color: C.textMuted }}>
            Файл нигде не используется. Он попадёт в корзину и будет автоматически удалён через {TRASH_RETENTION_DAYS} дней.
          </div>
          <div style={modalActions}>
            <button type="button" style={modalBtn('ghost')} onClick={() => setModal(null)}>Отмена</button>
            <button type="button" style={modalBtn('danger')} disabled={busy} onClick={() => void doDelete(modal.file, false)}>
              В корзину
            </button>
          </div>
        </Modal>
      )}

      {/* Модалка «Удалить навсегда?» (§8.7): действие безвозвратно. */}
      {modal?.kind === 'purge-confirm' && (
        <Modal onClose={() => setModal(null)}>
          <div style={modalTitle}>Удалить навсегда?</div>
          <div style={{ ...modalText, wordBreak: 'break-all', marginBottom: 6 }}>{modal.entry.originalRelPath || modal.entry.trashName}</div>
          <div style={warnBox}>
            Действие безвозвратно: файл будет стёрт с диска, восстановить его будет нельзя.
          </div>
          <div style={modalActions}>
            <button type="button" style={modalBtn('ghost')} onClick={() => setModal(null)}>Отмена</button>
            <button type="button" style={modalBtn('danger')} disabled={busy} onClick={() => void doPurge(modal.entry)}>
              Удалить навсегда
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
