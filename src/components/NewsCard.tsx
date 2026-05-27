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
    borderHover: 'rgba(52, 211, 153, 0.30)',
    icon: TrendingUp,
    label: 'Позитив',
    color: '#34D399',
  },
  negative: {
    bg: 'rgba(239, 68, 68, 0.03)',
    border: 'rgba(239, 68, 68, 0.12)',
    borderHover: 'rgba(239, 68, 68, 0.30)',
    icon: TrendingDown,
    label: 'Негатив',
    color: '#EF4444',
  },
  neutral: {
    bg: 'rgba(255, 255, 255, 0.02)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(255, 255, 255, 0.20)',
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

  const published = new Date(article.published_at)
  const minutes = Math.floor((Date.now() - published.getTime()) / 60000)
  const timeAgo =
    minutes < 60 ? `${minutes} мин` :
    minutes < 1440 ? `${Math.floor(minutes / 60)} ч` :
    `${Math.floor(minutes / 1440)} д`

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: easeOutExpo }}
      className="flex-shrink-0 w-[220px] rounded-xl overflow-hidden cursor-pointer group relative
                 transition-all duration-200 hover:scale-[1.02]"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = config.borderHover }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = config.border }}
    >
      <div className="p-4">
        {/* Top: tag + sentiment */}
        <div className="flex items-center justify-between mb-2">
          {tagLabel && (
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#00D4FF' }}>
              {tagLabel}
            </span>
          )}
          <div className="flex items-center gap-1 ml-auto px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${config.color}12` }}>
            <SentimentIcon size={10} style={{ color: config.color }} />
            <span className="text-[10px] font-medium" style={{ color: config.color }}>{config.label}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px w-full mb-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

        {/* Title */}
        <h3 className="text-[13px] font-semibold leading-[1.4] line-clamp-3 mb-3 min-h-[54px]">
          {article.title_ru}
        </h3>

        {/* Bottom meta */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
            <span className="truncate max-w-[80px]">{article.source}</span>
            <span>·</span>
            <span>{timeAgo}</span>
          </div>
          {(article.source_count || 1) > 1 && (
            <span className="text-[9px] px-1 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,212,255,0.08)', color: '#00D4FF' }}>
              +{article.source_count! - 1}
            </span>
          )}
        </div>
      </div>
    </motion.article>
  )
}
