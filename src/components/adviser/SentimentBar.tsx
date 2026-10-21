import type { CSSProperties } from 'react'

/**
 * ТЗ-182 v15: 3-сегментный sentiment-bar для карточек клиентов.
 * Новый компонент (готового 3-сегментного нет) — цвета по образцу
 * sentiment-бейдж NewsCard.tsx: pos #34D399 / neg #EF4444 / neu #9CA3AF.
 */

export interface SentimentMix {
  pos: number
  neg: number
  neu: number
}

const SEGMENTS: { key: keyof SentimentMix; color: string; label: string }[] = [
  { key: 'pos', color: '#34D399', label: 'позитив' },
  { key: 'neg', color: '#EF4444', label: 'негатив' },
  { key: 'neu', color: '#9CA3AF', label: 'нейтрально' },
]

const BAR_STYLE: CSSProperties = {
  height: 6,
  borderRadius: 999,
  overflow: 'hidden',
  display: 'flex',
  backgroundColor: 'rgba(255,255,255,0.06)',
}

export default function SentimentBar({ mix }: { mix: Partial<SentimentMix> | null | undefined }) {
  const pos = Math.max(0, mix?.pos ?? 0)
  const neg = Math.max(0, mix?.neg ?? 0)
  const neu = Math.max(0, mix?.neu ?? 0)
  const total = pos + neg + neu

  if (!total) {
    return (
      <div title="Sentiment: данных пока нет">
        <div style={BAR_STYLE}>
          <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.08)' }} />
        </div>
      </div>
    )
  }

  const title = SEGMENTS.map(s => `${s.label} ${Math.round((mix?.[s.key] ?? 0) / total * 100)}%`).join(' · ')

  return (
    <div title={`Sentiment за 12 часов: ${title}`}>
      <div style={BAR_STYLE}>
        {SEGMENTS.map(s => {
          const value = mix?.[s.key] ?? 0
          if (!value) return null
          return (
            <div
              key={s.key}
              style={{
                width: `${(value / total) * 100}%`,
                backgroundColor: s.color,
                opacity: 0.85,
                transition: 'width 0.4s ease',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
