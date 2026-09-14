import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import termsRaw from '../assets/terms-of-use.md?raw'

// Условия использования PULSE v2.0 — источник: src/assets/terms-of-use.md
// Рендерим ограниченное подмножество markdown (заголовки, списки, жирный,
// код, ссылки, hr) — других конструкций в документе нет.

/** Убираем раздел «Содержание» — в веб-версии он не нужен. */
function stripTableOfContents(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let skipping = false
  for (const line of lines) {
    if (/^##\s+Содержание\s*$/.test(line)) {
      skipping = true
      continue
    }
    if (skipping) {
      if (/^##\s+/.test(line)) skipping = false
      else continue
    }
    out.push(line)
  }
  return out.join('\n')
}

/** Инлайн-разметка: **жирный**, `код`, [текст](url). */
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-white/10 text-white text-sm">
          {part.slice(1, -1)}
        </code>
      )
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const [, label, href] = link
      if (href.startsWith('/')) {
        return (
          <Link key={i} to={href} className="text-[#00D4FF] hover:underline">
            {label}
          </Link>
        )
      }
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-[#00D4FF] hover:underline">
          {label}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

/** Блочный рендер: заголовки, списки, hr, абзацы. */
function renderMarkdown(md: string): ReactNode[] {
  const lines = md.split('\n')
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let key = 0

  const flushList = () => {
    if (!list) return
    const items = list.items.map((item, i) => <li key={i}>{renderInline(item)}</li>)
    blocks.push(
      list.ordered ? (
        <ol key={key++} className="list-decimal list-inside space-y-1.5 pl-2">
          {items}
        </ol>
      ) : (
        <ul key={key++} className="list-disc list-inside space-y-1.5 pl-2">
          {items}
        </ul>
      )
    )
    list = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    const ulItem = trimmed.match(/^[-•]\s+(.*)$/)
    const olItem = trimmed.match(/^\d+[.)]\s+(.*)$/)

    if (ulItem || olItem) {
      const ordered = Boolean(olItem)
      const text = (ulItem || olItem)![1]
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      list.items.push(text)
      continue
    }
    flushList()

    if (!trimmed) continue
    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={key++} className="border-white/10" />)
      continue
    }
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h3 key={key++} className="text-base font-semibold text-white">
          {renderInline(trimmed.slice(4))}
        </h3>
      )
      continue
    }
    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h2 key={key++} className="text-lg font-semibold text-white pt-2">
          {renderInline(trimmed.slice(3))}
        </h2>
      )
      continue
    }
    if (trimmed.startsWith('# ')) {
      // H1 документа совпадает с заголовком страницы — пропускаем
      continue
    }
    blocks.push(
      <p key={key++} className="m-0">
        {renderInline(trimmed)}
      </p>
    )
  }
  flushList()
  return blocks
}

export default function Terms() {
  const blocks = renderMarkdown(stripTableOfContents(termsRaw))

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} />
            <span>Назад</span>
          </Link>
          <h1 className="text-2xl font-bold">Условия использования</h1>
        </div>

        <div className="space-y-4 text-text-secondary leading-relaxed">{blocks}</div>
      </div>
    </div>
  )
}
