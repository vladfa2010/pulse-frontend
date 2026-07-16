import { ExternalLink } from 'lucide-react'
import type { FactCheckSourceV4 } from '@/types/factCheck'

interface Props {
  source: FactCheckSourceV4
  index: number
}

const ENGINE_CONFIG: Record<string, { icon: string; label: string; bg: string; text: string; border: string }> = {
  kimi: {
    icon: '🤖',
    label: 'Kimi',
    bg: 'bg-blue-950/30',
    text: 'text-blue-400',
    border: 'border-blue-900/30',
  },
  yandex_ru: {
    icon: '🔍',
    label: 'Yandex RU',
    bg: 'bg-yellow-950/30',
    text: 'text-yellow-400',
    border: 'border-yellow-900/30',
  },
  yandex_com: {
    icon: '🌐',
    label: 'Yandex COM',
    bg: 'bg-orange-950/30',
    text: 'text-orange-400',
    border: 'border-orange-900/30',
  },
  // Legacy fallback для ранее сохранённых результатов
  yandex: {
    icon: '🔍',
    label: 'Yandex',
    bg: 'bg-yellow-950/30',
    text: 'text-yellow-400',
    border: 'border-yellow-900/30',
  },
}

export function SourceCard({ source, index }: Props) {
  const engineCfg = source.engine ? ENGINE_CONFIG[source.engine] : null

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
        <div className="text-xs text-gray-500 flex items-center gap-2 mt-1 flex-wrap">
          <span>{source.site || 'Источник'}</span>
          {source.date && (
            <>
              <span>·</span>
              <span>{source.date}</span>
            </>
          )}
          {engineCfg && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${engineCfg.bg} ${engineCfg.text} ${engineCfg.border}`}
            >
              <span>{engineCfg.icon}</span>
              <span>{engineCfg.label}</span>
            </span>
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
