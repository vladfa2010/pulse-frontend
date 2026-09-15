/**
 * PULSE — Карточка ad-hoc проверки / проверенной новости для каруселей
 *
 * Порт карточки из мокапа de3adad: иконка типа (+ замок у частных),
 * вердикт-бейдж со score (или пульсирующий «Проверяется»), заголовок,
 * сниппет, дата + достоверность.
 */

import { Link2, FileText, Image as ImageIcon, Newspaper, Lock, ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react'
import type { FactCheckListItem } from '@/types/factCheck'
import { INPUT_TYPE_LABELS, verdictColor, formatFactCheckDate } from '@/lib/factCheckInput'

interface Props {
  item: FactCheckListItem
  /** Только для «Моих проверок»: все ad-hoc проверки частные → замок на каждой */
  showLock?: boolean
  onClick: () => void
}

function TypeIcon({ item }: { item: FactCheckListItem }) {
  const size = 13
  if (item.kind === 'news') return <Newspaper size={size} />
  switch (item.input_type) {
    case 'url':
      return <Link2 size={size} />
    case 'image':
      return <ImageIcon size={size} />
    case 'file':
      return <FileText size={size} />
    default:
      return <FileText size={size} />
  }
}

function isChecking(item: FactCheckListItem): boolean {
  return item.status === 'queued' || item.status === 'in_progress'
}

export function FactCheckRequestCard({ item, showLock = false, onClick }: Props) {
  const label = item.result?.assessment?.credibility_label
  const score = item.result?.assessment?.credibility_score
  const color = verdictColor(label, score)

  const VerdictIcon =
    label === 'Высокая' ? ShieldCheck : label === 'Критическая' ? ShieldOff : ShieldAlert

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-[280px] text-left rounded-2xl p-4 flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:brightness-125 snap-start"
      style={{
        background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
          <TypeIcon item={item} />
          {item.kind === 'news' ? 'Новость' : INPUT_TYPE_LABELS[item.input_type || 'text']}
          {showLock && <Lock size={11} aria-label="Частная проверка" />}
        </span>

        {isChecking(item) ? (
          <span
            className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
            style={{ color: '#93C5FD', background: 'rgba(59,130,246,0.12)' }}
          >
            <span className="factcheck-pulse-dot" />
            Проверяется
          </span>
        ) : item.result?.assessment ? (
          <span
            className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
            style={{ color, background: `${color}1F` }}
          >
            <VerdictIcon size={12} />
            {score}/100
          </span>
        ) : null}
      </div>

      <p
        className="text-sm font-medium leading-snug mb-1.5"
        style={{
          color: '#FFFFFF',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: '2.6em',
        }}
      >
        {item.title}
      </p>

      {item.snippet && (
        <p
          className="text-xs leading-relaxed mb-3"
          style={{
            color: '#9CA3AF',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.snippet}
        </p>
      )}

      <div
        className="flex items-center justify-between text-xs mt-auto pt-1"
        style={{ color: '#6B7280' }}
      >
        <span>{formatFactCheckDate(item.created_at)}</span>
        {label && (
          <span style={{ color }}>
            {label}
          </span>
        )}
      </div>
    </button>
  )
}
