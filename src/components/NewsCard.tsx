import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface TagImpact {
  tag: string
  impact: 'positive' | 'negative' | 'neutral'
  reasoning: string
}

interface NewsArticle {
  id: string
  title_ru: string
  summary_ru?: string
  source: string
  published_at: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  sentiment_score?: number
  sentiment_source?: string
  tag?: string
  source_count?: number
  all_sources?: string[]
  tag_impact?: TagImpact[]
}

interface NewsCardProps {
  article: NewsArticle
  index?: number
  tagLabel?: string
  variant?: 'portrait' | 'landscape'
}

const sentimentConfig = {
  positive: {
    // Liquid glass: зелёное свечение снизу
    glassBg: 'linear-gradient(180deg, rgba(52,211,153,0.06) 0%, rgba(52,211,153,0.02) 100%)',
    glassBorder: 'rgba(52, 211, 153, 0.15)',
    glassBorderHover: 'rgba(52, 211, 153, 0.35)',
    glowShadow: '0 4px 20px -4px rgba(52, 211, 153, 0.15), inset 0 -1px 0 0 rgba(52, 211, 153, 0.1)',
    glowShadowHover: '0 8px 30px -4px rgba(52, 211, 153, 0.25), inset 0 -1px 0 0 rgba(52, 211, 153, 0.2)',
    icon: TrendingUp,
    label: 'Позитив',
    color: '#34D399',
    badgeBg: 'rgba(52, 211, 153, 0.12)',
  },
  negative: {
    // Liquid glass: красное свечение снизу
    glassBg: 'linear-gradient(180deg, rgba(239,68,68,0.06) 0%, rgba(239,68,68,0.02) 100%)',
    glassBorder: 'rgba(239, 68, 68, 0.15)',
    glassBorderHover: 'rgba(239, 68, 68, 0.35)',
    glowShadow: '0 4px 20px -4px rgba(239, 68, 68, 0.15), inset 0 -1px 0 0 rgba(239, 68, 68, 0.1)',
    glowShadowHover: '0 8px 30px -4px rgba(239, 68, 68, 0.25), inset 0 -1px 0 0 rgba(239, 68, 68, 0.2)',
    icon: TrendingDown,
    label: 'Негатив',
    color: '#EF4444',
    badgeBg: 'rgba(239, 68, 68, 0.12)',
  },
  neutral: {
    // Liquid glass: нейтральное, без цветного свечения
    glassBg: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    glassBorderHover: 'rgba(255, 255, 255, 0.20)',
    glowShadow: '0 2px 12px -4px rgba(0, 0, 0, 0.3)',
    glowShadowHover: '0 4px 20px -4px rgba(0, 0, 0, 0.4)',
    icon: Minus,
    label: 'Нейтрально',
    color: '#9CA3AF',
    badgeBg: 'rgba(156, 163, 175, 0.10)',
  },
}

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

export default function NewsCard({ article, index = 0, tagLabel, variant = 'portrait' }: NewsCardProps) {
  const sentiment = article.sentiment || 'neutral'
  const config = sentimentConfig[sentiment]
  const SentimentIcon = config.icon

  const published = new Date(article.published_at)
  const minutes = Math.floor((Date.now() - published.getTime()) / 60000)
  const timeAgo =
    minutes < 60 ? `${minutes} мин` :
    minutes < 1440 ? `${Math.floor(minutes / 60)} ч` :
    `${Math.floor(minutes / 1440)} д`

  // ─── 16:9 Landscape variant (wide card) ─────────────────────────────
  if (variant === 'landscape') {
    return (
      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: index * 0.06, ease: easeOutExpo }}
        className="flex-shrink-0 w-[85vw] sm:w-[425px] h-[225px] rounded-xl overflow-hidden cursor-pointer group relative
                   transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 gpu-layer"
        style={{
          background: config.glassBg,
          border: `1px solid ${config.glassBorder}`,
          boxShadow: config.glowShadow,
          backdropFilter: 'blur(12px) saturate(180%)',
          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = config.glassBorderHover
          e.currentTarget.style.boxShadow = config.glowShadowHover
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = config.glassBorder
          e.currentTarget.style.boxShadow = config.glowShadow
        }}
      >
        {/* Liquid glass highlight line at top */}
        <div
          className="absolute top-0 left-4 right-4 h-px opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${config.color}, transparent)` }}
        />

        <div className="p-4 h-full flex flex-col">
          {/* Row: tag label + sentiment badge + time (horizontally) */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {tagLabel && (
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#00D4FF' }}>
                  {tagLabel}
                </span>
              )}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full backdrop-blur-sm" style={{ backgroundColor: config.badgeBg }}>
                <SentimentIcon size={10} style={{ color: config.color }} />
                <span className="text-[10px] font-semibold" style={{ color: config.color }}>{config.label}</span>
                {article.sentiment_score !== undefined && article.sentiment_score !== null && (
                  <span className="text-[10px] font-bold ml-0.5" style={{ color: config.color }}>
                    {article.sentiment_score > 0 ? '+' : ''}{article.sentiment_score}
                  </span>
                )}
              </div>
            </div>
            <span className="text-[10px] text-text-muted">{timeAgo}</span>
          </div>

          {/* Divider */}
          <div className="h-px w-full mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

          {/* Title — wider, more text fits */}
          <h3 className="text-[13px] font-semibold leading-[1.4] line-clamp-3 mb-2 flex-1">
            {article.title_ru}
          </h3>

          {/* Bottom row: tag impact pills + source + multi-source count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Tag Impact pills (compact) */}
              {article.tag_impact && article.tag_impact.slice(0, 2).map((ti) => {
                const impactColor =
                  ti.impact === 'positive' ? '#34D399' :
                  ti.impact === 'negative' ? '#EF4444' : '#9CA3AF'
                return (
                  <span
                    key={ti.tag}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                    style={{
                      backgroundColor: `${impactColor}15`,
                      color: impactColor,
                      border: `1px solid ${impactColor}30`,
                    }}
                    title={ti.reasoning || undefined}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: impactColor }} />
                    {ti.tag}
                  </span>
                )
              })}
              {article.tag_impact && article.tag_impact.length > 2 && (
                <span className="text-[9px] text-text-muted px-1">+{article.tag_impact.length - 2}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-muted truncate max-w-[80px]">{article.source}</span>
              {(article.source_count || 1) > 1 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,212,255,0.08)', color: '#00D4FF' }}>
                  +{article.source_count! - 1}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom glow line */}
        {sentiment !== 'neutral' && (
          <div
            className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full opacity-40 group-hover:opacity-70 transition-opacity"
            style={{ background: `linear-gradient(90deg, transparent, ${config.color}, transparent)` }}
          />
        )}
      </motion.article>
    )
  }

  // ─── Portrait variant (default, tall card) ──────────────────────────
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: easeOutExpo }}
      className="flex-shrink-0 w-[75vw] sm:w-[275px] rounded-xl overflow-hidden cursor-pointer group relative
                 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 gpu-layer"
      style={{
        background: config.glassBg,
        border: `1px solid ${config.glassBorder}`,
        boxShadow: config.glowShadow,
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = config.glassBorderHover
        e.currentTarget.style.boxShadow = config.glowShadowHover
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = config.glassBorder
        e.currentTarget.style.boxShadow = config.glowShadow
      }}
    >
      {/* Liquid glass highlight line at top */}
      <div
        className="absolute top-0 left-4 right-4 h-px opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
        }}
      />

      <div className="p-4">
        {/* Top: tag + sentiment badge */}
        <div className="flex items-center justify-between mb-2">
          {tagLabel && (
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#00D4FF' }}>
              {tagLabel}
            </span>
          )}
          <div
            className="flex items-center gap-1 ml-auto px-2 py-0.5 rounded-full backdrop-blur-sm"
            style={{ backgroundColor: config.badgeBg }}
          >
            <SentimentIcon size={10} style={{ color: config.color }} />
            <span className="text-[10px] font-semibold" style={{ color: config.color }}>
              {config.label}
            </span>
            {article.sentiment_score !== undefined && article.sentiment_score !== null && (
              <span className="text-[10px] font-bold ml-0.5" style={{ color: config.color }}>
                {article.sentiment_score > 0 ? '+' : ''}{article.sentiment_score}
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px w-full mb-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

        {/* Title */}
        <h3 className="text-[13px] font-semibold leading-[1.4] line-clamp-3 mb-2 min-h-[54px]">
          {article.title_ru}
        </h3>

        {/* Tag Impact — цветные pills для каждого тега */}
        {article.tag_impact && article.tag_impact.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {article.tag_impact.slice(0, 3).map((ti) => {
              const impactColor =
                ti.impact === 'positive' ? '#34D399' :
                ti.impact === 'negative' ? '#EF4444' : '#9CA3AF'
              return (
                <span
                  key={ti.tag}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                  style={{
                    backgroundColor: `${impactColor}15`,
                    color: impactColor,
                    border: `1px solid ${impactColor}30`,
                  }}
                  title={ti.reasoning || undefined}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: impactColor }}
                  />
                  {ti.tag}
                </span>
              )
            })}
            {article.tag_impact.length > 3 && (
              <span className="text-[9px] text-text-muted px-1">+{article.tag_impact.length - 3}</span>
            )}
          </div>
        )}

        {/* Bottom meta */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
            <span className="truncate max-w-[80px]">{article.source}</span>
            <span>·</span>
            <span>{timeAgo}</span>
          </div>
          {(article.source_count || 1) > 1 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,212,255,0.08)', color: '#00D4FF' }}>
              +{article.source_count! - 1}
            </span>
          )}
        </div>

        {/* Bottom glow line — цветное свечение в зависимости от sentiment */}
        {sentiment !== 'neutral' && (
          <div
            className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full opacity-40 group-hover:opacity-70 transition-opacity"
            style={{
              background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
            }}
          />
        )}
      </div>
    </motion.article>
  )
}
