import { useEffect, useRef, useState } from 'react'
import { resolveSource, searchNews } from './api'
import { C, IconBtn, inputBlur, inputCls, inputFocus, inputStyle } from './ui'
import type { NewsSearchItem, PickedSource } from './types'

// Пикер источника/новости: поиск по всем новостям (debounce 300 мс) + вставка
// ссылки → POST /resolve-source (ТЗ-101 v13/v15). Фронт URL сам не резолвит —
// только мгновенная проверка «похоже на наш домен», чтобы не дёргать API
// на каждый символ; истина — сервер (resolveSourceUrl).

export default function NewsLinkPicker({
  picked,
  onPick,
  placeholder = 'Поиск по всем новостям… или вставьте ссылку на статью, сюжет или тему PULSE',
  /** true — паст принимается строго на статью (/news/<slug>), как в модале создания. */
  strictNewsPaste = false,
  autoFillTitle = false,
  onAutoTitle,
}: {
  picked: PickedSource | null
  onPick: (src: PickedSource | null) => void
  placeholder?: string
  strictNewsPaste?: boolean
  /** Подставить заголовок выбранной новости в поле названия (материалы «новость»). */
  autoFillTitle?: boolean
  onAutoTitle?: (title: string) => void
}) {
  const [q, setQ] = useState('')
  const [options, setOptions] = useState<NewsSearchItem[]>([])
  const [dropOpen, setDropOpen] = useState(false)
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Debounce 300 мс (ТЗ-101).
  useEffect(() => {
    const query = q.trim()
    if (!query || /^https?:\/\//i.test(query)) {
      setOptions([])
      setDropOpen(false)
      return
    }
    const t = setTimeout(async () => {
      try {
        const list = await searchNews(query)
        setOptions(list)
        setDropOpen(true)
      } catch {
        setOptions([])
        setDropOpen(true)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = (e.clipboardData?.getData('text') || '').trim()
    if (!/^https?:\/\//i.test(text)) return
    // Отложенно — после того как вставка попадёт в value.
    setTimeout(() => handleUrl(text), 0)
  }

  const handleUrl = async (url: string) => {
    if (!/^https?:\/\/[^/]*pulse\./i.test(url)) {
      setPasteError(
        strictNewsPaste
          ? 'В этом поле — ссылка строго на статью PULSE (/news/…). Сюжет/тема — в редакторе курса'
          : 'Это не ссылка на материал PULSE — нужна ссылка на статью, сюжет или тему нашего сайта',
      )
      return
    }
    const newsMatch = /^https?:\/\/[^/]+\/news\/([a-z0-9-]+)/i.exec(url)
    const isNews = !!newsMatch
    if (strictNewsPaste && !isNews) {
      setPasteError('В этом поле — ссылка строго на статью PULSE (/news/…). Сюжет/тема — в редакторе курса')
      return
    }
    if (!isNews && !/\/(cascades|stories|topics)\//i.test(url)) {
      setPasteError('Это не ссылка на материал PULSE — нужна ссылка на статью, сюжет или тему нашего сайта')
      return
    }
    setResolving(true)
    setPasteError(null)
    try {
      const resolved = await resolveSource(url)
      onPick({
        source_type: resolved.source_type,
        id: resolved.id,
        title: resolved.title || null,
      })
      setQ('')
      setDropOpen(false)
      if (autoFillTitle && resolved.title) onAutoTitle?.(resolved.title)
    } catch (err: any) {
      // 400/409 от resolve-source — человекочитаемый текст сервера.
      setPasteError(err?.message || 'Не удалось распознать ссылку')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={q}
        onChange={e => {
          setQ(e.target.value)
          setPasteError(null)
        }}
        onPaste={handlePaste}
        onFocus={() => { if (options.length && q.trim()) setDropOpen(true) }}
        placeholder={placeholder}
        autoComplete="off"
        className={inputCls}
        style={inputStyle}
        onFocusCapture={inputFocus}
        onBlurCapture={inputBlur}
      />
      {resolving && (
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
          Распознаём ссылку на сервере…
        </div>
      )}
      {pasteError && (
        <div
          style={{
            fontSize: 11,
            color: C.warning,
            marginTop: 6,
            background: 'rgba(245,158,11,.07)',
            border: '1px solid rgba(245,158,11,.3)',
            borderRadius: 8,
            padding: '8px 12px',
            lineHeight: 1.5,
          }}
        >
          {pasteError}
        </div>
      )}
      {/* Мокап .news-drop */}
      {dropOpen && options.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 5,
            background: '#101010',
            border: `1px solid ${C.border}`,
            borderRadius: '.625rem',
            overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(0,0,0,.6)',
          }}
        >
          {options.map(n => (
            <div
              key={n.id}
              onMouseDown={e => {
                e.preventDefault()
                onPick({ source_type: 'news', id: n.id, title: n.title_ru })
                if (autoFillTitle) onAutoTitle?.(n.title_ru)
                setQ('')
                setDropOpen(false)
              }}
              style={{
                padding: '11px 14px',
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                gap: 10,
                alignItems: 'baseline',
                transition: 'background .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.bgHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 11, color: C.textMuted, flex: 'none' }}>
                {fmtRel(n.published_at)}
              </span>
              <span style={{ minWidth: 0 }}>{n.title_ru}</span>
            </div>
          ))}
        </div>
      )}
      {dropOpen && q.trim() && options.length === 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 5,
            background: '#101010',
            border: `1px solid ${C.border}`,
            borderRadius: '.625rem',
            padding: '11px 14px',
            fontSize: 12,
            color: C.textMuted,
            boxShadow: '0 16px 48px rgba(0,0,0,.6)',
          }}
        >
          Ничего не найдено · GET /api/admin/education/news-search
        </div>
      )}
      {/* Мокап .picked-news — выбранная сущность */}
      {picked && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: '.5rem',
            background: 'rgba(0,212,255,.06)',
            border: '1px solid rgba(0,212,255,.3)',
            fontSize: 13,
          }}
        >
          <span style={{ color: C.accent }}>●</span>
          <span style={{ color: C.textMuted, fontSize: 11, flex: 'none' }}>
            {KIND_LABEL[picked.source_type] || picked.source_type}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>{picked.title || picked.id}</span>
          <IconBtn title="Сбросить выбор" onClick={() => onPick(null)}>
            ✕
          </IconBtn>
        </div>
      )}
    </div>
  )
}

const KIND_LABEL: Record<string, string> = {
  news: 'новость',
  cascade: 'каскад',
  storyline: 'сюжет',
  topic: 'тема',
}

function fmtRel(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'сегодня'
  if (days === 1) return 'вчера'
  return `${days} дн. назад`
}
