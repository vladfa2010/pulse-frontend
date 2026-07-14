import type { AssessmentV4 } from '@/types/factCheck'

const LABEL_COLORS: Record<string, string> = {
  'Высокая': 'text-green-400 bg-green-950/30 border-green-900/30',
  'Средняя': 'text-yellow-400 bg-yellow-950/30 border-yellow-900/30',
  'Низкая': 'text-orange-400 bg-orange-950/30 border-orange-900/30',
  'Критическая': 'text-red-400 bg-red-950/30 border-red-900/30',
}

interface Props {
  assessment: AssessmentV4
}

export function AssessmentPanel({ assessment }: Props) {
  const {
    credibility_score,
    credibility_label,
    tone,
    facts_verified,
    has_opinion_bias,
    missing_context,
    manipulation_risks,
    verdict,
  } = assessment

  return (
    <div className="space-y-4">
      {/* Score + Label */}
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#1a1a1a" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="#00D4FF"
              strokeWidth="3"
              strokeDasharray={`${credibility_score} ${100 - credibility_score}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
            {credibility_score}
          </div>
        </div>
        <div>
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${
              LABEL_COLORS[credibility_label] || ''
            }`}
          >
            {credibility_label}
          </span>
          <div className="text-xs text-gray-500 mt-1">Достоверность</div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Тональность" value={tone} />
        <MetricCard label="Факты проверены" value={facts_verified} />
        <MetricCard label="Opinion bias" value={has_opinion_bias ? 'Да' : 'Нет'} />
      </div>

      {/* Missing context */}
      {missing_context && (
        <div className="p-3 rounded-lg bg-yellow-950/20 border border-yellow-900/30">
          <div className="text-xs text-yellow-400 font-medium mb-1">Упущенный контекст</div>
          <div className="text-sm text-gray-400">{missing_context}</div>
        </div>
      )}

      {/* Manipulation risks */}
      {manipulation_risks && (
        <div className="p-3 rounded-lg bg-red-950/20 border border-red-900/30">
          <div className="text-xs text-red-400 font-medium mb-1">Риски манипуляции</div>
          <div className="text-sm text-gray-400">{manipulation_risks}</div>
        </div>
      )}

      {/* Verdict */}
      <div className="p-4 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a]">
        <div className="text-xs text-gray-500 mb-2">Вердикт</div>
        <div className="text-sm text-gray-200 leading-relaxed">{verdict}</div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-2.5 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a]">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-200 mt-0.5">{value}</div>
    </div>
  )
}
