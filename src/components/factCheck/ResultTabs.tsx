import { useState, useMemo } from 'react'
import { SourceCard } from './SourceCard'
import { AssessmentPanel } from './AssessmentPanel'
import { renderMarkdown } from '@/lib/markdown'
import type { FactCheckResultV4, FactCheckSourceV4 } from '@/types/factCheck'

interface Props {
  result: FactCheckResultV4
}

type EngineFilter = 'all' | 'kimi' | 'yandex_ru' | 'yandex_com' | 'serper_ru' | 'serper_en'

type NormalizedEngine = Exclude<EngineFilter, 'all'>

function normalizeEngine(engine?: string): NormalizedEngine | undefined {
  if (engine === 'kimi') return 'kimi'
  if (engine === 'yandex_com') return 'yandex_com'
  if (engine === 'serper_ru') return 'serper_ru'
  if (engine === 'serper_en') return 'serper_en'
  // legacy 'yandex' и 'yandex_ru' попадают в RU
  if (engine === 'yandex' || engine === 'yandex_ru') return 'yandex_ru'
  return undefined
}

const ENGINE_LABELS: Record<NormalizedEngine, string> = {
  kimi: 'Kimi',
  yandex_ru: 'Yandex RU',
  yandex_com: 'Yandex COM',
  serper_ru: 'Serper RU',
  serper_en: 'Serper EN',
}

const ENGINE_ICONS: Record<NormalizedEngine, string> = {
  kimi: '🤖',
  yandex_ru: '🔍',
  yandex_com: '🌐',
  serper_ru: '🇷🇺',
  serper_en: '🇺🇸',
}

export function ResultTabs({ result }: Props) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'sources' | 'assessment'>('analysis')
  const [filter, setFilter] = useState<EngineFilter>('all')

  const sources = result.sources || []
  const normalizedSources = useMemo(
    () =>
      sources.map((s) => ({ ...s, engine: normalizeEngine(s.engine) } as FactCheckSourceV4)),
    [sources]
  )

  const byEngine = useMemo(() => {
    const map: Record<NormalizedEngine, FactCheckSourceV4[]> = {
      kimi: [],
      yandex_ru: [],
      yandex_com: [],
      serper_ru: [],
      serper_en: [],
    }
    for (const s of normalizedSources) {
      const engine = normalizeEngine(s.engine)
      if (engine) map[engine].push(s)
    }
    return map
  }, [normalizedSources])

  const engineErrors = useMemo(() => {
    const map: Partial<Record<NormalizedEngine, string>> = {}
    for (const e of result.engines || []) {
      const key = normalizeEngine(e.engine)
      if (key && e.status === 'error') {
        map[key] = e.error || 'Ошибка API'
      }
    }
    return map
  }, [result.engines])

  const filteredSources = useMemo<FactCheckSourceV4[]>(() => {
    if (filter === 'all') return normalizedSources
    return byEngine[filter]
  }, [filter, normalizedSources, byEngine])

  return (
    <div className="mt-4">
      {/* Табы */}
      <div className="flex gap-1 border-b border-[#1a1a1a] mb-3">
        {[
          { key: 'analysis', label: 'Анализ' },
          { key: 'sources', label: `Источники (${sources.length})` },
          { key: 'assessment', label: 'Оценка' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'text-[#00D4FF] border-[#00D4FF]'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Контент */}
      {activeTab === 'analysis' && (
        <div
          className="prose prose-invert prose-sm max-w-none text-gray-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(result.analysis) }}
        />
      )}

      {activeTab === 'sources' && (
        <div className="space-y-3">
          {(Object.keys(ENGINE_LABELS) as NormalizedEngine[]).map((key) =>
            engineErrors[key] ? (
              <div
                key={`err-${key}`}
                className="p-2 rounded bg-red-950/20 border border-red-900/30 text-xs text-red-400"
              >
                ⚠️ {ENGINE_LABELS[key]}: {engineErrors[key]}
              </div>
            ) : null
          )}

          {(Object.keys(ENGINE_LABELS) as NormalizedEngine[]).map((key) =>
            !engineErrors[key] && byEngine[key].length === 0 ? (
              <div
                key={`warn-${key}`}
                className="p-2 rounded bg-yellow-950/20 border border-yellow-900/30 text-xs text-yellow-400"
              >
                ⚠️ {ENGINE_LABELS[key]} не дал результатов для этой темы.
              </div>
            ) : null
          )}

          <div className="flex flex-wrap gap-2">
            <FilterButton
              label={`Все (${normalizedSources.length})`}
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            {(Object.keys(ENGINE_LABELS) as NormalizedEngine[]).map((key) => (
              <FilterButton
                key={key}
                label={`${ENGINE_ICONS[key]} ${ENGINE_LABELS[key]} (${byEngine[key].length})`}
                active={filter === key}
                disabled={byEngine[key].length === 0}
                onClick={() => setFilter(key)}
              />
            ))}
          </div>

          <div className="space-y-2">
            {filteredSources.map((s, i) => (
              <SourceCard key={`${s.url}-${i}`} source={s} index={i + 1} />
            ))}
            {filteredSources.length === 0 && (
              <p className="text-sm text-gray-500">Источники не найдены.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'assessment' && <AssessmentPanel assessment={result.assessment} />}
    </div>
  )
}

function FilterButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-[#00D4FF22] text-[#00D4FF] border border-[#00D4FF40]'
          : 'bg-[#1a1a1a] text-gray-400 border border-[#222] hover:text-gray-300'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  )
}
