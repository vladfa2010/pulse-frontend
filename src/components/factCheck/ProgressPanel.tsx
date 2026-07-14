import { Loader2, Check } from 'lucide-react'

const STEPS = [
  { key: 'search', icon: '🔍', label: 'Поиск в интернете' },
  { key: 'analysis', icon: '📝', label: 'Анализ темы' },
  { key: 'sources', icon: '📎', label: 'Извлечение источников' },
  { key: 'assessment', icon: '⚖️', label: 'Оценка достоверности' },
]

interface Props {
  stages: Array<{ stage: string; payload: any }>
}

export function ProgressPanel({ stages }: Props) {
  const getStatus = (key: string): 'pending' | 'active' | 'done' => {
    const events = stages.filter((s) => s.stage === key)
    if (events.length === 0) return 'pending'
    const last = events[events.length - 1]
    return last.payload?.status === 'done' ? 'done' : 'active'
  }

  const getDetails = (key: string): string => {
    const events = stages.filter((s) => s.stage === key)
    const last = events[events.length - 1]
    if (!last || last.payload?.status !== 'done') return ''
    if (key === 'search' && last.payload.sources) return `${last.payload.sources} источников`
    if (key === 'analysis' && last.payload.preview) return last.payload.preview.slice(0, 60) + '...'
    if (key === 'sources' && last.payload.count) return `${last.payload.count} источников`
    if (key === 'assessment') return last.payload.credibility_label || ''
    return ''
  }

  return (
    <div className="space-y-2">
      {STEPS.map(({ key, icon, label }) => {
        const status = getStatus(key)
        const details = getDetails(key)
        return (
          <div
            key={key}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
              status === 'done'
                ? 'bg-green-950/20 border-green-900/30'
                : status === 'active'
                ? 'bg-blue-950/20 border-blue-900/30'
                : 'bg-gray-950/20 border-gray-900/20 opacity-40'
            }`}
          >
            <span className="text-base">{icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-300">{label}</div>
              {details && <div className="text-xs text-gray-500 truncate">{details}</div>}
            </div>
            {status === 'done' && <Check size={16} className="text-green-400 shrink-0" />}
            {status === 'active' && <Loader2 size={16} className="text-blue-400 animate-spin shrink-0" />}
          </div>
        )
      })}
    </div>
  )
}
