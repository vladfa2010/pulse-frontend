import type { ReactNode } from 'react'

/**
 * ТЗ-161: подсветка вхождений слов запроса в тексте карточки.
 * Регистронезависимо, каждое слово запроса — отдельная подстрока:
 * «нефть» подсвечивается и внутри «нефтяной» (фактически совпавшая подстрока).
 * Регекс экранируется; слова запроса разбиваются по пробелам.
 */
export function highlightQuery(text: string, query: string): ReactNode {
  const words = query.trim().split(/\s+/).filter(Boolean)
  if (!text || words.length === 0) return text

  const pattern = words
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const testRe = new RegExp(`^(?:${pattern})$`, 'i')
  const parts = text.split(new RegExp(`(${pattern})`, 'gi'))

  return parts.map((part, i) =>
    testRe.test(part) ? (
      <mark
        key={i}
        style={{
          background: 'rgba(0,212,255,0.28)',
          borderRadius: 2,
          color: 'inherit',
          padding: '0 1px',
        }}
      >
        {part}
      </mark>
    ) : (
      part
    ),
  )
}
