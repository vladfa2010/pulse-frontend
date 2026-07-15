import { useState, useMemo } from 'react'
import { SourceCard } from './SourceCard'
import { AssessmentPanel } from './AssessmentPanel'
import { renderMarkdown } from '@/lib/markdown'
import type { FactCheckResultV4, FactCheckSourceV4 } from '@/types/factCheck'

interface Props {
  result: FactCheckResultV4
}

type EngineFilter = 'all' | 'kimi' | 'yandex'

export function ResultTabs({ result }: Props) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'sources' | 'assessment'>('analysis')
  const [filter, setFilter] = useState<EngineFilter>('all')

  const sources = result.sources || []
  const kimiSources = sources.filter((s) => s.engine === 'kimi')
  const yandexSources = sources.filter((s) => s.engine === 'yandex')

  const yandexEngine = result.engines?.find((e) => e.engine === 'yandex')
  const yandexError = yandexEngine?.status === 'error' ? yandexEngine.error || 'Ошибка API' : null

  const filteredSources = useMemo<FactCheckSourceV4[]>(() => {
    if (filter === 'kimi') return kimiSources
    if (filter === 'yandex') return yandexSources
    return sources
  }, [filter, sources, kimiSources, yandexSources])

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
          {yandexError && (
            <div className="p-2 rounded bg-red-950/20 border border-red-900/30 text-xs text-red-400">
              ⚠️ Yandex Search: {yandexError}. Показаны источники от Kimi.
            </div>
          )}
          {!yandexError && yandexSources.length === 0 && (
            <div className="p-2 rounded bg-yellow-950/20 border border-yellow-900/30 text-xs text-yellow-400">
              ⚠️ Yandex Search не дал результатов для этой темы.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <FilterButton
              label={`Все (${sources.length})`}
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterButton
              label={`🤖 Kimi (${kimiSources.length})`}
              active={filter === 'kimi'}
              onClick={() => setFilter('kimi')}
            />
            <FilterButton
              label={`🔍 Yandex (${yandexSources.length})`}
              active={filter === 'yandex'}
              disabled={yandexSources.length === 0}
              onClick={() => setFilter('yandex')}
            />
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
