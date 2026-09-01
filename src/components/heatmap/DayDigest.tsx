import { DayStory } from './types'

interface DayDigestProps {
  date: string
  stories: DayStory[]
}

export default function DayDigest({ date, stories }: DayDigestProps) {
  if (stories.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <div className="text-sm font-medium text-text-primary mb-1">{date}</div>
        <div className="text-sm text-text-muted">Новостей нет</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-text-primary">{date}</div>
        <div className="text-xs text-text-muted">{stories.length} новостей</div>
      </div>
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {stories.map((story) => (
          <a
            key={story.id}
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
          >
            <div className="text-sm text-text-primary leading-snug mb-1">{story.title}</div>
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
              <span>{story.source}</span>
              <span>·</span>
              <SentimentBadge sentiment={story.sentiment} />
              {story.source_count > 1 && (
                <>
                  <span>·</span>
                  <span>источников: {story.source_count}</span>
                </>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const color = sentiment === 'positive'
    ? '#34D399'
    : sentiment === 'negative'
      ? '#F87171'
      : '#9CA3AF'
  return <span style={{ color }}>{sentiment || 'neutral'}</span>
}
