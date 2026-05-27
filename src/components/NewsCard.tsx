import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface NewsArticle {
  id: string
  title_ru: string
  source: string
  published_at: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  tag?: string
  source_count?: number
  all_sources?: string[]
}

interface NewsCardProps {
  article: NewsArticle
  index?: number
  tagLabel?: string
}

const sentimentConfig = {
  positive: {
    bg: 'rgba(52, 211, 153, 0.03)',
    border: 'rgba(52, 211, 153, 0.12)',
    borderHover: 'rgba(52, 211, 153, 0.25)',
    icon: TrendingUp,
    label: 'Позитив',
    color: '#34D399',
  },
  negative: {
    bg: 'rgba(239, 68, 68, 0.03)',
    border: 'rgba(239, 68, 68, 0.12)',
    borderHover: 'rgba(239, 68, 68, 0.25)',
    icon: TrendingDown,
    label: 'Негатив',
    color: '#EF4444',
  },
  neutral: {
    bg: 'rgba(255, 255, 255, 0.02)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(255, 255, 255, 0.18)',
    icon: Minus,
    label: 'Нейтрально',
    color: '#9CA3AF',
  },
}

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

export default function NewsCard({ article, index = 0, tagLabel }: NewsCardProps) {
  const sentiment = article.sentiment || 'neutral'
  const config = sentimentConfig[sentiment]
  const SentimentIcon = config.icon

  // Minutes ago
  const published = new Date(article.published_at)
  const minutes = Math.floor((Date.now() - published.getTime()) / 60000)

  return (
    <motion.article
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: easeOutExpo }}
      className="flex-shrink-0 w-[280px] md:w-[300px] lg:w-[340px] rounded-2xl overflow-hidden cursor-pointer group relative snap-start"
      style={{
        background: config.bg,
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        border: `1px solid ${config.border}`,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = config.borderHover
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = config.border
      }}
    >
      <div className="p-5">
        {/* Top row: tag label + sentiment */}
        <div className="flex items-center justify-between mb-3">
          {tagLabel && (
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: '#00D4FF' }}
            >
              {tagLabel}
            </span>
          )}
          <div
            className="flex items-center gap-1.5 ml-auto px-2 py-1 rounded-full"
            style={{ backgroundColor: `${config.color}10` }}
          >
            <SentimentIcon size={12} style={{ color: config.color }} />
            <span className="text-[11px] font-medium" style={{ color: config.color }}>
              {config.label}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px w-full mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

        {/* Title */}
        <h3 className="text-[15px] font-semibold leading-snug line-clamp-3 mb-3">
          {article.title_ru}
        </h3>

        {/* Meta */}
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span>{article.source}</span>
          <span>·</span>
          <span>{minutes < 60 ? `${minutes} мин` : minutes < 1440 ? `${Math.floor(minutes / 60)} ч` : `${Math.floor(minutes / 1440)} д`} назад</span>
        </div>

        {/* Also published by */}
        {(article.source_count || 1) > 1 && article.all_sources && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted">📡 Также:</span>
            <span className="text-[10px]" style={{ color: '#00D4FF' }}>
              {article.all_sources.filter(s => s !== article.source).join(', ')}
            </span>
            <span className="text-[10px] text-text-muted">({article.source_count} источника)</span>
          </div>
        )}
      </div>
    </motion.article>
  )
}
