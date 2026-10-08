// React 19 пересоздаёт DOM контейнера с dangerouslySetInnerHTML при КАЖДОМ
// ререндере родителя — даже если строка html не изменилась (проверено
// эмпирически: чужой DOM-узел внутри контейнера после ререндера отсоединён
// от документа). Портальные монтирования (chart-блоки, ТЗ-143/144) живут
// внутри узлов из innerHTML — при пересоздании портал молча умирает вместе
// со старым узлом: на странице остаётся пустой div.chart-block.
//
// memo-бailout держит DOM стабильным: пересоздание только при реальном
// изменении html (или style/className). Эффекты-навески порталов завязаны
// на те же deps (html), поэтому после смены html пересборка идёт на свежих
// узлах.
//
// Компаратор со shallow style-compare: инлайн-объект style у родителя —
// новая ссылка каждый ререндер, дефолтный shallow-compare memo проваливался
// бы бессмысленно.

import { memo } from 'react'
import { resolveMediaHtml } from '@/lib/media'

export interface SafeHtmlContentProps {
  html: string
  className?: string
  style?: React.CSSProperties
  innerRef?: React.Ref<HTMLDivElement>
}

function sameStyle(a?: React.CSSProperties, b?: React.CSSProperties): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const ka = Object.keys(a) as (keyof React.CSSProperties)[]
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every(k => a[k] === b[k])
}

export const SafeHtmlContent = memo(
  function SafeHtmlContent({ html, className, style, innerRef }: SafeHtmlContentProps) {
    return (
      <div
        ref={innerRef}
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: resolveMediaHtml(html) }}
      />
    )
  },
  (prev, next) =>
    prev.html === next.html &&
    prev.className === next.className &&
    sameStyle(prev.style, next.style) &&
    prev.innerRef === next.innerRef,
)
