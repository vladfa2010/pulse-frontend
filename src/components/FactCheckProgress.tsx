import { Loader2, Check } from 'lucide-react'

interface StageConfig {
  icon: string
  label: string
}

const STAGE_CONFIG: Record<string, StageConfig> = {
  queries: { icon: '🔍', label: 'Генерация запросов' },
  search: { icon: '🌐', label: 'Поиск источников' },
  fetch: { icon: '📄', label: 'Чтение страниц' },
  claims: { icon: '⚖️', label: 'Анализ утверждений' },
  verdict: { icon: '✅', label: 'Формирование вердикта' },
}

interface Props {
  stages: Array<{ stage: string; payload: any }>
}

export function FactCheckProgress({ stages }: Props) {
  const allStages = ['queries', 'search', 'fetch', 'claims', 'verdict']

  const getStatus = (key: string): 'pending' | 'active' | 'done' => {
    const stageEvents = stages.filter((s) => s.stage === key)
    if (stageEvents.length === 0) return 'pending'
    const last = stageEvents[stageEvents.length - 1]
    return last.payload?.status === 'done' ? 'done' : 'active'
  }

  const getDetails = (key: string): string => {
    const stageEvents = stages.filter((s) => s.stage === key)
    const last = stageEvents[stageEvents.length - 1]
    if (!last || last.payload?.status !== 'done') return ''

    if (key === 'queries' && last.payload.claims !== undefined) return `${last.payload.claims} claims`
    if (key === 'search' && last.payload.sources !== undefined) return `${last.payload.sources} источников`
    if (key === 'fetch' && last.payload.fetched !== undefined) return `${last.payload.fetched} страниц`
    if (key === 'claims' && Array.isArray(last.payload.claims)) return `${last.payload.claims.length} вердиктов`
    return ''
  }

  return (
    <div className="space-y-1.5">
      {allStages.map((key) => {
        const status = getStatus(key)
        const config = STAGE_CONFIG[key]
        const details = getDetails(key)

        return (
          <div
            key={key}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
              status === 'done'
                ? 'bg-green-950/30 border-green-900/50'
                : status === 'active'
                ? 'bg-blue-950/30 border-blue-900/50 animate-pulse'
                : 'bg-gray-950/30 border-gray-900/30 opacity-40'
            }`}
          >
            <span className="text-base">{config.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-300">{config.label}</div>
              {details && <div className="text-[10px] text-gray-500">{details}</div>}
            </div>
            {status === 'done' && <Check size={14} className="text-green-400 shrink-0" />}
            {status === 'active' && <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />}
          </div>
        )
      })}
    </div>
  )
}
