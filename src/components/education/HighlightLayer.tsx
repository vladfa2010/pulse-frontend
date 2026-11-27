/**
 * =============================================================================
 * PULSE — Выделения и заметки в уроках: слой поверх контента (ТЗ-237, этап 1)
 * =============================================================================
 *
 * Painting: один проход TreeWalker с картой текстовых нод (исключая
 * .chart-block — хосты React-порталов, table, существующие mark.edu-hl);
 * якорь — W3C TextQuoteSelector (exact + prefix/suffix + pos_hint), каскад:
 * полное совпадение контекста → ближайший к pos_hint → orphan (молча пропуск,
 * автоудаление запрещено §1 ТЗ).
 *
 * Тулбар: selectionchange (debounce 150 мс), pointerdown+preventDefault на
 * кнопках (иначе тап схлопывает selection до click — ловушка iOS, техлид),
 * позиция по getClientRects (последний rect — под выделением; системный
 * коллаут iOS сверху не перекрываем), z-index 320 (читалка — 200).
 *
 * Роли (§0): A (can_highlight) — «Выделить»/«Заметка»; B (залогинен без
 * записи) — те же → апселл §2.4; C (гость) — «Войдите…» → логин-модалка.
 * «Поделиться» — этап 2 (в этапе 1 скрыто, план после тимлид-ревью).
 *
 * Вёрстка 1:1 — §2.1-2.5 (классы в index.css).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { Highlighter, StickyNote, Copy, Trash2, LogIn } from 'lucide-react'
import {
  createHighlight,
  updateHighlightNote,
  deleteHighlight,
  type Highlight,
} from '@/lib/educationApi'
import { logAnalyticsEvent } from '@/lib/analytics'

// ─── Painting ────────────────────────────────────────────────────────────────

interface TextMap {
  full: string
  nodes: { node: Text; start: number }[]
}

function collectText(root: HTMLElement): TextMap {
  const nodes: { node: Text; start: number }[] = []
  let full = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement
      if (!p) return NodeFilter.FILTER_REJECT
      // chart-блоки — хосты React-порталов (убьём портал), таблицы — ломает вёрстку,
      // уже нарисованные mark — идемпотентность повторного прохода
      if (p.closest('.chart-block, table, mark.edu-hl, .hl-ignore')) return NodeFilter.FILTER_REJECT
      return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })
  let n: Node | null
  while ((n = walker.nextNode())) {
    nodes.push({ node: n as Text, start: full.length })
    full += (n as Text).nodeValue
  }
  return { full, nodes }
}

/** Выбрать вхождение exact: полное совпадение prefix+suffix → ближайший к pos_hint. */
function resolveOccurrence(full: string, h: Highlight): number {
  const idxs: number[] = []
  let i = full.indexOf(h.exact_text)
  while (i !== -1) { idxs.push(i); i = full.indexOf(h.exact_text, i + 1) }
  if (idxs.length === 0) return -1
  if (idxs.length === 1) return idxs[0]
  const ctx = idxs.filter(idx => {
    const pre = h.prefix ? full.slice(Math.max(0, idx - h.prefix.length), idx) === h.prefix : true
    const suf = h.suffix ? full.slice(idx + h.exact_text.length, idx + h.exact_text.length + h.suffix.length) === h.suffix : true
    return pre && suf
  })
  if (ctx.length === 1) return ctx[0]
  const pool = ctx.length > 0 ? ctx : idxs
  const hint = h.pos_hint ?? 0
  return pool.reduce((best, idx) => {
    const bestN = full.slice(0, best).split(h.exact_text).length - 1
    const idxN = full.slice(0, idx).split(h.exact_text).length - 1
    return Math.abs(idxN - hint) < Math.abs(bestN - hint) ? idx : best
  }, pool[0])
}

/** Обёртка диапазона [start, start+len) объединённого текста в <mark> (через границы нод). */
function wrapRange(map: TextMap, start: number, len: number, hlId: string): HTMLElement[] {
  const end = start + len
  const marks: HTMLElement[] = []
  for (const { node, start: ns } of map.nodes) {
    const ne = ns + (node.nodeValue?.length ?? 0)
    if (ne <= start || ns >= end) continue
    const from = Math.max(0, start - ns)
    const to = Math.min(node.nodeValue!.length, end - ns)
    // разрезаем ноду и оборачиваем [from, to)
    const target = node.splitText(from)
    target.splitText(to - from)
    const mark = document.createElement('mark')
    mark.className = 'edu-hl'
    mark.dataset.hlId = hlId
    target.parentNode?.replaceChild(mark, target)
    mark.appendChild(target)
    marks.push(mark)
  }
  return marks
}

function unpaint(root: HTMLElement) {
  root.querySelectorAll('mark.edu-hl').forEach(m => {
    const parent = m.parentNode
    if (!parent) return
    while (m.firstChild) parent.insertBefore(m.firstChild, m)
    parent.removeChild(m)
    parent.normalize()
  })
}

export function paintHighlights(root: HTMLElement, highlights: Highlight[]): void {
  unpaint(root)
  if (highlights.length === 0) return
  const map = collectText(root)
  for (const h of highlights) {
    const idx = resolveOccurrence(map.full, h)
    if (idx === -1) continue // orphan — молча (§1 ТЗ)
    wrapRange(map, idx, h.exact_text.length, h.id)
  }
}

// ─── Компонент ───────────────────────────────────────────────────────────────

export type HlVariant = 'A' | 'B' | 'C'

interface ToolbarState {
  x: number
  y: number
  exact: string
  prefix: string
  suffix: string
  posHint: number
}

interface PopoverState {
  x: number
  y: number
  highlight: Highlight
}

interface NoteEditorState {
  x: number
  y: number
  /** Существующий хайлайт (редактирование) или null (создание из выделения). */
  highlight: Highlight | null
  selection?: Omit<ToolbarState, 'x' | 'y'>
  note: string
}

interface Props {
  container: HTMLElement | null
  lessonId: string
  courseSlug: string
  canHighlight: boolean
  isLoggedIn: boolean
  highlights: Highlight[]
  onCreated: (h: Highlight) => void
  onUpdated: (h: Highlight) => void
  onDeleted: (id: string) => void
  /** Тост «Скопировано»/«Сохранено» — паттерн хоста. */
  onToast: (msg: string) => void
  /** Первое сохранение за сессию фичи — для тоста «Сохранено в Заметки». */
  onFirstSaved?: () => void
  /** Гостевой CTA «Войдите…» — логин-модалка хоста (return на урок автоматический). */
  onLogin: () => void
}

export default function HighlightLayer({
  container, lessonId, courseSlug, canHighlight, isLoggedIn,
  highlights, onCreated, onUpdated, onDeleted, onToast, onFirstSaved, onLogin,
}: Props) {
  const navigate = useNavigate()
  const variant: HlVariant = !isLoggedIn ? 'C' : canHighlight ? 'A' : 'B'
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null)
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const [noteEditor, setNoteEditor] = useState<NoteEditorState | null>(null)
  const [upsell, setUpsell] = useState(false)
  const busyRef = useRef(false)
  const toolbarShownRef = useRef(false)

  // ─── Painting: по контенту и списку хайлайтов ───
  useEffect(() => {
    if (!container) return
    paintHighlights(container, highlights)
    return () => { if (container.isConnected) unpaint(container) }
  }, [container, highlights, lessonId])

  // ─── Selection → тулбар (debounce 150 мс) ───
  useEffect(() => {
    if (!container) return
    let t: number | undefined
    const onChange = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed || !container.contains(sel.anchorNode)) {
          setToolbar(null)
          toolbarShownRef.current = false
          return
        }
        const text = sel.toString().trim()
        if (!text || text.length > 2000) { setToolbar(null); return }
        const range = sel.getRangeAt(0)
        // prefix/suffix/pos_hint — по тексту контейнера (W3C TextQuoteSelector)
        const pre = document.createRange()
        pre.selectNodeContents(container)
        pre.setEnd(range.startContainer, range.startOffset)
        const before = pre.toString()
        const post = document.createRange()
        post.selectNodeContents(container)
        post.setStart(range.endContainer, range.endOffset)
        const after = post.toString()
        const exact = text
        const posHint = before.split(exact).length - 1
        // позиция: под последним rect выделения; нет места — над первым (§2.2)
        const rects = range.getClientRects()
        const last = rects[rects.length - 1] || range.getBoundingClientRect()
        const first = rects[0] || last
        const TH = 46
        const below = last.bottom + 8
        const y = below + TH + 8 <= window.innerHeight ? below : Math.max(8, first.top - TH - 8)
        const x = Math.min(Math.max(8, last.left), window.innerWidth - 8 - 260)
        setToolbar({ x, y, exact, prefix: before.slice(-64), suffix: after.slice(0, 64), posHint })
        if (!toolbarShownRef.current) {
          toolbarShownRef.current = true
          logAnalyticsEvent('hl_toolbar_shown', { variant })
        }
      }, 150)
    }
    document.addEventListener('selectionchange', onChange)
    return () => { document.removeEventListener('selectionchange', onChange); window.clearTimeout(t) }
  }, [container, variant])

  // ─── Тап по <mark> → поповер (залогинен) ───
  useEffect(() => {
    if (!container) return
    const onClick = (e: MouseEvent) => {
      const mark = (e.target as HTMLElement).closest?.('mark.edu-hl') as HTMLElement | null
      if (!mark) { setPopover(null); return }
      if (!isLoggedIn) return // гостю поповер не показывается (5.1 п.6)
      const h = highlights.find(x => x.id === mark.dataset.hlId)
      if (!h) return
      const r = mark.getBoundingClientRect()
      setToolbar(null)
      setPopover({
        x: Math.min(Math.max(8, r.left), window.innerWidth - 8 - 220),
        y: Math.min(r.bottom + 6, window.innerHeight - 200),
        highlight: h,
      })
    }
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [container, highlights, isLoggedIn])

  // Закрытие поповера/тулбара по скроллу/ресайзу
  useEffect(() => {
    const close = () => { setPopover(null) }
    window.addEventListener('scroll', close, { passive: true })
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('scroll', close); window.removeEventListener('resize', close) }
  }, [])

  // ─── Действия ───

  const requireEnrolled = useCallback((): boolean => {
    if (variant === 'B') { setUpsell(true); return false }
    return true
  }, [variant])

  const doCreate = useCallback(async (note: string | null, sel: Omit<ToolbarState, 'x' | 'y'>) => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      const h = await createHighlight({
        lesson_id: lessonId,
        exact_text: sel.exact,
        prefix: sel.prefix || null,
        suffix: sel.suffix || null,
        pos_hint: sel.posHint,
        note,
      })
      onCreated(h)
      window.getSelection()?.removeAllRanges()
      setToolbar(null)
      setNoteEditor(null)
      logAnalyticsEvent('hl_created', { variant })
      if (note) logAnalyticsEvent('hl_note_saved', { variant })
      if (!note) onToast('Выделение сохранено')
      onFirstSaved?.()
    } catch (err: any) {
      // fallback §0.2: DTO устарел — сервер сказал not_enrolled → апселл
      if (err?.status === 403 && err?.data?.error === 'not_enrolled') setUpsell(true)
      else onToast('Не удалось сохранить выделение')
    } finally {
      busyRef.current = false
    }
  }, [lessonId, onCreated, onToast, onFirstSaved, variant])

  const handleHighlightClick = useCallback(() => {
    logAnalyticsEvent('hl_create_click', { variant })
    if (!toolbar) return
    if (variant === 'C') return // у C своя кнопка
    if (!requireEnrolled()) return
    void doCreate(null, toolbar)
  }, [toolbar, variant, requireEnrolled, doCreate])

  const handleNoteClick = useCallback(() => {
    logAnalyticsEvent('hl_create_click', { variant })
    if (!toolbar) return
    if (!requireEnrolled()) return
    const { x, y, ...sel } = toolbar
    setToolbar(null)
    setNoteEditor({ x, y, highlight: null, selection: sel, note: '' })
  }, [toolbar, variant, requireEnrolled])

  const handleGuestLogin = useCallback(() => {
    logAnalyticsEvent('hl_login_click', {})
    setToolbar(null)
    onLogin()
  }, [onLogin])

  const handleCopyQuote = useCallback((h: Highlight) => {
    navigator.clipboard?.writeText(h.exact_text).then(
      () => onToast('Цитата скопирована'),
      () => onToast('Не удалось скопировать'),
    )
    setPopover(null)
  }, [onToast])

  const handleEditNote = useCallback((h: Highlight) => {
    const mark = container?.querySelector(`mark[data-hl-id="${h.id}"]`)
    const r = mark?.getBoundingClientRect()
    setPopover(null)
    setNoteEditor({
      x: r ? Math.min(Math.max(8, r.left), window.innerWidth - 340) : 12,
      y: r ? Math.min(r.bottom + 6, window.innerHeight - 220) : 80,
      highlight: h,
      note: h.note ?? '',
    })
  }, [container])

  const handleSaveNote = useCallback(async () => {
    if (!noteEditor) return
    const note = noteEditor.note.trim() || null
    if (noteEditor.highlight) {
      try {
        const updated = await updateHighlightNote(noteEditor.highlight.id, note)
        onUpdated(updated)
        logAnalyticsEvent('hl_note_saved', { variant })
        onToast(note ? 'Заметка сохранена' : 'Заметка удалена')
      } catch {
        onToast('Не удалось сохранить заметку')
      }
      setNoteEditor(null)
    } else if (noteEditor.selection) {
      void doCreate(note, noteEditor.selection)
    }
  }, [noteEditor, onUpdated, onToast, doCreate, variant])

  const handleDelete = useCallback(async (h: Highlight) => {
    try {
      await deleteHighlight(h.id)
      onDeleted(h.id)
      onToast('Выделение удалено')
    } catch {
      onToast('Не удалось удалить')
    }
    setPopover(null)
  }, [onDeleted, onToast])

  // ─── Рендер (порталы в body, z-index 320/400 — над читалкой 200) ───

  return (
    <>
      {toolbar && createPortal(
        <div
          className="hl-toolbar"
          style={{ position: 'fixed', left: toolbar.x, top: toolbar.y, zIndex: 320 }}
          // pointerdown+preventDefault: тап не схлопывает selection до click (iOS)
          onPointerDown={(e) => e.preventDefault()}
        >
          {variant === 'C' ? (
            <button type="button" className="primary" onClick={handleGuestLogin}>
              <LogIn size={13} /> Войдите, чтобы сохранять выделения
            </button>
          ) : (
            <>
              <button type="button" className="primary" onClick={handleHighlightClick}>
                <Highlighter size={13} /> Выделить
              </button>
              <button type="button" onClick={handleNoteClick}>
                <StickyNote size={13} /> Заметка
              </button>
            </>
          )}
        </div>,
        document.body,
      )}

      {popover && createPortal(
        <div className="hl-popover" style={{ position: 'fixed', left: popover.x, top: popover.y, zIndex: 320 }}>
          <button type="button" onClick={() => handleCopyQuote(popover.highlight)}>
            <Copy size={14} /> Копировать цитату
          </button>
          {canHighlight && (
            <button type="button" onClick={() => handleEditNote(popover.highlight)}>
              <StickyNote size={14} /> {popover.highlight.note ? 'Изменить заметку' : 'Заметка'}
            </button>
          )}
          {canHighlight && (
            <>
              <div className="sep" />
              <button type="button" className="danger" onClick={() => handleDelete(popover.highlight)}>
                <Trash2 size={14} /> Удалить
              </button>
            </>
          )}
        </div>,
        document.body,
      )}

      {noteEditor && createPortal(
        <div className="hl-note-editor" style={{ position: 'fixed', left: noteEditor.x, top: noteEditor.y, zIndex: 320 }}>
          <textarea
            autoFocus
            placeholder="Заметка к выделению…"
            value={noteEditor.note}
            onChange={(e) => setNoteEditor({ ...noteEditor, note: e.target.value })}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void handleSaveNote()
              if (e.key === 'Escape') setNoteEditor(null)
            }}
          />
          <div className="row">
            <button type="button" className="hl-popover-btn ghost" style={{ background: 'none', border: '1px solid #222222', borderRadius: 8, color: '#9CA3AF', font: '600 12.5px Inter', padding: '7px 12px', cursor: 'pointer' }} onClick={() => setNoteEditor(null)}>
              Отмена
            </button>
            <button type="button" style={{ background: '#00D4FF', border: 'none', borderRadius: 8, color: '#060606', font: '600 12.5px Inter', padding: '7px 12px', cursor: 'pointer' }} onClick={() => void handleSaveNote()}>
              Сохранить
            </button>
          </div>
        </div>,
        document.body,
      )}

      {upsell && createPortal(
        <>
          <div className="hl-upsell-dim" onClick={() => setUpsell(false)} />
          <div className="hl-upsell">
            <h3>Запишитесь на курс</h3>
            <p>Запишитесь на курс, чтобы сохранять выделения и заметки — они будут ждать вас в любом уроке.</p>
            <div className="row">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  logAnalyticsEvent('hl_upsell_click', {})
                  navigate(`/education/${courseSlug}`)
                }}
              >
                Перейти к курсу
              </button>
              <button type="button" className="ghost" onClick={() => setUpsell(false)}>Отмена</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
