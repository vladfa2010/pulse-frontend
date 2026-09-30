import { useEffect, useRef, useState } from 'react'
import { fetchTags } from './api'
import { C } from './ui'
import type { CourseTag } from './types'

// Окошко ввода тегов с автодополнением из единой базы проекта (ТЗ-101 v14).
// Паттерн — виджет тегов главной страницы: поле → выпадайка совпадений,
// выбранные теги — чипы с ×. Свободный ввод запрещён (ТЗ-101 v3).

export default function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder = 'Начните вводить тег — например, «дивиденды»…',
}: {
  tags: CourseTag[]
  onAdd: (tag: CourseTag) => void
  onRemove: (tagId: string) => void
  placeholder?: string
}) {
  const [q, setQ] = useState('')
  const [options, setOptions] = useState<CourseTag[]>([])
  const [dropOpen, setDropOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Debounce ≥ 250 мс (ТЗ-101 v14): запрос на каждый символ не уходит.
  useEffect(() => {
    const query = q.trim()
    if (!query) {
      setOptions([])
      setDropOpen(false)
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const list = await fetchTags(query)
        setOptions(
          list
            .map(t => ({ id: t.tag_id, label: t.tag_name }))
            .filter(t => !tags.some(sel => sel.id === t.id)),
        )
        setDropOpen(true)
      } catch {
        setOptions([])
        setDropOpen(true)
      } finally {
        setSearching(false)
      }
    }, 260)
    return () => clearTimeout(t)
  }, [q, tags])

  // Клик вне виджета закрывает выпадайку.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (tag: CourseTag) => {
    onAdd(tag)
    setQ('')
    setOptions([])
    setDropOpen(false)
  }

  const showNone = q.trim() && !searching && options.length === 0

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      {/* Мокап .tag-input */}
      <div
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          background: '#141414',
          padding: '8px 10px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
        }}
      >
        {tags.map(t => (
          <span
            key={t.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: '5px 8px 5px 11px',
              borderRadius: 999,
              border: '1px solid rgba(0,212,255,.35)',
              background: 'rgba(0,212,255,.07)',
              color: C.accent,
            }}
          >
            {t.label}
            <i
              title="Убрать"
              onClick={() => onRemove(t.id)}
              style={{
                fontStyle: 'normal',
                cursor: 'pointer',
                color: C.textMuted,
                fontSize: 14,
                lineHeight: 1,
                padding: '0 2px',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = C.error)}
              onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
            >
              ×
            </i>
          </span>
        ))}
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => { if (q.trim()) setDropOpen(true) }}
          placeholder={tags.length === 0 ? placeholder : ''}
          autoComplete="off"
          style={{
            flex: 1,
            minWidth: 200,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: C.textPrimary,
            fontSize: 13,
            fontFamily: 'inherit',
            padding: '6px 2px',
          }}
        />
      </div>
      {/* Мокап .tag-drop */}
      {dropOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: '#161616',
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            zIndex: 40,
            maxHeight: 230,
            overflow: 'auto',
            boxShadow: '0 12px 30px rgba(0,0,0,.5)',
          }}
        >
          {searching && (
            <div style={{ padding: '11px 14px', fontSize: 12, color: C.textMuted }}>Поиск…</div>
          )}
          {!searching &&
            options.map(t => (
              <div
                key={t.id}
                onMouseDown={e => {
                  e.preventDefault()
                  pick(t)
                }}
                style={{
                  padding: '11px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bgHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {t.label}
              </div>
            ))}
          {showNone && (
            <div style={{ padding: '11px 14px', fontSize: 12, color: C.textMuted }}>
              «{q.trim()}» нет в базе тегов — свободный ввод запрещён
            </div>
          )}
        </div>
      )}
    </div>
  )
}
