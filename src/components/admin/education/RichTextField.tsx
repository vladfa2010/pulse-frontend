/**
 * =============================================================================
 * ТЗ-137 — RichTextField: WYSIWYG-редактор конспекта (TipTap v3)
 * =============================================================================
 *
 * Контракт хранения НЕ меняется: value = HTML-строка text_content, как у
 * TextFormatField (ТЗ-108/ТЗ-136). Схема документа = серверный whitelist
 * (contentHtml.ts), поэтому round-trip «визуально → HTML → визуально» не
 * теряет данные. Что вне схемы (script, iframe, style, чужие классы) —
 * отбрасывается схемой при парсинге и санитайзером при сохранении; в
 * HTML-режиме автор видит предупреждение ДО сохранения (плашка из мокапа).
 *
 * Режимы:
 *   «Визуально» — TipTap; холст стилизован классами .edu-content-эквивалентом
 *   (инлайн-стили ниже повторяют .edu-content студента 1в1 — см. мокап editor.html).
 *   «HTML» — textarea с моноширинным шрифтом + плашка-предупреждение о тегах,
 *   которые вырежет санитайзер.
 *
 * Доверенный HTML-блок (ТЗ-137 Задача 1): atom-нода HtmlBlock, хранит вёрстку
 * в attr (URL-encoded). Перед onChange и после setContent — трансформы
 * inHtml/outHtml (ниже), потому что TipTap не умеет рендерить raw-HTML из
 * attr в сериализованный документ. При вставке — модалка-подтверждение
 * «блок выполняется как есть» (решение владельца).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import {
  Bold, Code, Heading2, Heading3, Image as ImageIcon, Italic, Link2, LineChart,
  List, ListOrdered, Loader2, Pencil, Redo2, TextQuote, Underline as UnderlineIcon,
  Undo2, AlertTriangle, FileCode2, Trash2, RefreshCw,
} from 'lucide-react'
import { C, inputCls } from './ui'
import { uploadContentImage } from './api'
import InstrumentSearchInput from '@/components/admin/InstrumentSearchInput'
import CandleChart from '@/components/CandleChart'
import { adminApi } from '@/lib/api'

// ─── Storage-трансформы для html-block ───────────────────────────────────────
// В text_content: <div class="html-block">…сырая вёрстка…</div>
// В документе TipTap: <div class="html-block" data-html="…urlencoded…"></div>
// (raw-HTML внутрь DOM редактора не попадает — блок атомарен, его вёрстку
//  показывает NodeView через dangerouslySetInnerHTML).

function inHtml(storage: string): string {
  if (!storage.includes('html-block')) return storage
  const doc = new DOMParser().parseFromString(storage, 'text/html')
  doc.querySelectorAll('div.html-block').forEach((el) => {
    el.setAttribute('data-html', encodeURIComponent(el.innerHTML))
    el.innerHTML = ''
  })
  return doc.body.innerHTML
}

function outHtml(docHtml: string): string {
  if (!docHtml.includes('data-html')) return docHtml
  const doc = new DOMParser().parseFromString(docHtml, 'text/html')
  doc.querySelectorAll('div.html-block[data-html]').forEach((el) => {
    el.innerHTML = decodeURIComponent(el.getAttribute('data-html') || '')
    el.removeAttribute('data-html')
  })
  return doc.body.innerHTML
}

// ─── Кастомные ноды ──────────────────────────────────────────────────────────

/** div.callout — акцентная выноска (стилистика = студенческий .callout). */
const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  parseHTML: () => [{ tag: 'div.callout' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { class: 'callout' }), 0],
})

/** Расширение Image атрибутом width="N%" (пресеты 25/50/75/100). */
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = (el as HTMLElement).getAttribute('width') || ''
          return /^([1-9]\d?|100)%$/.test(w) ? w : null
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
    }
  },
})

/** div.html-block — доверенная вёрстка (см. storage-трансформы выше). */
const HtmlBlock = Node.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { html: { default: '' } } // URL-encoded
  },
  parseHTML: () => [{
    tag: 'div.html-block',
    getAttrs: (el) => ({ html: (el as HTMLElement).getAttribute('data-html') || '' }),
  }],
  renderHTML: ({ HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, { class: 'html-block', 'data-html': HTMLAttributes.html }),
  ],
  // NodeView регистрируется ТОЛЬКО через addNodeView (B1, ревью ТЗ-137):
  // .configure({ nodeViews }) — несуществующий API, молча игнорируется,
  // блок рендерился пустым renderHTML без шапки и предпросмотра.
  addNodeView() {
    return ReactNodeViewRenderer(HtmlBlockView)
  },
})

/** ТЗ-143: div.chart-block — график инструмента (атом, как htmlBlock).
 *  Хранит только data-* атрибуты; свечи подгружаются при просмотре. */
const ChartBlock = Node.create({
  name: 'chartBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      ticker: { default: '' },
      exchange: { default: '' },
      name: { default: '' },
      tf: { default: 'd1' },
      range: { default: '3M' },
      width: {
        default: null,
        parseHTML: (el) => {
          const w = (el as HTMLElement).getAttribute('data-width') || ''
          return /^([1-9]\d?|100)%$/.test(w) ? w : null // тот же валидатор, что у img (ТЗ-137)
        },
      },
    }
  },
  parseHTML: () => [{
    tag: 'div.chart-block',
    getAttrs: (el) => {
      const d = (el as HTMLElement).dataset
      return { ticker: d.ticker || '', exchange: d.exchange || '', name: d.name || '', tf: d.tf || 'd1', range: d.range || '3M' }
    },
  }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, {
      class: 'chart-block',
      'data-ticker': node.attrs.ticker,
      'data-exchange': node.attrs.exchange,
      'data-name': node.attrs.name,
      'data-tf': node.attrs.tf,
      'data-range': node.attrs.range,
      ...(node.attrs.width ? { 'data-width': node.attrs.width } : {}),
    }),
  ],
  // NodeView — ТОЛЬКО через addNodeView (B1, ревью ТЗ-137).
  addNodeView() {
    return ReactNodeViewRenderer(ChartBlockView)
  },
})

/** NodeView: шапка «HTML-блок» + живой предпросмотр + кнопки (мокап 1в1). */
function HtmlBlockView(props: NodeViewProps) {
  const { node, deleteNode, updateAttributes } = props
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inner = useMemo(() => decodeURIComponent(node.attrs.html || ''), [node.attrs.html])
  return (
    <NodeViewWrapper>
      <div style={{
        margin: '16px 0', border: '1px dashed rgba(167,139,250,.5)', borderRadius: 12,
        background: 'rgba(167,139,250,.05)', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
          background: 'rgba(167,139,250,.1)', fontSize: 10, fontWeight: 700,
          letterSpacing: '.1em', textTransform: 'uppercase', color: '#A78BFA',
        }}>
          <FileCode2 size={11} /> HTML-блок · выполняется как есть
          <span style={{ flex: 1 }} />
          <button type="button" style={hbBtn} onClick={() => { setDraft(inner); setEditing(true) }}>
            Править вёрстку
          </button>
          <button type="button" style={hbBtn} onClick={deleteNode}>Удалить</button>
        </div>
        <div style={{ padding: 16 }} dangerouslySetInnerHTML={{ __html: inner }} />
      </div>
      {editing && (
        <HtmlBlockModal
          initial={draft}
          title="Править HTML-блок"
          onCancel={() => setEditing(false)}
          onApply={(html) => {
            updateAttributes({ html: encodeURIComponent(html) })
            setEditing(false)
          }}
        />
      )}
    </NodeViewWrapper>
  )
}
const hbBtn: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: 10, fontWeight: 600, height: 22, padding: '0 10px',
  borderRadius: 999, cursor: 'pointer', border: '1px solid rgba(167,139,250,.4)',
  background: 'transparent', color: '#A78BFA',
}

const TF_LABEL: Record<string, string> = { d1: 'Дневки', m5: '5 мин' }

/** ТЗ-143 NodeView: шапка «График · SBER · MOEX · Дневки 3M» + живой предпросмотр
 *  (публичный /api/market/chart — та же ручка, что у ученика: предпросмотр
 *  проверяет реальный путь данных) + кнопки. */
function ChartBlockView(props: NodeViewProps) {
  const { node, deleteNode, updateAttributes, editor } = props
  const { ticker, exchange, name, tf, range } = node.attrs as { ticker: string; exchange: string; name: string; tf: string; range: string }
  const [chart, setChart] = useState<{ times: string[]; ohlc: number[][]; volumes: number[]; timezone: string } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setChart(null)
    setFailed(false)
    adminApi.get(`/api/market/chart?ticker=${encodeURIComponent(ticker)}&exchange=${encodeURIComponent(exchange)}&tf=${encodeURIComponent(tf)}&range=${encodeURIComponent(range)}`)
      .then((d) => {
        if (!alive) return
        setChart({ times: d.times || [], ohlc: d.ohlc || [], volumes: d.volumes || [], timezone: d.timezone || 'Europe/Moscow' })
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [ticker, exchange, tf, range])

  return (
    <NodeViewWrapper className="chart-block-view" data-drag-handle>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
        border: '1px dashed rgba(0,212,255,.35)', borderBottom: 'none',
        borderRadius: '10px 10px 0 0', background: 'rgba(0,212,255,.04)',
        fontSize: 12, color: C.textSecondary,
      }}>
        <LineChart size={13} color="#00D4FF" />
        <b style={{ color: '#fff' }}>{ticker}</b>
        <span>{name || '—'}</span>
        <span style={{ color: C.textMuted }}>{exchange} · {TF_LABEL[tf] ?? tf} {range}</span>
        <span style={{ flex: 1 }} />
        <button type="button" title="Изменить инструмент" style={hbBtn}
          onClick={() => (editor as any).__openChartModal?.({ ticker, exchange, name, tf, range, updateAttributes })}>
          <Pencil size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
          Изменить
        </button>
        <button type="button" title="Удалить блок" style={{ ...hbBtn, color: '#EF4444', borderColor: 'rgba(239,68,68,.4)' }} onClick={deleteNode}>
          <Trash2 size={12} style={{ verticalAlign: -2 }} />
        </button>
      </div>
      <div style={{
        border: '1px dashed rgba(0,212,255,.35)', borderTop: 'none',
        borderRadius: '0 0 10px 10px', padding: 8, background: 'rgba(0,212,255,.02)',
      }}>
        {failed && (
          <div style={{ padding: '18px 12px', fontSize: 12, color: C.textMuted, textAlign: 'center' }}>
            Предпросмотр недоступен (рынок не отвечает) — в уроке блок покажет заставку с повтором.
          </div>
        )}
        {!failed && !chart && (
          <div style={{ padding: '18px 12px', fontSize: 12, color: C.textMuted, textAlign: 'center' }}>Загружаем график…</div>
        )}
        {!failed && chart && chart.times.length > 0 && (
          <CandleChart times={chart.times} ohlc={chart.ohlc} volumes={chart.volumes} height={200} timezone={chart.timezone} interactive={false} />
        )}
        {!failed && chart && chart.times.length === 0 && (
          <div style={{ padding: '18px 12px', fontSize: 12, color: '#F59E0B', textAlign: 'center' }}>
            По инструменту нет свечей — проверьте тикер и биржу.
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

/** ТЗ-143: вставка/редактирование chart-блока. Поиск инструмента —
 *  InstrumentSearchInput 1:1 из редактирования тега (TagDetailModal:647):
 *  живой дроплист по /api/admin/market/search с debounce 300мс.
 *  Таймфрейм: Дневки / 5 мин — от него зависят пресеты диапазона. */
const TF_RANGES: Record<string, string[]> = { d1: ['1M', '3M', '6M', '1Y'], m5: ['1D', '1W', '1M'] }

function ChartBlockModal({ initial, onApply, onCancel }: {
  initial: { ticker: string; exchange: string; name: string; tf: string; range: string } | null
  onApply: (v: { ticker: string; exchange: string; name: string; tf: string; range: string }) => void
  onCancel: () => void
}) {
  const [picked, setPicked] = useState(initial)
  const [tf, setTf] = useState(initial?.tf || 'd1')
  const [range, setRange] = useState(initial?.range || '3M')
  const [queryEmpty, setQueryEmpty] = useState(!initial)

  // Тот же маппинг MIC→алиас, что в редакторе тега (TagDetailModal.tsx:42,383)
  const MIC_TO_ALIAS: Record<string, string> = { MISX: 'MOEX', XNGS: 'NASDAQ', XNYS: 'NYSE' }

  const switchTf = (next: string) => {
    setTf(next)
    // диапазоны таймфреймов не пересекаются (кроме 1M) — ставим дефолт нового
    if (!TF_RANGES[next].includes(range)) setRange(next === 'm5' ? '1D' : '3M')
  }

  const pill = (on: boolean): React.CSSProperties => ({
    fontFamily: 'inherit', fontSize: 11, fontWeight: 600, height: 26, padding: '0 12px',
    borderRadius: 999, cursor: 'pointer', transition: 'all .15s',
    border: `1px solid ${on ? '#00D4FF' : C.border}`,
    background: on ? '#00D4FF' : 'transparent',
    color: on ? '#060606' : C.textSecondary,
  })

  return (
    <div style={modalOverlay} onClick={onCancel}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
          {initial ? 'Изменить график' : 'Вставить график инструмента'}
        </div>
        <InstrumentSearchInput
          compact
          initialQuery={initial ? `${initial.ticker} — ${initial.name}` : ''}
          placeholder="Тикер, название или ISIN"
          onPick={(m) => setPicked({
            ticker: m.ticker,
            exchange: MIC_TO_ALIAS[m.mic] ?? m.mic,
            name: m.name,
            tf,
            range,
          })}
          onQueryChange={(q) => { setQueryEmpty(q.trim().length < 2); if (picked && !q.startsWith(picked.ticker)) setPicked(null) }}
        />
        <div style={{ display: 'flex', gap: 6, margin: '12px 0 0', alignItems: 'center' }}>
          <button type="button" style={pill(tf === 'd1')} onClick={() => switchTf('d1')}>Дневки</button>
          <button type="button" style={pill(tf === 'm5')} onClick={() => switchTf('m5')}>5 мин</button>
          <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 6 }}>таймфрейм</span>
        </div>
        <div style={{ display: 'flex', gap: 6, margin: '10px 0', alignItems: 'center' }}>
          {TF_RANGES[tf].map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)} style={pill(range === r)}>{r}</button>
          ))}
          <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 6 }}>диапазон графика</span>
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
          График обновляется при каждом просмотре урока — ученик всегда видит актуальные свечи.
          Ширина блока настраивается после вставки (как у картинки).
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" style={ghostBtn} onClick={onCancel}>Отмена</button>
          <button type="button" style={{ ...applyBtn, background: '#00D4FF', borderColor: '#00D4FF', opacity: picked ? 1 : 0.4 }}
            disabled={!picked}
            onClick={() => picked && onApply({ ...picked, tf, range })}>
            {initial ? 'Сохранить' : 'Вставить'}
          </button>
        </div>
        {queryEmpty && !picked && (
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
            Начните вводить — выпадет список инструментов из справочника Finam.
          </div>
        )}
      </div>
    </div>
  )
}

/** Модалка вставки/правки html-блока с подтверждением риска (обязательна). */
function HtmlBlockModal({ initial, title, onApply, onCancel }: {
  initial: string; title: string
  onApply: (html: string) => void; onCancel: () => void
}) {
  const [html, setHtml] = useState(initial)
  const [confirmed, setConfirmed] = useState(false)
  return (
    <div style={modalOverlay} onClick={onCancel}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{title}</div>
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          placeholder={'<div style="…">…ваша вёрстка…</div>'}
          style={{
            width: '100%', minHeight: 180, resize: 'vertical', background: '#0A0A0A',
            border: `1px solid ${C.border}`, borderRadius: 8, color: '#D1D5DB',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, lineHeight: 1.7,
            padding: 12, boxSizing: 'border-box', outline: 'none',
          }}
        />
        <label style={{
          display: 'flex', gap: 10, alignItems: 'flex-start', margin: '12px 0',
          fontSize: 12, lineHeight: 1.5, color: C.textSecondary, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
            style={{ marginTop: 2, accentColor: '#A78BFA' }} />
          <span>
            Понимаю: блок <b style={{ color: '#A78BFA' }}>выполняется на странице урока как есть</b>,
            минуя санитайзер (включая script/iframe). Вставляю только код, которому доверяю.
          </span>
        </label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className={inputCls} style={ghostBtn} onClick={onCancel}>Отмена</button>
          <button type="button" style={{ ...ghostBtn, ...(confirmed && html.trim() ? applyBtn : {}), opacity: confirmed && html.trim() ? 1 : .4 }}
            disabled={!confirmed || !html.trim()}
            onClick={() => onApply(html)}>
            Вставить блок
          </button>
        </div>
      </div>
    </div>
  )
}
const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.6)',
  display: 'grid', placeItems: 'center', padding: 20,
}
const modalCard: React.CSSProperties = {
  width: '100%', maxWidth: 640, background: '#0E0E0E', border: '1px solid #222',
  borderRadius: 12, padding: 20,
}
const ghostBtn: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: 12, fontWeight: 600, height: 36, padding: '0 16px',
  borderRadius: 999, cursor: 'pointer', border: '1px solid #222', background: '#161616', color: '#fff',
}
const applyBtn: React.CSSProperties = { background: '#A78BFA', borderColor: '#A78BFA', color: '#060606' }

// ─── Плашка «что вырежет санитайзер» (HTML-режим) ────────────────────────────
// Клиентская ОЦЕНКА (сервер — финальный фильтр): ищем явно запрещённое ВНЕ
// html-block'ов и показываем список с номерами строк, как в мокапе.

const FORBIDDEN = /<(script|iframe|object|embed|form|input|button|style|link|meta|video|audio|source)\b|\son[a-z]+\s*=|style\s*=/i

function scanStripped(src: string): { tag: string; line: number }[] {
  // вне блоков: блоки временно заменяем пустышкой той же «высоты» в строках.
  // Маскируем БАЛАНСОМ <div>/</div> (та же логика, что extractHtmlBlocks на
  // сервере): ленивый регэксп <\/div> обрывался на первом внутреннем div, и
  // «хвост» доверенного блока сканировался → ложные срабатывания плашки на
  // style=/form внутри блока, который заведомо сохранится.
  const BLOCK = '<div class="html-block">'
  const out: { tag: string; line: number }[] = []
  let pos = 0
  let line = 1
  const pushLine = (l: string, lineNo: number) => {
    const m = l.match(FORBIDDEN)
    if (m) out.push({ tag: m[0].replace(/[<"]/g, '').trim().split(/\s/)[0], line: lineNo })
  }
  for (;;) {
    const start = src.indexOf(BLOCK, pos)
    if (start === -1) {
      src.slice(pos).split('\n').forEach((l, i) => pushLine(l, line + i))
      break
    }
    // конец блока — баланс <div>/</div>
    let depth = 0
    let end = -1
    const tagRe = /<div\b|<\/div>/g
    tagRe.lastIndex = start
    let m: RegExpExecArray | null
    while ((m = tagRe.exec(src)) !== null) {
      if (m[0] === '<div') depth++
      else {
        depth--
        if (depth === 0) { end = tagRe.lastIndex; break }
        }
    }
    if (end === -1) end = src.length
    // сканируем текст ДО блока, блок пропускаем (переносы сохраняем для нумерации строк)
    const before = src.slice(pos, start)
    before.split('\n').forEach((l, i) => pushLine(l, line + i))
    const blockLines = src.slice(start, end).split('\n').length - 1
    line += before.split('\n').length - 1 + blockLines
    pos = end
  }
  return out.slice(0, 6)
}

// ─── Компонент ───────────────────────────────────────────────────────────────

export default function RichTextField({ value, onChange, minHeight = 220 }: {
  value: string
  onChange: (html: string) => void
  minHeight?: number
}) {
  const [mode, setMode] = useState<'vis' | 'src'>('vis')
  const [srcText, setSrcText] = useState('')
  const [stripped, setStripped] = useState<{ tag: string; line: number }[]>([])
  const [imgBusy, setImgBusy] = useState(false)
  const [imgError, setImgError] = useState('')
  const [htmlBlockOpen, setHtmlBlockOpen] = useState(false)
  // ТЗ-143: модалка вставки/правки chart-блока; updateAttributes — при правке
  // существующего блока (из шапки NodeView), иначе — вставка новой ноды.
  const [chartModal, setChartModal] = useState<{
    initial: { ticker: string; exchange: string; name: string; tf: string; range: string } | null
    updateAttributes?: (attrs: Record<string, unknown>) => void
  } | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const editor = useEditor({
    // B4 (ТЗ-137-fix): TipTap v3 по умолчанию НЕ перерендеривает компонент на
    // транзакции — без флага «замораживаются» isActive/can()/счётчик слов (нет
    // бабла ширины картинки, нет подсветки кнопок тулбара). Админский редактор —
    // не горячий контур, полный рендер на транзакцию приемлем (альтернатива —
    // гранулярный useEditorState; не требуем).
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // ссылка из StarterKit v3 — только https (контракт сервера)
        link: { validate: (href) => /^https:\/\//i.test(href), openOnClick: false },
      }),
      ResizableImage,
      Callout,
      HtmlBlock,
      ChartBlock,
    ],
    content: inHtml(value || ''),
    onUpdate: ({ editor }) => onChange(outHtml(editor.getHTML())),
    editorProps: {
      attributes: { 'aria-label': 'Текст урока' },
      handleDrop: (_view, event) => {
        const file = event.dataTransfer?.files?.[0]
        if (!file || !file.type.startsWith('image/')) return false
        event.preventDefault()
        void insertImage(file)
        return true
      },
      handlePaste: (_view, event) => {
        const file = event.clipboardData?.files?.[0]
        if (!file || !file.type.startsWith('image/')) return false
        event.preventDefault()
        void insertImage(file)
        return true
      },
    },
  })

  // внешняя смена value (открыт другой урок) — обновить документ.
  // КРАШ-ФИКС: editor !== null не гарантирует живой инстанс — TipTap v3
  // уничтожает редактор асинхронно (scheduleDestroy через 1 мс), и этот
  // эффект может отработать на уже уничтоженном: getHTML() тогда падает с
  // «Cannot read properties of null (reading 'cached')» (Editor.destroy
  // обнуляет schema), ловится ErrorBoundary → «Не удалось загрузить
  // приложение». Воспроизводилось на проде при открытии редактора урока
  // (lazy-чанок + Suspense). Проверяем isDestroyed; editor — в deps,
  // чтобы эффект переигрался на свежем инстансе после пересоздания.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const current = outHtml(editor.getHTML())
    if ((value || '') !== current) editor.commands.setContent(inHtml(value || ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  // ТЗ-143: канал NodeView → модалка chart-блока (шапка блока «Изменить»).
  useEffect(() => {
    if (editor) (editor as any).__openChartModal = (v: any) => setChartModal({ initial: v, updateAttributes: v.updateAttributes })
    return () => { if (editor) (editor as any).__openChartModal = undefined }
  }, [editor])

  const insertImage = async (file: File) => {
    if (!editor) return
    setImgBusy(true)
    setImgError('')
    try {
      const { url } = await uploadContentImage(file) // ТЗ-136: POST /content-image
      editor.chain().focus().setImage({ src: url }).run()
    } catch (err: any) {
      const status = err?.status as number | undefined
      setImgError(
        status === 413 ? 'Файл больше 10 МБ'
        : status === 415 ? 'Только jpg/png/webp'
        : status === 429 ? 'Лимит загрузок (20/час), подождите'
        : err?.message || 'Не удалось загрузить картинку',
      )
    } finally {
      setImgBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const switchMode = (m: 'vis' | 'src') => {
    if (!editor || m === mode) return
    if (m === 'src') {
      const html = outHtml(editor.getHTML())
      setSrcText(html)
      setStripped(scanStripped(html))
      setMode('src')
    } else {
      // HTML → визуально: схема сама отбросит вне-whitelist; предупреждение уже
      // показано в scanStripped при входе в режим и при вводе
      editor.commands.setContent(inHtml(srcText))
      onChange(outHtml(editor.getHTML()))
      setMode('vis')
    }
  }

  const imgActive = editor?.isActive('image') ?? false
  const imgWidth: string | null = imgActive ? (editor!.getAttributes('image').width ?? null) : null
  // ТЗ-143: chart-блок — тот же бабл пресетов ширины, что у картинки
  const chartActive = editor?.isActive('chartBlock') ?? false
  const chartWidth: string | null = chartActive ? (editor!.getAttributes('chartBlock').width ?? null) : null
  const bubbleWidth = imgActive ? imgWidth : chartWidth

  // ─── тулбар (состав и иконки = мокап editor.html) ───
  const tbBtn = (on: boolean): React.CSSProperties => ({
    width: 30, height: 30, border: 'none', borderRadius: '.375rem', cursor: 'pointer',
    display: 'grid', placeItems: 'center', flex: 'none', transition: 'all .15s',
    background: on ? 'rgba(0,212,255,.12)' : 'transparent',
    color: on ? C.accent : C.textSecondary,
  })
  const sep = <span style={{ width: 1, height: 18, background: C.border, margin: '0 5px', flex: 'none' }} />

  return (
    <div>
      {/* сегмент Визуально / HTML */}
      <div style={{ display: 'inline-flex', background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 999, padding: 3, gap: 2, marginBottom: 10 }}>
        {(['vis', 'src'] as const).map((m) => (
          <button key={m} type="button" onClick={() => switchMode(m)} style={{
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600, height: 30, padding: '0 16px',
            border: 'none', borderRadius: 999, cursor: 'pointer', display: 'inline-flex',
            alignItems: 'center', gap: 7, transition: 'all .25s',
            background: mode === m ? C.accent : 'transparent',
            color: mode === m ? '#060606' : C.textMuted,
          }}>
            {m === 'vis' ? 'Визуально' : 'HTML'}
          </button>
        ))}
      </div>

      {mode === 'vis' ? (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
            background: C.bgSurface, border: `1px solid ${C.border}`, borderBottom: 'none',
            borderRadius: '.75rem .75rem 0 0', padding: '8px 10px',
          }}>
            <button type="button" title="Отменить (Ctrl+Z)" style={tbBtn(false)} disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={14} /></button>
            <button type="button" title="Повторить (Ctrl+Y)" style={tbBtn(false)} disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={14} /></button>
            {sep}
            <button type="button" title="Заголовок H2" style={tbBtn(!!editor?.isActive('heading', { level: 2 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={14} /></button>
            <button type="button" title="Заголовок H3" style={tbBtn(!!editor?.isActive('heading', { level: 3 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={14} /></button>
            {sep}
            <button type="button" title="Жирный (Ctrl+B)" style={tbBtn(!!editor?.isActive('bold'))} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={14} /></button>
            <button type="button" title="Курсив (Ctrl+I)" style={tbBtn(!!editor?.isActive('italic'))} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={14} /></button>
            <button type="button" title="Подчёркнутый (Ctrl+U)" style={tbBtn(!!editor?.isActive('underline'))} onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={14} /></button>
            <button type="button" title="Код" style={tbBtn(!!editor?.isActive('code'))} onClick={() => editor?.chain().focus().toggleCode().run()}><Code size={14} /></button>
            {sep}
            <button type="button" title="Ссылка (https://…)" style={tbBtn(!!editor?.isActive('link'))} onClick={() => {
              if (!editor) return
              if (editor.isActive('link')) { editor.chain().focus().unsetLink().run(); return }
              const url = window.prompt('https://…')
              if (url && /^https:\/\//i.test(url)) editor.chain().focus().setLink({ href: url }).run()
              else if (url) setImgError('Ссылка должна начинаться с https://')
            }}><Link2 size={14} /></button>
            <button type="button" title="Маркированный список" style={tbBtn(!!editor?.isActive('bulletList'))} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={14} /></button>
            <button type="button" title="Нумерованный список" style={tbBtn(!!editor?.isActive('orderedList'))} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></button>
            <button type="button" title="Цитата" style={tbBtn(!!editor?.isActive('blockquote'))} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><TextQuote size={14} /></button>
            {sep}
            <button type="button" title="Картинка — кнопка, drag&drop или Ctrl+V" style={tbBtn(false)} disabled={imgBusy}
              onClick={() => fileRef.current?.click()}>
              {imgBusy ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />}
            </button>
            <button type="button" title="Callout — акцентный блок" style={tbBtn(!!editor?.isActive('callout'))}
              onClick={() => {
                if (!editor) return
                editor.isActive('callout')
                  ? editor.chain().focus().lift('callout').run()
                  : editor.chain().focus().wrapIn('callout').run()
              }}><AlertTriangle size={14} /></button>
            <button type="button" title="HTML-блок — своя вёрстка островком" style={tbBtn(false)} onClick={() => setHtmlBlockOpen(true)}><FileCode2 size={14} /></button>
            <button type="button" title="График инструмента — живые свечи из Финама" style={tbBtn(false)}
              onClick={() => setChartModal({ initial: null })}><LineChart size={14} /></button>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: C.textMuted, paddingRight: 6, whiteSpace: 'nowrap' }}>
              {editor ? `${editor.getText().split(/\s+/).filter(Boolean).length} слов · ${editor.getText().length} зн.` : ''}
            </span>
          </div>

          {/* бабл картинки/chart-блока: пресеты ширины + заменить/удалить (мокап 1в1) */}
          {(imgActive || chartActive) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4, background: '#141414',
              border: `1px solid ${C.border}`, borderRadius: 999, padding: '5px 8px',
              margin: '6px 0', width: 'fit-content',
            }}>
              {[25, 50, 75, 100].map((w) => (
                <button key={w} type="button" onClick={() => editor!.chain().focus().updateAttributes(imgActive ? 'image' : 'chartBlock', { width: `${w}%` }).run()}
                  style={{
                    fontFamily: 'inherit', fontSize: 11, fontWeight: 600, height: 26, padding: '0 11px',
                    borderRadius: 999, cursor: 'pointer', transition: 'all .15s',
                    border: `1px solid ${bubbleWidth === `${w}%` ? C.accent : C.border}`,
                    background: bubbleWidth === `${w}%` ? C.accent : 'transparent',
                    color: bubbleWidth === `${w}%` ? '#060606' : C.textSecondary,
                  }}>{w}%</button>
              ))}
              {bubbleWidth && (
                <button type="button" title="Во всю ширину (убрать width)" onClick={() => editor!.chain().focus().updateAttributes(imgActive ? 'image' : 'chartBlock', { width: null }).run()}
                  style={{ ...tbBtn(false), width: 'auto', height: 26, padding: '0 10px', fontSize: 11 }}>
                  сброс
                </button>
              )}
              <span style={{ width: 1, height: 16, background: C.border, margin: '0 3px' }} />
              {imgActive && (
                <button type="button" title="Заменить картинку" style={tbBtn(false)} onClick={() => fileRef.current?.click()}><RefreshCw size={13} /></button>
              )}
              {chartActive && (
                <button type="button" title="Изменить инструмент" style={tbBtn(false)}
                  onClick={() => setChartModal({ initial: editor!.getAttributes('chartBlock') as any })}><Pencil size={13} /></button>
              )}
              <button type="button" title="Удалить" style={{ ...tbBtn(false), color: '#EF4444' }} onClick={() => editor!.chain().focus().deleteSelection().run()}><Trash2 size={13} /></button>
            </div>
          )}

          {/* холст — стили = .edu-content студента (см. index.css), 1в1 с мокапом */}
          <div style={{
            background: C.bgSurface, border: `1px solid ${C.border}`,
            borderRadius: (imgActive || chartActive) ? '.75rem' : '0 0 .75rem .75rem',
            minHeight, position: 'relative',
          }} className="rtf-canvas">
            <EditorContent editor={editor} />
          </div>
          {/* стили холста: повторяют .edu-content (index.css) — держать синхронно!
              Глобальный <style>, т.к. ProseMirror рендерит свои DOM-узлы. */}
          <style>{`
            .rtf-canvas .ProseMirror{outline:none;max-width:720px;margin:0 auto;padding:32px 40px 56px;min-height:${minHeight}px}
            .rtf-canvas .ProseMirror p{margin:0 0 14px;color:#D1D5DB;line-height:1.7;font-size:15px}
            .rtf-canvas .ProseMirror h2{font-size:22px;font-weight:700;margin:28px 0 12px;color:#fff}
            .rtf-canvas .ProseMirror h3{font-size:17px;font-weight:600;margin:22px 0 10px;color:#fff}
            .rtf-canvas .ProseMirror code{font-family:'JetBrains Mono',monospace;font-size:.88em;background:rgba(0,212,255,.08);color:#00D4FF;border-radius:4px;padding:1px 5px}
            .rtf-canvas .ProseMirror blockquote{border-left:3px solid #00D4FF;padding:4px 0 4px 16px;margin:16px 0;color:#9CA3AF;font-style:italic}
            .rtf-canvas .ProseMirror ul,.rtf-canvas .ProseMirror ol{margin:0 0 14px;padding-left:22px;color:#D1D5DB;line-height:1.7;font-size:15px}
            .rtf-canvas .ProseMirror li{margin-bottom:6px}
            .rtf-canvas .ProseMirror a{color:#00D4FF;text-decoration:none;border-bottom:1px solid rgba(0,212,255,.35)}
            .rtf-canvas .ProseMirror .callout{background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.22);border-radius:12px;padding:14px 16px;margin:16px 0}
            .rtf-canvas .ProseMirror img{max-width:100%;height:auto;display:block;margin:14px auto;border-radius:12px;border:1px solid rgba(255,255,255,.07)}
            .rtf-canvas .ProseMirror img.ProseMirror-selectednode{outline:2px solid #00D4FF;outline-offset:2px;box-shadow:0 0 24px rgba(0,212,255,.2)}
            .rtf-canvas .ProseMirror .chart-block-view{margin:16px 0;cursor:default}
            .rtf-canvas .ProseMirror .chart-block-view.ProseMirror-selectednode{outline:2px solid #00D4FF;outline-offset:2px;border-radius:10px;box-shadow:0 0 24px rgba(0,212,255,.2)}
            .rtf-canvas .spin{animation:rtf-spin 1s linear infinite}
            @keyframes rtf-spin{to{transform:rotate(360deg)}}
          `}</style>
        </>
      ) : (
        /* ─── HTML-режим (мокап: плашка + моно-текст) ─── */
        <div style={{ background: '#0A0A0A', border: `1px solid ${C.border}`, borderRadius: '.75rem', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: `1px solid ${C.border}`, background: C.bgSurface, fontSize: 11, color: C.textMuted }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.textSecondary }}>text_content.html</span>
            <span style={{ flex: 1 }} />
            <span>При переключении обратно редактор парсит HTML по whitelist</span>
          </div>
          {stripped.length > 0 && (
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', fontSize: 12,
              lineHeight: 1.5, background: 'rgba(251,191,36,.06)', borderBottom: '1px solid rgba(251,191,36,.25)',
              color: '#F59E0B',
            }}>
              <b style={{ whiteSpace: 'nowrap' }}>⚠ Санитайзер вырежет:</b>
              <span>{stripped.map((s) => `${s.tag} (строка ${s.line})`).join(', ')} — вне whitelist. Вёрстка внутри HTML-блоков сохраняется как есть.</span>
            </div>
          )}
          <textarea
            value={srcText}
            onChange={(e) => { setSrcText(e.target.value); setStripped(scanStripped(e.target.value)) }}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 420, resize: 'vertical', background: 'transparent',
              border: 'none', color: '#D1D5DB', fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12.5, lineHeight: 1.75, padding: '16px 20px', boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>
      )}

      {imgError && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#EF4444' }}>{imgError}</div>
      )}

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void insertImage(f) }} />

      {htmlBlockOpen && editor && (
        <HtmlBlockModal
          initial=""
          title="Вставить HTML-блок"
          onCancel={() => setHtmlBlockOpen(false)}
          onApply={(html) => {
            editor.chain().focus().insertContent({ type: 'htmlBlock', attrs: { html: encodeURIComponent(html) } }).run()
            setHtmlBlockOpen(false)
          }}
        />
      )}

      {chartModal && editor && (
        <ChartBlockModal
          initial={chartModal.initial}
          onCancel={() => setChartModal(null)}
          onApply={(v) => {
            if (chartModal.updateAttributes) {
              chartModal.updateAttributes(v)
            } else {
              editor.chain().focus().insertContent({ type: 'chartBlock', attrs: v }).run()
            }
            setChartModal(null)
          }}
        />
      )}
    </div>
  )
}
