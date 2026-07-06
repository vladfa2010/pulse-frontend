/**
 * =============================================================================
 * PULSE — Главная страница (Home)
 * =============================================================================
 *
 * Без mock-данных. Все новости приходят только с бэкенда через API.
 *
 * Структура:
 *   1. UnreadNewsCarousel — "Это вы ещё не видели" (реальные непрочитанные)
 *   2. Hero — поиск, теги, PulseLine
 *   3. Popular Tags — подборка популярных тем
 *   4. Portfolio Block — портфель от инвестиционно.рф
 *   5. Features — описание возможностей
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { logAnalyticsEvent } from '@/lib/analytics'
import { useQueryClient } from '@tanstack/react-query'
import { useSseNews } from '@/hooks/useSseNews'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ArrowRight, Sparkles, TrendingUp, BarChart3, Newspaper, Plus, Loader2, AlertCircle } from 'lucide-react'
import Tag from '@/components/Tag'
import PulseLine from '@/components/PulseLine'
import PremiumPromptModal from '@/components/PremiumPromptModal'
import UnreadNewsCarousel from '@/components/UnreadNewsCarousel'
import AllNewsCarousel from '@/components/AllNewsCarousel'
import GlobalNewsCarousel from '@/components/GlobalNewsCarousel'
import TelegramConnectBanner from '@/components/TelegramConnectBanner'
import DailySummary from '@/components/DailySummary'
import SentimentChartCard from '@/components/SentimentChartCard'
import PopularTagsSlider from '@/components/PopularTagsSlider'
import HeroAnimation from '@/components/HeroAnimation'
// Layout обёрнут в App.tsx — не нужен здесь

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface Suggestion {
  id: string
  label: string
  type: 'company' | 'sector' | 'person' | 'trend'
}

// Fallback: популярные теги при < 3 символов ввода
// ID должны совпадать с тем, что генерирует handleCreateCustomTag из label
const popularTags: Suggestion[] = [
  { id: 'сбербанк', label: 'Сбербанк', type: 'company' },
  { id: 'apple', label: 'Apple', type: 'company' },
  { id: 'nvidia', label: 'NVIDIA', type: 'company' },
  { id: 'bitcoin', label: 'Bitcoin', type: 'trend' },
  { id: 'tesla', label: 'Tesla', type: 'company' },
]

const subscribePortfolio: Suggestion[] = [
  { id: 'vastdata', label: 'VastData', type: 'company' },
  { id: 'crusoe', label: 'Crusoe', type: 'company' },
  { id: 'spacex', label: 'SpaceX', type: 'company' },
  { id: 'cashea', label: 'Cashea', type: 'company' },
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
  const { isLoggedIn, user, portfolio, tagVersion, addTag, removeTag } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  useSseNews(true) // ← Real-time news via SSE (for all users, including global carousel)
  const queryClient = useQueryClient()

  // Инвалидируем кэш каруселей при изменении тегов
  useEffect(() => {
    if (tagVersion > 0) {
      queryClient.invalidateQueries({ queryKey: ['unreadNews'] })
      queryClient.invalidateQueries({ queryKey: ['historyNews'] })
    }
  }, [tagVersion, queryClient])
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [, setIsSearching] = useState(false)
  const [, setSearchComplete] = useState(false)
  const [lastAddedTagId, setLastAddedTagId] = useState<string | null>(null)
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [addTagError, setAddTagError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [searchResults, setSearchResults] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)

  // Debounce: динамический поиск тегов через API (≥ 3 символов)
  useEffect(() => {
    if (searchValue.trim().length < 3) {
      setSearchResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const data = await api.get(`/tags/search?q=${encodeURIComponent(searchValue.trim())}`)
        setSearchResults(data.tags.map((t: any) => ({
          id: t.tag_id,
          label: t.tag_name,
          type: t.tag_type,
        })))
      } catch (err) {
        console.error('Tag search error:', err)
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [searchValue])

  // Map portfolio (from API) to Suggestion format for display
  const selectedTags: Suggestion[] = portfolio.map(p => ({
    id: p.tag_id,
    label: p.tag_name,
    type: (p.tag_type as 'company' | 'sector' | 'person' | 'trend') || 'company',
  }))

  const searchRef = useRef<HTMLInputElement>(null)

  const filteredSuggestions = searchValue.trim().length < 3
    ? popularTags.filter(s => !selectedTags.some(t => t.id === s.id))
    : searchResults.filter(s => !selectedTags.some(t => t.id === s.id))

  // Сбрасываем активный suggestion при изменении списка
  useEffect(() => {
    setActiveIndex(-1)
  }, [filteredSuggestions.length])

  const isPremium = user?.subscription?.active ?? false
  const tagLimit = isPremium ? 25 : 3
  const canAddTag = !isLoggedIn || selectedTags.length < tagLimit
  const [showPremiumPrompt, setShowPremiumPrompt] = useState(false)

  const handleSelectSuggestion = useCallback(async (s: Suggestion) => {
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
    setAddTagError(null)
    setIsAddingTag(true)
    try {
      const result = await addTag({
        tagId: s.id,
        tagName: s.label,
        tagType: s.type,
      })
      if (result.success) {
        logAnalyticsEvent('search', { search_term: s.label })
        logAnalyticsEvent('subscribe_tag', { tag_id: s.id, tag_name: s.label, tag_type: s.type, source: 'search' })
        setSearchValue('')
        setIsSearching(true)
        setSearchComplete(false)
        setLastAddedTagId(s.id)
        setTimeout(() => {
          setIsSearching(false)
          setSearchComplete(true)
          setTimeout(() => setLastAddedTagId(null), 1500)
        }, 600)
      } else {
        setAddTagError(result.error || 'Failed to add tag')
      }
    } finally {
      setIsAddingTag(false)
    }
  }, [isLoggedIn, canAddTag, selectedTags, addTag])

  const handleRemoveTag = useCallback((id: string) => {
    removeTag(id)
    logAnalyticsEvent('unsubscribe_tag', { tag_id: id })
  }, [removeTag])

  // Создать пользовательский тег
  const handleCreateCustomTag = useCallback(async () => {
    if (!isLoggedIn) {
      openAuthModal()
      return
    }
    if (!canAddTag) {
      setShowPremiumPrompt(true)
      return
    }
    const tagName = searchValue.trim()
    if (tagName.length < 2) return

    // Если в текущих результатах поиска есть exact match по названию — подписываемся на него
    const exactMatch = searchResults.find(
      s => s.label.trim().toLowerCase() === tagName.toLowerCase()
    )
    if (exactMatch) {
      setAddTagError(null)
      setIsAddingTag(true)
      try {
        await handleSelectSuggestion(exactMatch)
      } finally {
        setIsAddingTag(false)
      }
      return
    }

    // Генерируем tag_id из названия
    const tagId = tagName.toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)

    if (selectedTags.some(t => t.id === tagId)) {
      setLastAddedTagId(tagId)
      setTimeout(() => setLastAddedTagId(null), 500)
      return
    }

    setAddTagError(null)
    setIsAddingTag(true)
    try {
      // Создаем тег через addTag (tagType: 'auto' → backend вызовет LLM enrichment)
      const result = await addTag({
        tagId: tagId,
        tagName: tagName,
        tagType: 'auto',
      })
      if (result.success) {
        logAnalyticsEvent('search', { search_term: tagName })
        logAnalyticsEvent('subscribe_tag', { tag_id: tagId, tag_name: tagName, tag_type: 'auto', source: 'custom' })
        setSearchValue('')
        setLastAddedTagId(tagId)
        setTimeout(() => setLastAddedTagId(null), 1500)
      } else {
        setAddTagError(result.error || 'Failed to create tag')
      }
    } finally {
      setIsAddingTag(false)
    }
  }, [isLoggedIn, canAddTag, searchValue, searchResults, selectedTags, addTag, openAuthModal])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredSuggestions.length > 0) {
        setActiveIndex(prev => (prev + 1) % filteredSuggestions.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredSuggestions.length > 0) {
        setActiveIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length)
      }
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && filteredSuggestions[activeIndex]) {
        handleSelectSuggestion(filteredSuggestions[activeIndex])
      } else if (filteredSuggestions.length > 0) {
        handleSelectSuggestion(filteredSuggestions[0])
      } else if (searchValue.trim().length >= 2) {
        handleCreateCustomTag()
      }
    } else if (e.key === 'Escape') {
      setActiveIndex(-1)
      setIsFocused(false)
      searchRef.current?.blur()
    }
  }

  const allAdded = subscribePortfolio.every(p => selectedTags.some(t => t.id === p.id))

  return (
    <>
      {/* ==================== HERO ==================== */}
      <section className={`relative ${isLoggedIn ? 'flex flex-col items-center justify-start pt-4 pb-5 min-h-0' : 'grid grid-rows-[minmax(0,3fr)_auto_auto_minmax(0,1fr)] items-center justify-items-center min-h-[100dvh] pt-24 pb-12'}`}>
        {!isLoggedIn && (
          <>
            <div className="w-full h-full flex items-center justify-center overflow-hidden">
              <div className="w-full h-full max-h-[32dvh] md:max-h-[40dvh]">
                <HeroAnimation className="h-full min-h-0" />
              </div>
            </div>
            <div className="w-full h-8 md:h-12" />
          </>
        )}
        <div className="flex flex-col items-center w-full px-6">
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
              disabled={isAddingTag}
              onChange={e => setSearchValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              onKeyDown={handleKeyDown}
              className="w-full h-full bg-transparent text-lg text-text-primary placeholder-text-muted pl-14 pr-14 rounded-pill focus:outline-none disabled:opacity-50"
              placeholder={isAddingTag ? 'Создаём тег и ищем новости...' : 'Введите компанию, сектор, личность или тренд...'}
            />
            <AnimatePresence>
              {isAddingTag ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-4 text-cyan-accent"
                >
                  <Loader2 size={18} className="animate-spin" />
                </motion.div>
              ) : searchValue && (
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

          {/* Ошибка добавления тега */}
          {addTagError && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs mt-2" style={{ backgroundColor: '#EF444415', border: '1px solid #EF444430', color: '#EF4444' }}>
              <AlertCircle size={14} />
              <span>{addTagError}</span>
              <button onClick={() => setAddTagError(null)} className="ml-auto" style={{ color: '#EF444480' }}>✕</button>
            </div>
          )}

          {/* Search Dropdown */}
          <AnimatePresence>
            {isFocused && searchValue.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
                style={{ backgroundColor: '#0E0E0E', border: '1px solid #222222' }}
              >
                {/* Индикатор поиска */}
                {searching && searchValue.trim().length >= 3 && (
                  <div className="flex items-center gap-2 px-4 py-3" style={{ color: '#6B7280' }}>
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">Поиск...</span>
                  </div>
                )}

                {/* Результаты поиска / популярные теги */}
                {filteredSuggestions.map((s, i) => (
                  <button
                    key={s.id}
                    onMouseDown={() => handleSelectSuggestion(s)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    style={{
                      animationDelay: `${i * 30}ms`,
                      backgroundColor: i === activeIndex ? '#1a1a1a' : 'transparent',
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: typeColors[s.type] }}
                    />
                    <span className="text-text-primary">{s.label}</span>
                    <span className="ml-auto text-xs text-text-muted">{typeLabels[s.type]}</span>
                  </button>
                ))}

                {/* Создать пользовательский тег */}
                {filteredSuggestions.length === 0 && searchValue.trim().length >= 2 && (
                  <button
                    onMouseDown={handleCreateCustomTag}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-hover transition-colors"
                  >
                    <Plus size={16} className="text-[#00D4FF] flex-shrink-0" />
                    <span className="text-[#00D4FF]">Создать тег "{searchValue.trim()}"</span>
                    <span className="ml-auto text-xs text-text-muted">новый</span>
                  </button>
                )}
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
              className="flex flex-col items-center gap-3 mt-6"
            >
              {/* Tag cloud — FULL WIDTH, counter не крадет место */}
              <div className="flex flex-wrap justify-center gap-2 w-full">
                {selectedTags.map(tag => (
                  <motion.div
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
                      onClick={() => {
                        logAnalyticsEvent('select_content', { content_type: 'tag_feed', item_id: tag.id })
                        navigate(`/feed?tag=${encodeURIComponent(tag.label)}`)
                      }}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Tag counter — BELOW on separate row with decorative lines */}
              {isLoggedIn && (
                <div className="flex items-center justify-center gap-3 w-full">
                  <div className="flex-1 max-w-[80px] h-px bg-gradient-to-r from-transparent to-[rgba(0,212,255,0.2)]" />
                  <div
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: selectedTags.length >= tagLimit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 212, 255, 0.1)',
                      border: `1px solid ${selectedTags.length >= tagLimit ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 212, 255, 0.2)'}`,
                      color: selectedTags.length >= tagLimit ? '#EF4444' : '#00D4FF',
                    }}
                  >
                    {selectedTags.length}/{tagLimit}
                  </div>
                  <div className="flex-1 max-w-[80px] h-px bg-gradient-to-l from-transparent to-[rgba(0,212,255,0.2)]" />
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
        {!isLoggedIn && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.8 }}
            className="text-center text-base text-text-secondary mt-6"
          >
            Акции. Секторы. Личности. Тренды. Все в одной ленте.
          </motion.p>
        )}
        </div>
        {!isLoggedIn && <div />}
      </section>

      {/* ═══ ЭТО ВЫ ЕЩЁ НЕ ВИДЕЛИ (только непрочитанные) ═══ */}
      {isLoggedIn && selectedTags.length > 0 && <UnreadNewsCarousel />}

      {/* ═══ ВСЯ ЛЕНТА (все новости по тегам, хронологически) ═══ */}
      {isLoggedIn && selectedTags.length > 0 && <AllNewsCarousel />}

      {/* ═══════ AI DAILY SUMMARY ═══════ */}
      {isLoggedIn && selectedTags.length > 0 && <DailySummary />}

      {/* ═══ ОБЩАЯ ЛЕНТА (все новости без фильтра тегов) ═══ */}
      <GlobalNewsCarousel />

      {/* ==================== SENTIMENT INDEX ==================== */}
      <section className="px-6 pt-12 pb-12 max-w-[1200px] mx-auto w-full">
        <SentimentChartCard showMetrics={false} isHomeBlock />
      </section>

      {/* ═══ ПРОМО-БАННЕР: ПОДКЛЮЧЕНИЕ TELEGRAM ═══ */}
      <TelegramConnectBanner isLoggedIn={isLoggedIn} isPremium={isPremium} />

      {/* Подсказка: добавьте теги */}
      {isLoggedIn && selectedTags.length === 0 && (
        <div className="w-full py-8 text-center">
          <p className="text-text-muted text-sm">
            Добавьте теги выше, чтобы увидеть персональную ленту новостей
          </p>
        </div>
      )}

      {/* ==================== POPULAR TAGS SLIDER ==================== */}
      <PopularTagsSlider />

      {/* ==================== SUBSCRIBE BLOCK ==================== */}
      <section className="px-6 py-16 max-w-[1200px] mx-auto">
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

      {/* ==================== FEATURES (only for guests) ==================== */}
      {!isLoggedIn && (
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
      )}

    </>
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
