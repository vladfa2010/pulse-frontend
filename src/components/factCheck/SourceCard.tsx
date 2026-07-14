import { ExternalLink } from 'lucide-react'
import type { FactCheckSourceV4 } from '@/types/factCheck'

interface Props {
  source: FactCheckSourceV4
  index: number
}

export function SourceCard({ source, index }: Props) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 p-3 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a] hover:border-[#00D4FF]/30 transition-colors group"
    >
      <span className="text-xs font-mono text-gray-600 shrink-0 mt-0.5">
        {String(index).padStart(2, '0')}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-200 group-hover:text-[#00D4FF] truncate">
          {source.title || 'Без названия'}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
          <span>{source.site || 'Источник'}</span>
          {source.date && (
            <>
              <span>·</span>
              <span>{source.date}</span>
            </>
          )}
        </div>
        {source.url && (
          <div className="text-xs text-gray-600 truncate mt-0.5 flex items-center gap-1">
            <ExternalLink size={10} />
            {source.url}
          </div>
        )}
      </div>
    </a>
  )
}
