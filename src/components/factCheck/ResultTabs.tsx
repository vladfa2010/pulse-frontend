import { useState } from 'react'
import { SourceCard } from './SourceCard'
import { AssessmentPanel } from './AssessmentPanel'
import { renderMarkdown } from '@/lib/markdown'
import type { FactCheckResultV4 } from '@/types/factCheck'

interface Props {
  result: FactCheckResultV4
}

export function ResultTabs({ result }: Props) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'sources' | 'assessment'>('analysis')

  return (
    <div className="mt-4">
      {/* Табы */}
      <div className="flex gap-1 border-b border-[#1a1a1a] mb-3">
        {[
          { key: 'analysis', label: 'Анализ' },
          { key: 'sources', label: `Источники (${result.sources.length})` },
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
        <div className="space-y-2">
          {result.sources.map((s, i) => (
            <SourceCard key={i} source={s} index={i + 1} />
          ))}
          {result.sources.length === 0 && (
            <p className="text-sm text-gray-500">Источники не найдены.</p>
          )}
        </div>
      )}

      {activeTab === 'assessment' && <AssessmentPanel assessment={result.assessment} />}
    </div>
  )
}
