/**
 * ТЗ-193 — блок «Заметки» клиента (advisor_notes): до 5 штук, лента DESC,
 * inline-редактирование, оптимистичное удаление. Презентационный компонент —
 * сети не знает, всё через колбэки-пропсы; заметки приходят controlled.
 */
import { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { formatMskDayMonth, formatMskTime, type AdvisorNote } from './adviserTypes'

export const NOTES_LIMIT = 5
const TEXT_MAX = 2000
const DELETE_TOAST_MS = 2000

const iconBtnClass =
  'focusable w-7 h-7 rounded-[8px] flex items-center justify-center border border-transparent transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 hover:border-[#222]'

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/** «12 окт, 14:30»; без даты — без меты */
function noteMeta(note: AdvisorNote): string {
  const day = formatMskDayMonth(note.created_at)
  const time = formatMskTime(note.created_at)
  return [day, time].filter(Boolean).join(', ')
}

export function AdvisorNotesBlock({
  notes,
  archived,
  onAdd,
  onEdit,
  onDelete,
}: {
  notes: AdvisorNote[]
  archived: boolean
  onAdd: (text: string) => Promise<void>
  onEdit: (noteId: number, text: string) => Promise<void>
  onDelete: (noteId: number) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set())
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [toast, setToast] = useState(false)
  const draftRef = useRef<HTMLTextAreaElement>(null)
  const editRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    autoGrow(draftRef.current)
  }, [draft, adding])

  useEffect(() => {
    if (editId !== null) {
      autoGrow(editRef.current)
      editRef.current?.focus()
    }
  }, [editId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(false), DELETE_TOAST_MS)
    return () => clearTimeout(t)
  }, [toast])

  const limitReached = notes.length >= NOTES_LIMIT
  const visibleNotes = notes.filter(n => !hiddenIds.has(n.id))

  const errMessage = (err: any): string =>
    err?.message || 'Не удалось сохранить. Попробуйте ещё раз.'

  const submitAdd = async () => {
    if (adding || archived || limitReached) return
    setAdding(true)
    setAddError(null)
    try {
      await onAdd(draft.trim())
      setDraft('')
    } catch (err: any) {
      if (err?.status === 400 && err?.data?.error === 'invalid_note_text') {
        setAddError('Заметка не должна быть пустой.')
      } else if (err?.status === 403 && err?.data?.error === 'note_limit_reached') {
        setAddError('Лимит — 5 заметок на клиента.')
      } else {
        setAddError(errMessage(err))
      }
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (note: AdvisorNote) => {
    setEditId(note.id)
    setEditText(note.text)
    setEditError(null)
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditText('')
    setEditError(null)
  }

  const submitEdit = async () => {
    if (editId === null || editSaving) return
    setEditSaving(true)
    setEditError(null)
    try {
      await onEdit(editId, editText.trim())
      cancelEdit()
    } catch (err: any) {
      if (err?.status === 400 && err?.data?.error === 'invalid_note_text') {
        // Ввод не теряем — подсказка под полем, можно поправить и сохранить снова
        setEditError('Заметка не должна быть пустой.')
      } else {
        setEditError(errMessage(err))
      }
    } finally {
      setEditSaving(false)
    }
  }

  const remove = async (note: AdvisorNote) => {
    if (hiddenIds.has(note.id)) return
    // Сразу, без confirm: оптимистично убираем из ленты, при ошибке — откат
    setHiddenIds(prev => new Set(prev).add(note.id))
    setDeleteError(null)
    try {
      await onDelete(note.id)
      setToast(true)
    } catch (err: any) {
      setHiddenIds(prev => {
        const next = new Set(prev)
        next.delete(note.id)
        return next
      })
      setDeleteError(errMessage(err))
    }
  }

  return (
    <section
      className={`p-5 mb-6 ${archived ? 'opacity-60' : ''}`}
      id="notes"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #222222', borderRadius: 16 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-[15px] font-semibold" style={{ color: '#D1D5DB' }}>Заметки</h2>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            backgroundColor: limitReached ? 'rgba(251,191,36,0.1)' : 'rgba(0,212,255,0.08)',
            border: `1px solid ${limitReached ? 'rgba(251,191,36,0.3)' : 'rgba(0,212,255,0.25)'}`,
            color: limitReached ? '#FBBF24' : '#00D4FF',
          }}
        >
          {notes.length} из {NOTES_LIMIT}
        </span>
      </div>

      {!archived && (
        <div className="mb-4">
          <textarea
            ref={draftRef}
            value={draft}
            onChange={e => setDraft(e.target.value.slice(0, TEXT_MAX))}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitAdd() } }}
            placeholder="Внутренняя пометка: риск-профиль, договорённости, повод для звонка…"
            rows={2}
            maxLength={TEXT_MAX}
            disabled={adding || limitReached}
            className="focusable w-full rounded-[10px] px-3 py-2.5 text-sm text-white bg-[#161616] border border-[#222] outline-none focus:border-[rgba(0,212,255,0.5)] transition-colors resize-none overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between mt-1.5">
            {limitReached ? (
              <p className="text-[11px]" style={{ color: '#FBBF24' }}>Лимит — 5 заметок на клиента</p>
            ) : (
              <span className="text-[10px]" style={{ color: draft.length >= TEXT_MAX ? '#FBBF24' : '#6B7280' }}>
                {draft.length}/{TEXT_MAX}
              </span>
            )}
            <button
              onClick={submitAdd}
              disabled={adding || limitReached || !draft.trim()}
              className="focusable px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'rgba(0,212,255,0.12)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.25)' }}
            >
              {adding ? 'Добавляем…' : 'Добавить'}
            </button>
          </div>
          {addError && <p className="text-[11px] mt-1.5" style={{ color: '#EF4444' }}>{addError}</p>}
        </div>
      )}

      {visibleNotes.length === 0 ? (
        <p className="text-[12px]" style={{ color: '#6B7280' }}>
          {archived ? 'Заметок нет.' : 'Заметок пока нет — добавьте первую выше.'}
        </p>
      ) : (
        <div>
          {visibleNotes.map((note, idx) => (
            <div
              key={note.id}
              className="py-3"
              style={idx < visibleNotes.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.05)' } : undefined}
            >
              {editId === note.id ? (
                <div>
                  <textarea
                    ref={editRef}
                    value={editText}
                    onChange={e => setEditText(e.target.value.slice(0, TEXT_MAX))}
                    onKeyDown={e => {
                      if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitEdit() }
                    }}
                    rows={2}
                    maxLength={TEXT_MAX}
                    disabled={editSaving}
                    className="focusable w-full rounded-[10px] px-3 py-2.5 text-sm text-white bg-[#161616] border border-[#222] outline-none focus:border-[rgba(0,212,255,0.5)] transition-colors resize-none overflow-hidden disabled:opacity-50"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={submitEdit}
                      disabled={editSaving || !editText.trim()}
                      className="focusable px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                    >
                      {editSaving ? 'Сохраняем…' : 'Сохранить'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={editSaving}
                      className="focusable px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-40"
                      style={{ background: 'transparent', border: '1px solid #222', color: '#9CA3AF' }}
                    >
                      Отмена
                    </button>
                    <span className="text-[10px] ml-auto" style={{ color: '#6B7280' }}>
                      {editText.length}/{TEXT_MAX}
                    </span>
                  </div>
                  {editError && <p className="text-[11px] mt-1.5" style={{ color: '#EF4444' }}>{editError}</p>}
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: '#D1D5DB' }}>
                      {note.text}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: '#6B7280' }}>
                      {noteMeta(note)}
                      {note.updated_at && note.updated_at !== note.created_at && (
                        <> · изменено {formatMskDayMonth(note.updated_at)}{formatMskTime(note.updated_at) ? `, ${formatMskTime(note.updated_at)}` : ''}</>
                      )}
                    </p>
                  </div>
                  {!archived && (
                    <span className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(note)}
                        title="Редактировать заметку"
                        aria-label="Редактировать заметку"
                        className={iconBtnClass}
                        style={{ color: '#6B7280' }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => remove(note)}
                        title="Удалить заметку"
                        aria-label="Удалить заметку"
                        className={iconBtnClass}
                        style={{ color: '#6B7280' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteError && <p className="text-[11px] mt-2" style={{ color: '#EF4444' }}>{deleteError}</p>}
      {toast && (
        <p className="text-[11px] mt-2" style={{ color: '#34D399' }}>Заметка удалена</p>
      )}
    </section>
  )
}
