import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { createPortal } from 'react-dom'
import { X, ExternalLink, Clock, Globe, Key, Brain, Building2, MapPin, Shield, Check, Link2, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface TagImpact {
  tag: string
  score: number
  reasoning: string
}

interface NewsDetail {
  id: string
  title_ru: string
  summary_ru: string
  title_original: string | null
  lang_original: string | null
  source: string
  url: string
  published_at: string
  sentiment: 'positive' | 'negative' | 'neutral'
  sentiment_score: number
  sentiment_reasoning: string
  sentiment_source: string
  matched_tags: string[]
  tag_impact: TagImpact[]
  is_political: boolean
  article_type: 'micro' | 'macro'
  source_count: number
  all_sources: string[]
}

interface Props {
  newsId: string
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}

export default function NewsDetailModal({ newsId, onClose, onPrev, onNext }: Props) {
  const [article, setArticle] = useState<NewsDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lang, setLang] = useState<'ru' | 'en'>('ru')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get(`/news/${newsId}`)
      setArticle(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load article')
    } finally {
      setLoading(false)
    }
  }, [newsId])

  useEffect(() => { load() }, [load])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && onNext) onNext()
      if (e.key === 'ArrowLeft' && onPrev) onPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onPrev, onNext])

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleCopyLink = async () => {
    if (!article) return
    try {
      await navigator.clipboard.writeText(article.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback silently
    }
  }

  const sentimentColor = article?.sentiment === 'positive' ? '#34D399' : article?.sentiment === 'negative' ? '#EF4444' : '#9CA3AF'
  const keywordTags = article?.matched_tags || []

  // Parse reasoning into paragraphs
  const reasoningParagraphs = article?.sentiment_reasoning
    ? article.sentiment_reasoning.split('\n\n').filter(Boolean)
    : []
  const reasoningLabels = ['Что произошло', 'Почему важно', 'Каскадный эффект']

  // Sentiment gauge angle: -10 → 0°, +10 → 180°, 0 → 90°
  const gaugeAngle = article ? ((article.sentiment_score + 10) / 20) * 180 : 90

  // Time ago
  const timeAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 60) return `${mins} мин`
    if (mins < 1440) return `${Math.floor(mins / 60)} ч`
    return `${Math.floor(mins / 1440)} д`
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto py-6 px-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-full rounded-2xl overflow-hidden my-auto"
          style={{ backgroundColor: '#111111', border: '1px solid #222222', maxWidth: 680 }}
          onClick={e => e.stopPropagation()}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20" style={{ color: '#9CA3AF' }}>
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mr-2" style={{ borderColor: '#333', borderTopColor: 'transparent' }} />
              Загрузка...
            </div>
          ) : error || !article ? (
            <div className="text-center py-12">
              <p style={{ color: '#EF4444' }}>{error || 'Article not found'}</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: '#222', color: '#fff' }}>Закрыть</button>
            </div>
          ) : (
            <>
              {/* ═══ HEADER ═══ */}
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: '#222' }}>
                <div className="flex items-center gap-2">
                  {article.article_type === 'micro' ? (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: '#2563EB22', color: '#60A5FA' }}>
                      <Building2 size={10} /> Micro
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: '#F59E0B22', color: '#FBBF24' }}>
                      <MapPin size={10} /> Macro
                    </span>
                  )}
                  {article.is_political && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: '#EF444422', color: '#EF4444' }}>
                      <Shield size={10} /> Политика
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={handleCopyLink} className="p-2 rounded-lg hover:bg-[#222] transition-colors" style={{ color: copied ? '#34D399' : '#6B7280' }} title={copied ? 'Скопировано!' : 'Копировать ссылку'}>
                    {copied ? <Check size={16} /> : <Link2 size={16} />}
                  </button>
                  <a href={`https://t.me/share/url?url=${encodeURIComponent(article.url)}&text=${encodeURIComponent(article.title_ru)}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-[#222] transition-colors" style={{ color: '#6B7280' }} title="Telegram">
                    <Send size={16} />
                  </a>
                  <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#222] transition-colors" style={{ color: '#6B7280' }}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* ═══ CONTENT ═══ */}
              <div className="p-5 space-y-4">

                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: `${sentimentColor}15`, color: sentimentColor, border: `1px solid ${sentimentColor}30` }}>
                    {article.sentiment === 'positive' ? '+' : ''}{article.sentiment_score} · {article.sentiment === 'positive' ? 'Позитив' : article.sentiment === 'negative' ? 'Негатив' : 'Нейтрально'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: article.sentiment_source?.startsWith('llm') ? '#8B5CF622' : '#6B728022', color: article.sentiment_source?.startsWith('llm') ? '#A78BFA' : '#9CA3AF' }}>
                    {article.sentiment_source?.startsWith('llm') ? 'Brain LLM' : 'Keyword'}
                  </span>
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: '#6B7280' }}>
                    <Globe size={10} /> {article.source} · <Clock size={10} /> {timeAgo(article.published_at)}
                  </span>
                </div>

                {/* Sentiment Gauge */}
                <div className="flex flex-col items-center py-2">
                  <svg width="180" height="90" viewBox="0 0 180 90">
                    <path d="M 18 90 A 72 72 0 0 1 162 90" fill="none" stroke="#222" strokeWidth="10" strokeLinecap="round" />
                    <path d="M 18 90 A 72 72 0 0 1 162 90" fill="none" stroke={sentimentColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(gaugeAngle / 180) * 226} 226`} style={{ transition: 'stroke-dasharray 0.8s ease-out' }} />
                    <line x1="90" y1="90" x2={90 + 60 * Math.cos(Math.PI - (gaugeAngle * Math.PI / 180))} y2={90 - 60 * Math.sin(Math.PI - (gaugeAngle * Math.PI / 180))} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ transition: 'all 0.8s ease-out' }} />
                    <circle cx="90" cy="90" r="4" fill="#fff" />
                    <text x="12" y="85" fontSize="7" fill="#6B7280" textAnchor="middle">-10</text>
                    <text x="90" y="50" fontSize="7" fill="#6B7280" textAnchor="middle">0</text>
                    <text x="168" y="85" fontSize="7" fill="#6B7280" textAnchor="middle">+10</text>
                  </svg>
                  <span className="text-sm font-bold -mt-1" style={{ color: sentimentColor }}>{article.sentiment_score > 0 ? '+' : ''}{article.sentiment_score}</span>
                </div>

                {/* Title + Translation Toggle */}
                <div>
                  {article.title_original && (
                    <div className="flex items-center gap-1 mb-2">
                      <button onClick={() => setLang('ru')} className="text-[10px] px-2 py-0.5 rounded transition-colors" style={{ backgroundColor: lang === 'ru' ? '#222' : 'transparent', color: lang === 'ru' ? '#fff' : '#6B7280' }}>RU</button>
                      <button onClick={() => setLang('en')} className="text-[10px] px-2 py-0.5 rounded transition-colors" style={{ backgroundColor: lang === 'en' ? '#222' : 'transparent', color: lang === 'en' ? '#fff' : '#6B7280' }}>{article.lang_original?.toUpperCase() || 'EN'}</button>
                    </div>
                  )}
                  <h2 className="text-xl font-bold leading-snug" style={{ color: '#FFFFFF' }}>
                    {lang === 'en' && article.title_original ? article.title_original : article.title_ru}
                  </h2>
                </div>

                {/* Summary */}
                {article.summary_ru && (
                  <p className="text-sm leading-relaxed" style={{ color: '#D1D5DB' }}>{article.summary_ru}</p>
                )}

                {/* Reasoning Card */}
                {reasoningParagraphs.length > 0 && (
                  <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: '#0A0A0A', border: '1px solid #1a1a1a' }}>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>Reasoning — LLM анализ</p>
                    {reasoningParagraphs.map((p, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-1 shrink-0 rounded-full" style={{ backgroundColor: i === 0 ? sentimentColor : '#333' }} />
                        <div>
                          <p className="text-[10px] mb-0.5" style={{ color: '#6B7280' }}>{reasoningLabels[i] || `P${i + 1}`}</p>
                          <p className="text-xs leading-relaxed" style={{ color: '#D1D5DB' }}>{p}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Keyword Tags (Layer 1) */}
                {keywordTags.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: '#6B7280' }}>
                      <Key size={10} /> Теги — Keyword matching (Layer 1)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {keywordTags.map((tag: string) => (
                        <span key={tag} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ backgroundColor: '#1a1a1a', color: '#9CA3AF', border: '1px solid #222' }}>
                          <Key size={9} color="#6B7280" /> {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* LLM Tags (Layer 2) */}
                {article.tag_impact && article.tag_impact.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: '#6B7280' }}>
                      <Brain size={10} /> Теги — LLM анализ (Layer 2)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {article.tag_impact.map((ti: TagImpact) => {
                        const c = ti.score > 0 ? '#34D399' : ti.score < 0 ? '#EF4444' : '#9CA3AF'
                        return (
                          <div key={ti.tag} className="group relative">
                            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full cursor-default" style={{ backgroundColor: `${c}12`, color: c, border: `1px solid ${c}25` }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
                              {ti.tag} <span className="font-bold">{ti.score > 0 ? '+' : ''}{ti.score}</span>
                            </span>
                            {ti.reasoning && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs max-w-[240px] z-10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" style={{ backgroundColor: '#1a1a1a', color: '#D1D5DB', border: '1px solid #333' }}>
                                {ti.reasoning}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Source Chain */}
                {article.source_count > 1 && article.all_sources && (
                  <p className="text-xs" style={{ color: '#6B7280' }}>Источники: {article.all_sources.join(' → ')} ({article.source_count})</p>
                )}

                {/* Original Link */}
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90" style={{ backgroundColor: '#1a1a1a', color: '#60A5FA', border: '1px solid #222' }}>
                  <ExternalLink size={14} /> Открыть оригинал
                </a>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
