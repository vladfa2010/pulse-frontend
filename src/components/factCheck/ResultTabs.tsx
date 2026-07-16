import { useState, useMemo } from 'react'
import { SourceCard } from './SourceCard'
import { AssessmentPanel } from './AssessmentPanel'
import { renderMarkdown } from '@/lib/markdown'
import type { FactCheckResultV4, FactCheckSourceV4 } from '@/types/factCheck'

interface Props {
  result: FactCheckResultV4
}

type EngineFilter = 'all' | 'kimi' | 'yandex_ru' | 'yandex_com'

function normalizeEngine(engine?: string): 'kimi' | 'yandex_ru' | 'yandex_com' | undefined {
  if (engine === 'kimi') return 'kimi'
  if (engine === 'yandex_com') return 'yandex_com'
  // legacy 'yandex' и 'yandex_ru' попадают в RU
  if (engine === 'yandex' || engine === 'yandex_ru') return 'yandex_ru'
  return undefined
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

  const kimiSources = normalizedSources.filter((s) => s.engine === 'kimi')
  const yandexRuSources = normalizedSources.filter((s) => s.engine === 'yandex_ru')
  const yandexComSources = normalizedSources.filter((s) => s.engine === 'yandex_com')

  const yandexRuEngine = result.engines?.find((e) => e.engine === 'yandex_ru')
  const yandexComEngine = result.engines?.find((e) => e.engine === 'yandex_com')
  const yandexRuError = yandexRuEngine?.status === 'error' ? yandexRuEngine.error || 'Ошибка API' : null
  const yandexComError = yandexComEngine?.status === 'error' ? yandexComEngine.error || 'Ошибка API' : null

  const filteredSources = useMemo<FactCheckSourceV4[]>(() => {
    if (filter === 'kimi') return kimiSources
    if (filter === 'yandex_ru') return yandexRuSources
    if (filter === 'yandex_com') return yandexComSources
    return normalizedSources
  }, [filter, normalizedSources, kimiSources, yandexRuSources, yandexComSources])

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
          {yandexRuError && (
            <div className="p-2 rounded bg-red-950/20 border border-red-900/30 text-xs text-red-400">
              ⚠️ Yandex RU: {yandexRuError}
            </div>
          )}
          {yandexComError && (
            <div className="p-2 rounded bg-red-950/20 border border-red-900/30 text-xs text-red-400">
              ⚠️ Yandex COM: {yandexComError}
            </div>
          )}
          {!yandexRuError && yandexRuSources.length === 0 && (
            <div className="p-2 rounded bg-yellow-950/20 border border-yellow-900/30 text-xs text-yellow-400">
              ⚠️ Yandex RU не дал результатов для этой темы.
            </div>
          )}
          {!yandexComError && yandexComSources.length === 0 && (
            <div className="p-2 rounded bg-yellow-950/20 border border-yellow-900/30 text-xs text-yellow-400">
              ⚠️ Yandex COM не дал результатов для этой темы.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <FilterButton
              label={`Все (${normalizedSources.length})`}
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterButton
              label={`🤖 Kimi (${kimiSources.length})`}
              active={filter === 'kimi'}
              onClick={() => setFilter('kimi')}
            />
            <FilterButton
              label={`🔍 Yandex RU (${yandexRuSources.length})`}
              active={filter === 'yandex_ru'}
              disabled={yandexRuSources.length === 0}
              onClick={() => setFilter('yandex_ru')}
            />
            <FilterButton
              label={`🌐 Yandex COM (${yandexComSources.length})`}
              active={filter === 'yandex_com'}
              disabled={yandexComSources.length === 0}
              onClick={() => setFilter('yandex_com')}
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
