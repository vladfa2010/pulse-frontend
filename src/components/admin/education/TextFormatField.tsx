// ТЗ-108: переиспользуемое поле форматированного текста для LMS-админки.
// Тулбара поверх обычного <textarea> (храним текст/HTML, а не DOM — contenteditable не нужен).
//
// Решение по рендеру (проверено перед реализацией, зафиксировано в ТЗ-108):
// студенческая страница урока (LessonPage) рендерит text_content через
// dangerouslySetInnerHTML → тулбара вставляет HTML, а не markdown.
// Предпросмотр рендерит тот же HTML той же разметкой (.edu-content), что и
// страница урока / карточка курса — «видел в форме = увидит ученик».
//
// Toggle снятия обёртки: сделан минимальный — если выделение уже ровно
// обёрнуто в тег (<strong>…</strong> и т.п.), повторный клик снимает обёртку.
//
// Мокап text-toolbar.html (дизайн-референс v2) в пакетах не найден — вёрстка
// по текстовому описанию ТЗ: кнопки 28×28, сепараторы, pill-тумблер
// «Предпросмотр», попап ссылки .tff-link-pop, предпросмотр .tff-preview.

import { useLayoutEffect, useRef, useState } from 'react'
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  TextQuote,
  Underline,
} from 'lucide-react'
import { C, inputBlur, inputCls, inputFocus } from './ui'

type InlineOp = 'bold' | 'italic' | 'underline' | 'code'

const INLINE_TAG: Record<InlineOp, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  code: 'code',
}

const HOTKEY_OP: Record<string, InlineOp> = {
  b: 'bold',
  i: 'italic',
  u: 'underline',
}

export default function TextFormatField({
  value,
  onChange,
  rows = 6,
  minHeight = 110,
  placeholder,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  minHeight?: number
  placeholder?: string
  autoFocus?: boolean
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)
  // Сохранённое выделение на момент открытия попапа ссылки (клик по кнопке
  // не съедает выделение благодаря mousedown preventDefault, но на всякий случай фиксируем)
  const savedSel = useRef<{ start: number; end: number } | null>(null)
  // Позиция курсора/выделения, которую надо восстановить после перерендера
  const pendingSel = useRef<{ start: number; end: number } | null>(null)

  const [previewOn, setPreviewOn] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState(false)

  // Восстанавливаем фокус и выделение после обновления value в родителе
  useLayoutEffect(() => {
    if (!pendingSel.current) return
    const ta = taRef.current
    if (!ta) return
    const { start, end } = pendingSel.current
    pendingSel.current = null
    ta.focus()
    ta.setSelectionRange(start, end)
    ta.scrollTop = ta.scrollHeight
  }, [value])

  /** Применить замену диапазона [s,e) на insert; курсор — на конец вставки (или cursorAt для пустой вставки). */
  const applyRange = (s: number, e: number, insert: string, cursorAt?: number) => {
    const next = value.slice(0, s) + insert + value.slice(e)
    const pos = cursorAt !== undefined ? s + cursorAt : s + insert.length
    pendingSel.current = { start: pos, end: pos }
    onChange(next)
  }

  const applyInline = (op: InlineOp) => {
    const ta = taRef.current
    if (!ta) return
    const s = ta.selectionStart
    const e = ta.selectionEnd
    const tag = INLINE_TAG[op]
    const sel = value.slice(s, e)

    if (sel === '') {
      // Пустое выделение → вставить пару тегов, курсор между ними
      const pair = `<${tag}></${tag}>`
      applyRange(s, e, pair, `<${tag}>`.length)
      return
    }
    // Toggle: выделение уже ровно обёрнуто → снять обёртку
    const open = `<${tag}>`
    const close = `</${tag}>`
    if (value.slice(s - open.length, s) === open && value.slice(e, e + close.length) === close) {
      const next = value.slice(0, s - open.length) + sel + value.slice(e + close.length)
      pendingSel.current = { start: s - open.length, end: e - open.length }
      onChange(next)
      return
    }
    applyRange(s, e, `${open}${sel}${close}`, `<${tag}>${sel}`.length)
  }

  /** Блочные операции (H2/H3/цитата): каждая выделенная строка оборачивается в тег. */
  const applyBlock = (tag: 'h2' | 'h3' | 'blockquote') => {
    const ta = taRef.current
    if (!ta) return
    const s = ta.selectionStart
    const e = ta.selectionEnd
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    let lineEnd = value.indexOf('\n', e)
    if (lineEnd === -1) lineEnd = value.length
    const lines = value.slice(lineStart, lineEnd).split('\n')
    const wrapped = lines.map(l => (l.trim() === '' ? l : `<${tag}>${l}</${tag}>`)).join('\n')
    applyRange(lineStart, lineEnd, wrapped, wrapped.length)
  }

  /** Списки: выделенные строки → <li>, всё оборачивается в <ul>/<ol>. */
  const applyList = (tag: 'ul' | 'ol') => {
    const ta = taRef.current
    if (!ta) return
    const s = ta.selectionStart
    const e = ta.selectionEnd
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    let lineEnd = value.indexOf('\n', e)
    if (lineEnd === -1) lineEnd = value.length
    const raw = value.slice(lineStart, lineEnd)
    if (raw.trim() === '') {
      // Пустая строка → вставить каркас списка
      const skel = `<${tag}>\n<li></li>\n</${tag}>`
      applyRange(lineStart, lineEnd, skel, `<${tag}>\n<li>`.length)
      return
    }
    const items = raw
      .split('\n')
      .filter(l => l.trim() !== '')
      .map(l => `<li>${l}</li>`)
      .join('\n')
    applyRange(lineStart, lineEnd, `<${tag}>\n${items}\n</${tag}>`, `<${tag}>\n${items}\n</${tag}>`.length)
  }

  const openLinkPopup = () => {
    const ta = taRef.current
    if (!ta) return
    savedSel.current = { start: ta.selectionStart, end: ta.selectionEnd }
    setUrl('')
    setUrlError(false)
    setLinkOpen(true)
  }

  const insertLink = () => {
    const trimUrl = url.trim()
    if (!/^https:\/\/.+/i.test(trimUrl)) {
      setUrlError(true)
      return
    }
    const sel = savedSel.current ?? { start: value.length, end: value.length }
    const text = value.slice(sel.start, sel.end) || trimUrl
    applyRange(sel.start, sel.end, `<a href="${trimUrl}">${text}</a>`)
    setLinkOpen(false)
    setUrl('')
    setUrlError(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return
    const op = HOTKEY_OP[e.key.toLowerCase()]
    if (op) {
      e.preventDefault()
      applyInline(op)
    }
  }

  /** mousedown preventDefault — клик по кнопке не забирает фокус/выделение из textarea. */
  const holdSelection = (e: React.MouseEvent) => e.preventDefault()

  const toolBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: '.375rem',
    border: 'none',
    background: 'transparent',
    color: C.textSecondary,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    transition: 'all .15s',
    flex: 'none',
    padding: 0,
  }
  const toolHover = (on: boolean) => ({
    background: on ? C.bgHover : 'transparent',
    color: C.accent,
  })

  const Sep = () => (
    <span style={{ width: 1, height: 18, background: C.border, flex: 'none', margin: '0 4px' }} />
  )

  return (
    <div style={{ position: 'relative' }}>
      {/* ─── Тулбара ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '6px 8px',
          background: C.bgSurface,
          border: `1px solid ${C.border}`,
          borderBottom: 'none',
          borderRadius: '8px 8px 0 0',
        }}
      >
        <button type="button" title="Заголовок H2" style={toolBtn} onMouseDown={holdSelection}
          onMouseEnter={e => Object.assign(e.currentTarget.style, toolHover(true))}
          onMouseLeave={e => Object.assign(e.currentTarget.style, toolHover(false))}
          onClick={() => applyBlock('h2')}>
          <Heading2 size={15} />
        </button>
        <button type="button" title="Заголовок H3" style={toolBtn} onMouseDown={holdSelection}
          onMouseEnter={e => Object.assign(e.currentTarget.style, toolHover(true))}
          onMouseLeave={e => Object.assign(e.currentTarget.style, toolHover(false))}
          onClick={() => applyBlock('h3')}>
          <Heading3 size={15} />
        </button>
        <Sep />
        <button type="button" title="Жирный (Ctrl+B)" style={toolBtn} onMouseDown={holdSelection}
          onMouseEnter={e => Object.assign(e.currentTarget.style, toolHover(true))}
          onMouseLeave={e => Object.assign(e.currentTarget.style, toolHover(false))}
          onClick={() => applyInline('bold')}>
          <Bold size={15} />
        </button>
        <button type="button" title="Курсив (Ctrl+I)" style={toolBtn} onMouseDown={holdSelection}
          onMouseEnter={e => Object.assign(e.currentTarget.style, toolHover(true))}
          onMouseLeave={e => Object.assign(e.currentTarget.style, toolHover(false))}
          onClick={() => applyInline('italic')}>
          <Italic size={15} />
        </button>
        <button type="button" title="Подчёркивание (Ctrl+U)" style={toolBtn} onMouseDown={holdSelection}
          onMouseEnter={e => Object.assign(e.currentTarget.style, toolHover(true))}
          onMouseLeave={e => Object.assign(e.currentTarget.style, toolHover(false))}
          onClick={() => applyInline('underline')}>
          <Underline size={15} />
        </button>
        <button type="button" title="Код" style={toolBtn} onMouseDown={holdSelection}
          onMouseEnter={e => Object.assign(e.currentTarget.style, toolHover(true))}
          onMouseLeave={e => Object.assign(e.currentTarget.style, toolHover(false))}
          onClick={() => applyInline('code')}>
          <Code size={15} />
        </button>
        <Sep />
        <button type="button" title="Маркированный список" style={toolBtn} onMouseDown={holdSelection}
          onMouseEnter={e => Object.assign(e.currentTarget.style, toolHover(true))}
          onMouseLeave={e => Object.assign(e.currentTarget.style, toolHover(false))}
          onClick={() => applyList('ul')}>
          <List size={15} />
        </button>
        <button type="button" title="Нумерованный список" style={toolBtn} onMouseDown={holdSelection}
          onMouseEnter={e => Object.assign(e.currentTarget.style, toolHover(true))}
          onMouseLeave={e => Object.assign(e.currentTarget.style, toolHover(false))}
          onClick={() => applyList('ol')}>
          <ListOrdered size={15} />
        </button>
        <button type="button" title="Цитата" style={toolBtn} onMouseDown={holdSelection}
          onMouseEnter={e => Object.assign(e.currentTarget.style, toolHover(true))}
          onMouseLeave={e => Object.assign(e.currentTarget.style, toolHover(false))}
          onClick={() => applyBlock('blockquote')}>
          <TextQuote size={15} />
        </button>
        <Sep />
        <button type="button" title="Ссылка" style={{ ...toolBtn, color: linkOpen ? C.accent : C.textSecondary }}
          onMouseDown={holdSelection}
          onMouseEnter={e => Object.assign(e.currentTarget.style, toolHover(true))}
          onMouseLeave={e => Object.assign(e.currentTarget.style, toolHover(false))}
          onClick={() => (linkOpen ? setLinkOpen(false) : openLinkPopup())}>
          <Link2 size={15} />
        </button>

        {/* Тумблер «Предпросмотр» — справа (мокап: pill, активное состояние cyan) */}
        <button
          type="button"
          onClick={() => setPreviewOn(p => !p)}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 24,
            padding: '0 10px',
            borderRadius: 999,
            border: previewOn ? '1px solid rgba(0,212,255,.5)' : `1px solid ${C.border}`,
            background: previewOn ? 'rgba(0,212,255,.08)' : 'transparent',
            color: previewOn ? C.accent : C.textMuted,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.05em',
            cursor: 'pointer',
            transition: 'all .2s',
            flex: 'none',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          Предпросмотр
        </button>
      </div>

      {/* ─── Поле / предпросмотр ─── */}
      {previewOn ? (
        value.trim() === '' ? (
          <div
            style={{
              background: C.bgHover,
              border: `1px solid ${C.border}`,
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              minHeight,
              padding: '10px 14px',
            }}
          >
            <span style={{ color: C.textMuted, fontSize: 13 }}>Пусто — начните писать в поле слева…</span>
          </div>
        ) : (
          <div
            className="edu-content"
            style={{
              background: C.bgHover,
              border: `1px solid ${C.border}`,
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              minHeight,
              padding: '10px 14px',
              whiteSpace: 'pre-wrap',
            }}
            // Предпросмотр: тот же способ рендера, что у студенческой страницы
            // урока (dangerouslySetInnerHTML). Контент только что написан админом;
            // на проде HTML дополнительно санитизируется на бэке при сохранении.
            dangerouslySetInnerHTML={{ __html: value }}
          />
        )
      ) : (
        <textarea
          ref={taRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={rows}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={inputCls}
          style={{
            background: C.bgHover,
            border: `1px solid ${C.border}`,
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            minHeight,
            resize: 'vertical',
          }}
          onFocus={inputFocus}
          onBlur={inputBlur}
        />
      )}

      {/* ─── Попап ссылки (.tff-link-pop): inline, не window.prompt ─── */}
      {linkOpen && (
        <div
          style={{
            position: 'absolute',
            top: 44,
            left: 8,
            zIndex: 20,
            width: 320,
            background: C.bgSurface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 12,
            boxShadow: '0 12px 32px rgba(0,0,0,.5)',
          }}
        >
          <input
            ref={el => {
              urlRef.current = el
              el?.focus()
            }}
            type="url"
            value={url}
            onChange={e => {
              setUrl(e.target.value)
              setUrlError(false)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                insertLink()
              }
              if (e.key === 'Escape') setLinkOpen(false)
            }}
            placeholder="https://…"
            className={inputCls}
            style={{ ...inputStyleInner, borderColor: urlError ? C.error : C.border }}
          />
          {urlError && (
            <p style={{ fontSize: 11, color: C.error, marginTop: 6, lineHeight: 1.5 }}>
              Только https-ссылки — серверная санитизация вырежет остальное
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={insertLink}
              style={{
                height: 28,
                padding: '0 14px',
                borderRadius: 999,
                border: 'none',
                background: C.accent,
                color: '#060606',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '.05em',
                cursor: 'pointer',
              }}
            >
              Вставить
            </button>
            <button
              type="button"
              onClick={() => setLinkOpen(false)}
              style={{
                height: 28,
                padding: '0 14px',
                borderRadius: 999,
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.textSecondary,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyleInner: React.CSSProperties = {
  background: C.bgHover,
  fontSize: 13,
}
