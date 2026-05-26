import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ArrowRight, Sparkles, TrendingUp, Newspaper, BarChart3 } from 'lucide-react'
import Tag from '@/components/Tag'
import NewsCard from '@/components/NewsCard'
import PulseLine from '@/components/PulseLine'
import PremiumPromptModal from '@/components/PremiumPromptModal'
import Layout from '@/components/Layout'

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface Suggestion {
  id: string
  label: string
  type: 'company' | 'sector' | 'person' | 'trend'
}

interface NewsArticle {
  id: string
  title_ru: string
  source: string
  published_at: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  tag: string
}

const allSuggestions: Suggestion[] = [
  { id: 'sber', label: 'Сбербанк', type: 'company' },
  { id: 'gazprom', label: 'Газпром', type: 'company' },
  { id: 'yandex', label: 'Яндекс', type: 'company' },
  { id: 'nvda', label: 'NVIDIA', type: 'company' },
  { id: 'tech', label: 'Технологии', type: 'sector' },
  { id: 'crypto', label: 'Криптовалюты', type: 'trend' },
  { id: 'oil', label: 'Нефть и газ', type: 'sector' },
  { id: 'greff', label: 'Греф', type: 'person' },
  { id: 'tesla', label: 'Tesla', type: 'company' },
  { id: 'apple', label: 'Apple', type: 'company' },
  { id: 'ai', label: 'Искусственный интеллект', type: 'trend' },
  { id: 'fed', label: 'ФРС США', type: 'sector' },
]

const popularTags: Suggestion[] = [
  { id: 'sber', label: 'Сбербанк', type: 'company' },
  { id: 'nvda', label: 'NVIDIA', type: 'company' },
  { id: 'gazprom', label: 'Газпром', type: 'company' },
  { id: 'yandex', label: 'Яндекс', type: 'company' },
  { id: 'tech', label: 'Технологии', type: 'sector' },
  { id: 'crypto', label: 'Криптовалюты', type: 'trend' },
  { id: 'oil', label: 'Нефть и газ', type: 'sector' },
  { id: 'tesla', label: 'Tesla', type: 'company' },
  { id: 'apple', label: 'Apple', type: 'company' },
  { id: 'fed', label: 'ФРС США', type: 'sector' },
  { id: 'ai', label: 'ИИ', type: 'trend' },
  { id: 'gold', label: 'Золото', type: 'sector' },
]

const subscribePortfolio: Suggestion[] = [
  { id: 'ir-vastdata', label: 'VastData', type: 'company' },
  { id: 'ir-crusoe', label: 'Crusoe', type: 'company' },
  { id: 'ir-spacex', label: 'SpaceX', type: 'company' },
  { id: 'ir-cashea', label: 'Cashea', type: 'company' },
]

const typeColors: Record<string, string> = {
  company: '#00D4FF',
  sector: '#A78BFA',
  person: '#FBBF24',
  trend: '#34D399',
}

const typeLabels: Record<string, string> = {
  company: 'Компании',
  sector: 'Секторы',
  person: 'Личности',
  trend: 'Тренды',
}

export default function Home() {
  const { isLoggedIn, user } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [selectedTags, setSelectedTags] = useState<Suggestion[]>([])
  const [, setIsSearching] = useState(false)
  const [, setSearchComplete] = useState(false)
  const [lastAddedTagId, setLastAddedTagId] = useState<string | null>(null)
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loadingNews, setLoadingNews] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const filteredSuggestions = searchValue.length > 0
    ? allSuggestions.filter(s =>
        s.label.toLowerCase().includes(searchValue.toLowerCase()) &&
        !selectedTags.some(t => t.id === s.id)
      )
    : []

  const isPremium = user?.subscription?.active ?? false
  const tagLimit = isPremium ? 10 : 3
  const canAddTag = !isLoggedIn || selectedTags.length < tagLimit
  const [showPremiumPrompt, setShowPremiumPrompt] = useState(false)

  const handleSelectSuggestion = useCallback((s: Suggestion) => {
    if (!isLoggedIn) {
      openAuthModal()
      return
    }
    if (!canAddTag) {
      setShowPremiumPrompt(true)
      return
    }
    if (selectedTags.some(t => t.id === s.id)) {
      setLastAddedTagId(s.id)
      setTimeout(() => setLastAddedTagId(null), 500)
      return
    }
    setSelectedTags(prev => [...prev, s])
    setSearchValue('')
    setIsSearching(true)
    setSearchComplete(false)
    setLastAddedTagId(s.id)
    setTimeout(() => {
      setIsSearching(false)
      setSearchComplete(true)
      setTimeout(() => setLastAddedTagId(null), 1500)
    }, 600)
  }, [isLoggedIn, canAddTag, selectedTags])

  const handleRemoveTag = useCallback((id: string) => {
    setSelectedTags(prev => prev.filter(t => t.id !== id))
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredSuggestions.length > 0) {
      handleSelectSuggestion(filteredSuggestions[0])
    }
  }

  // Load mock news for selected tags
  useEffect(() => {
    if (selectedTags.length === 0) {
      setArticles([])
      return
    }
    setLoadingNews(true)
    const mockArticles: NewsArticle[] = selectedTags.flatMap((tag, i) => [
      {
        id: `${tag.id}-1`,
        title_ru: `${tag.label}: рекордная прибыль за квартал — акции +8%`,
        source: 'РБК',
        published_at: new Date(Date.now() - i * 3600000).toISOString(),
        sentiment: 'positive' as const,
        tag: tag.label,
      },
      {
        id: `${tag.id}-2`,
        title_ru: `${tag.label}: аналитики повысили целевую цену после сильного отчета`,
        source: 'Интерфакс',
        published_at: new Date(Date.now() - i * 7200000 - 1800000).toISOString(),
        sentiment: 'positive' as const,
        tag: tag.label,
      },
    ])
    setTimeout(() => {
      setArticles(mockArticles)
      setLoadingNews(false)
    }, 400)
  }, [selectedTags])

  const allAdded = subscribePortfolio.every(p => selectedTags.some(t => t.id === p.id))

  return (
    <Layout>
      {/* ==================== HERO ==================== */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-24 pb-12 min-h-[100dvh]">
        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
          style={{
            fontSize: 'clamp(48px, 8vw, 96px)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            textAlign: 'center',
          }}
        >
          <span className="gradient-text">Отслеживай </span>
          <span className="italic" style={{ color: '#00D4FF' }}>все</span>
        </motion.h1>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4, ease: easeOutExpo }}
          className="relative w-full max-w-[720px] mx-auto mt-8"
        >
          <div
            className="relative flex items-center w-full h-14 rounded-pill transition-all duration-200"
            style={{
              backgroundColor: '#0E0E0E',
              border: isFocused
                ? '1px solid #00D4FF'
                : '1px solid #222222',
              boxShadow: isFocused
                ? '0 0 8px rgba(0, 212, 255, 0.8), 0 0 24px rgba(0, 212, 255, 0.5), 0 0 48px rgba(0, 212, 255, 0.15)'
                : 'none',
            }}
          >
            <Search size={20} className="absolute left-5 text-text-muted flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              onKeyDown={handleKeyDown}
              className="w-full h-full bg-transparent text-lg text-text-primary placeholder-text-muted pl-14 pr-14 rounded-pill focus:outline-none"
              placeholder="Введите компанию, сектор, личность или тренд..."
            />
            <AnimatePresence>
              {searchValue && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setSearchValue('')}
                  className="absolute right-4 text-text-muted hover:text-text-primary transition-colors"
                >
                  <X size={18} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Search Dropdown */}
          <AnimatePresence>
            {isFocused && filteredSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
                style={{ backgroundColor: '#0E0E0E', border: '1px solid #222222' }}
              >
                {filteredSuggestions.map((s, i) => (
                  <button
                    key={s.id}
                    onMouseDown={() => handleSelectSuggestion(s)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-hover transition-colors"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: typeColors[s.type] }}
                    />
                    <span className="text-text-primary">{s.label}</span>
                    <span className="ml-auto text-xs text-text-muted">{typeLabels[s.type]}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Login hint */}
        {!isLoggedIn && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-sm text-text-muted mt-4"
          >
            Войдите, чтобы добавлять теги и отслеживать новости
          </motion.p>
        )}

        {/* Selected Tags + Counter */}
        <AnimatePresence mode="popLayout">
          {selectedTags.length > 0 && (
            <motion.div
              layout
              className="flex items-center justify-center gap-3 mt-6"
            >
              <div className="flex flex-wrap justify-center gap-2">
                {selectedTags.map(tag => (
                  <motion.div
                    layout
                    key={tag.id}
                    initial={{ scale: 0.8, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, x: -20 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={lastAddedTagId === tag.id ? 'tag-loading rounded-full' : 'rounded-full'}
                  >
                    <Tag
                      label={tag.label}
                      type={tag.type}
                      onRemove={() => handleRemoveTag(tag.id)}
                      onClick={() => navigate('/feed')}
                    />
                  </motion.div>
                ))}
              </div>
              {/* Tag counter */}
              {isLoggedIn && (
                <div
                  className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: selectedTags.length >= tagLimit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 212, 255, 0.1)',
                    border: `1px solid ${selectedTags.length >= tagLimit ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 212, 255, 0.2)'}`,
                    color: selectedTags.length >= tagLimit ? '#EF4444' : '#00D4FF',
                  }}
                >
                  {selectedTags.length}/{tagLimit}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse Line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="mt-8"
        >
          <PulseLine />
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          className="text-center text-base text-text-secondary mt-6"
        >
          Акции. Секторы. Личности. Тренды. Все в одной ленте.
        </motion.p>
      </section>

      {/* ==================== NEWS TIMELINE ==================== */}
      {selectedTags.length > 0 && (
        <section className="px-6 md:px-12 py-12 max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-text-primary">Новости по вашим тегам</h2>
            <Link to="/feed" className="text-sm text-accent-primary hover:underline flex items-center gap-1">
              Все новости <ArrowRight size={16} />
            </Link>
          </div>

          {loadingNews ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : articles.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 snap-x">
              {articles.map((article, i) => (
                <NewsCard key={article.id} article={article} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-text-muted">
              <Newspaper size={32} className="mx-auto mb-3 opacity-40" />
              <p>Новостей пока нет</p>
            </div>
          )}
        </section>
      )}

      {/* ==================== POPULAR TAGS ==================== */}
      <section className="px-6 md:px-12 py-16 max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
        >
          <h2 className="text-2xl font-semibold text-text-primary mb-1">Популярные теги</h2>
          <p className="text-sm text-text-muted mb-6">Выберите интересующие вас темы</p>

          <div className="flex flex-wrap gap-2">
            {popularTags.map(tag => {
              const isSelected = selectedTags.some(t => t.id === tag.id)
              return (
                <button
                  key={tag.id}
                  onClick={() => handleSelectSuggestion(tag)}
                  className="flex items-center gap-2 h-10 px-5 rounded-full text-sm font-medium transition-all duration-200 hover:brightness-115 active:scale-[0.97]"
                  style={{
                    backgroundColor: isSelected ? `${typeColors[tag.type]}20` : '#161616',
                    border: `1px solid ${isSelected ? typeColors[tag.type] : '#222222'}`,
                    color: isSelected ? typeColors[tag.type] : '#9CA3AF',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: typeColors[tag.type] }}
                  />
                  {tag.label}
                </button>
              )
            })}
          </div>
        </motion.div>
      </section>

      {/* ==================== SUBSCRIBE BLOCK ==================== */}
      <section className="px-6 md:px-12 py-16 max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
          className="relative overflow-hidden rounded-2xl px-8 py-10 md:px-12 md:py-12"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.06) 0%, rgba(0, 153, 204, 0.03) 100%)',
            border: '1px solid rgba(0, 212, 255, 0.12)',
            backdropFilter: 'blur(16px) saturate(180%)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-accent-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-primary">
              Портфель инвестиционно.рф
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
            {subscribePortfolio.map(item => {
              const added = selectedTags.some(t => t.id === item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (!isLoggedIn) { openAuthModal(); return }
                    added || handleSelectSuggestion(item)
                  }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all"
                  style={{
                    backgroundColor: added ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${added ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                    color: added ? '#00D4FF' : '#9CA3AF',
                    cursor: added ? 'default' : 'pointer',
                  }}
                >
                  <span>{item.label}</span>
                  {added && <span className="text-xs">✓</span>}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => {
              if (!isLoggedIn) { openAuthModal(); return }
              subscribePortfolio.forEach(item => {
                if (!selectedTags.some(t => t.id === item.id)) handleSelectSuggestion(item)
              })
            }}
            className="h-11 px-6 rounded-pill text-sm font-semibold transition-all duration-200 inline-flex items-center gap-2"
            style={{
              background: allAdded ? 'transparent' : 'linear-gradient(135deg, #00D4FF, #0099CC)',
              color: allAdded ? '#6B7280' : '#060606',
              border: allAdded ? '1px solid #222' : 'none',
              cursor: allAdded ? 'default' : 'pointer',
            }}
            disabled={allAdded}
          >
            {allAdded ? 'Портфель добавлен' : 'Добавить портфель'}
            {!allAdded && <ArrowRight size={16} />}
          </button>

          <p className="text-xs text-text-muted mt-4">
            Портфель предоставлен инвестиционно.рф ↗
          </p>
        </motion.div>
      </section>

      {/* ==================== PREMIUM PROMPT MODAL ==================== */}
      <PremiumPromptModal
        isOpen={showPremiumPrompt}
        onClose={() => setShowPremiumPrompt(false)}
        currentTags={selectedTags.length}
        limit={tagLimit}
      />

      {/* ==================== FEATURES ==================== */}
      <section className="px-6 md:px-12 pt-16 pb-20 max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
        >
          <h2 className="text-2xl font-semibold text-text-primary mb-8 text-center">
            Инвестиционные новости в реальном времени
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<TrendingUp size={24} className="text-accent-primary" />}
              title="Сентимент-анализ"
              desc="Автоматическое определение тональности каждой новости — позитив, негатив или нейтралитет"
            />
            <FeatureCard
              icon={<BarChart3 size={24} className="text-accent-primary" />}
              title="Персональная лента"
              desc="Только новости по вашим тегам. Ничего лишнего — только то, что влияет на ваш портфель"
            />
            <FeatureCard
              icon={<Newspaper size={24} className="text-accent-primary" />}
              title="32 источника"
              desc="Агрегация новостей из ведущих российских и международных изданий каждые 15 минут"
            />
          </div>
        </motion.div>
      </section>

    </Layout>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
    </div>
  )
}
