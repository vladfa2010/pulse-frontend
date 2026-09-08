/**
 * =============================================================================
 * PULSE — Главная страница (Home)
 * =============================================================================
 *
 * Без mock-данных. Все новости приходят только с бэкенда через API.
 *
 * Структура:
 *   1. FreezeTagsBanner — баннер заморозки / превышения лимита тегов
 *   2. Hero — поиск, теги, PulseLine (+ демо-теги DemoTagsRow гостям под поиском — ТЗ-59)
 *   3. BlurHighlight — текст-объяснение над демо-лентой (только гостям, ТЗ-68)
 *   4. DemoFeedCarousel — демо-лента с графиками от демо-аккаунта (только гостям, сразу под hero — ТЗ-59/60)
 *   5. GlobalSummary isPublic — «Пульс рынка», ИИ-саммари всей ленты для гостей (только кэш — ТЗ-58 продолжение)
 *   6. FeaturesCarousel — «Что Pulse делает вместо вас», карусель из 7 карточек (только гостям — ТЗ-57)
 *   7. DailySummary — AI-саммари по тегам пользователя
 *   8. UnreadNewsCarousel — "Это вы ещё не видели" (реальные непрочитанные)
 *   9. AllNewsCarousel — вся лента по тегам
 *   9. GlobalSummary — AI-саммари всей ленты (авторизованным)
 *  10. GlobalNewsCarousel — общая лента без фильтра тегов (только авторизованным; с гостевой главной убрана)
 *  11. PublicInfoVolume — «Объём информации» эталонного аккаунта (только гостям, ТЗ-56/57)
 *  12. SuperpowerVideoBanner — видео-баннер «Суперсила инвестора» (только гостям, ТЗ-55)
 *  13. SentimentChartCard — график настроений (авторизованным — здесь; гостям — после календаря)
 *  14. TelegramConnectBanner — подключение Telegram-бота
 *  15. Popular Tags — подборка популярных тем (авторизованным — здесь; гостям — самый низ)
 *  16. Portfolio Block — портфель от инвестиционно.рф (только авторизованным)
 *  17. Hero «Ваши инструменты» — второй hero-заголовок (только гостям, над «Пульсом рынка»)
 *  18. MarketPulseMini — тепловая карта года (ленивый маунт, ТЗ-48)
 *  19. CalendarBlock — календарь инвестора (ленивый маунт, ТЗ-48)
 *  20. CTA «Бесплатная регистрация» — чёрная кнопка с BorderGlow (только гостям, самый низ — ТЗ-58)
 *  21. CascadeTestBanner — баннер прототипа «Тест каскадов и сюжетов» (ТЗ-47, только авторизованным, самый низ)
 */

import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { logAnalyticsEvent } from '@/lib/analytics'
import { getEffectiveTagLimit, type PlanRef } from '@/lib/subscription'
import { useQueryClient } from '@tanstack/react-query'
import { useUnreadCount } from '@/contexts/UnreadCountContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ArrowRight, Sparkles, Plus, Loader2, AlertCircle } from 'lucide-react'
import Tag from '@/components/Tag'
import PulseLine from '@/components/PulseLine'
import PremiumPromptModal from '@/components/PremiumPromptModal'
import UnreadNewsCarousel from '@/components/UnreadNewsCarousel'
import AllNewsCarousel from '@/components/AllNewsCarousel'
import GlobalNewsCarousel from '@/components/GlobalNewsCarousel'
import TelegramConnectBanner from '@/components/TelegramConnectBanner'
import DailySummary from '@/components/DailySummary'
import GlobalSummary from '@/components/GlobalSummary'
import PopularTagsSlider from '@/components/PopularTagsSlider'
import CalendarBlock from '@/components/CalendarBlock'
import HeroAnimation from '@/components/HeroAnimation'
import FreezeTagsBanner from '@/components/FreezeTagsBanner'
import MarketPulseMini from '@/components/heatmap/MarketPulseMini'
import LazyRender from '@/components/LazyRender'
import FeaturesCarousel from '@/components/home/FeaturesCarousel'
import SuperpowerVideoBanner from '@/components/home/SuperpowerVideoBanner'
import PublicInfoVolume from '@/components/home/PublicInfoVolume'
import CascadeTestBanner from '@/components/CascadeTestBanner'
import BorderGlow from '@/components/BorderGlow'
import DemoTagsRow from '@/components/home/DemoTagsRow'
import DemoFeedCarousel from '@/components/home/DemoFeedCarousel'
import TextType from '@/components/TextType'
import BlurHighlight from '@/components/react-bits/blur-highlight'

// ТЗ-68: текст над демо-лентой с BlurHighlight. Текст утверждает владелец.
// ВАЖНО: каждая строка BITS — точная подстрока TEXT, иначе подсветка молча пропадёт.
// Текст правим только вместе с BITS.
const DEMO_FEED_TEXT = 'Это демо-лента: ИИ уже прочитал тысячи новостей и выбрал интересные вам, убрал дубли и дал оценку. По каждой новости выделил реакцию рынка — вы видите реакцию рынка.'
const DEMO_FEED_BITS = [
  'тысячи новостей',
  'интересные вам',
  'выделил реакцию рынка',
  'видите реакцию',
]

// Текст над ИИ-саммари «Пульс рынка» — тот же BlurHighlight, что и над демо-лентой.
// Правило то же: каждая строка BITS — точная подстрока TEXT.
const SUMMARY_TEXT = 'Пульс рынка: короткий обзор рыночной ситуации по всем последним новостям. Помогает не потерять чувство рынка. Персональная подборка появится, когда вы введёте свои теги.'
const SUMMARY_BITS = [
  'короткий обзор',
  'ситуации',
  'Персональная подборка',
  'свои',
]

// Печатающийся плейсхолдер поиска у гостей (ТЗ-65): серии фраз — печать → пауза →
// стирание → следующая, по кругу. Тексты утверждает владелец — правятся только здесь.
const PLACEHOLDER_TYPED_TEXTS_DESKTOP = [
  'Сейчас мы добавили тег «Сбербанк». Добавили «Нефть» и «Яндекс»',
  'Добавьте то, что важно знать вам и вашему капиталу!',
  'Пробуйте отслеживать компании, тикеры и персоны',
  'Экспериментируйте — пусть информация учитывает ваш интерес',
]
const PLACEHOLDER_TYPED_TEXTS_MOBILE = [
  'Мы ввели тег «Сбербанк»',
  'Добавили «Нефть» и «Яндекс»',
  'Соберите то, что важно вам',
]

const SentimentChartCard = lazy(() => import('@/components/SentimentChartCard'))
// Layout обёрнут в App.tsx — не нужен здесь

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

// Приветствие по локальному времени устройства (ТЗ-53)
function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return 'Доброе утро'
  if (h >= 12 && h < 18) return 'Добрый день'
  if (h >= 18 && h < 23) return 'Добрый вечер'
  return 'Доброй ночи' // 23:00–05:59
}

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

// Индекс настроения — блок главной. Позиция зависит от isLoggedIn:
// авторизованным — после «Объёма информации», гостям — после календаря инвестора.
function HomeSentimentIndex() {
  return (
    <section className="px-6 pt-12 pb-12 max-w-[1200px] mx-auto w-full">
      <Suspense
        fallback={
          <div className="w-full rounded-xl pt-1.5 md:pt-2 px-3 md:px-4 pb-3 md:pb-4 relative" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex flex-col md:flex-row justify-between items-start mb-0.5">
              <div className="w-full space-y-2">
                <div className="h-8 w-56 rounded bg-white/5 animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-white/5 animate-pulse" />
              </div>
              <div className="mt-4 md:mt-0 space-y-2">
                <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
                <div className="h-10 w-20 rounded bg-white/5 animate-pulse" />
              </div>
            </div>
            <div className="h-[235px] md:h-[254px] rounded-2xl bg-white/5 animate-pulse" />
          </div>
        }
      >
        <SentimentChartCard showMetrics={false} isHomeBlock />
      </Suspense>
    </section>
  )
}

// CTA «Бесплатная регистрация» с BorderGlow (ТЗ-58). Клик открывает модалку
// сразу на табе создания аккаунта. Дублируется на гостевой главной: после
// ИИ-саммари и в самом низу страницы.
function RegisterCta({ bottom = false }: { bottom?: boolean }) {
  const { open: openAuthModal } = useAuthModal()
  return (
    <section className={`flex justify-center px-6 pt-4 ${bottom ? 'pb-24' : 'pb-10'}`}>
      <BorderGlow>
        <button
          onClick={() => openAuthModal('register')}
          className="px-[30px] py-[15px] text-[21px] font-medium text-text-primary"
        >
          Бесплатная регистрация
        </button>
      </BorderGlow>
    </section>
  )
}

export default function Home() {
  const { isLoggedIn, user, portfolio, tagVersion, addTag, removeTag, hasToken } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const { reset } = useUnreadCount()
  const queryClient = useQueryClient()

  // Сбрасываем badge непрочитанных новостей, когда пользователь на главной
  useEffect(() => {
    reset()
  }, [reset])

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
  // prefers-reduced-motion: без печати — сразу статичный текст (ТЗ-65)
  const [prefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
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
  const selectedTags: Array<Suggestion & { enriched?: boolean }> = portfolio.map(p => ({
    id: p.tag_id,
    label: p.tag_name,
    type: (p.tag_type as 'company' | 'sector' | 'person' | 'trend') || 'company',
    enriched: p.enriched,
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

  // Tag limit from effective plan (DEFSUB-1)
  const [plans, setPlans] = useState<PlanRef[]>([])
  useEffect(() => {
    let cancelled = false
    api.get('/plans')
      .then(data => {
        if (cancelled) return
        const list: PlanRef[] = (data?.plans || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          tagLimit: p.tag_limit ?? p.tagLimit ?? 3,
        }))
        setPlans(list)
      })
      .catch(err => console.error('[Home] plans error:', err))
    return () => { cancelled = true }
  }, [])

  const tagLimit = getEffectiveTagLimit(user, plans)

  const canAddTag = !isLoggedIn || (tagLimit !== null && selectedTags.length < tagLimit)
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
      if (result.success && result.tag) {
        const addedTagId = result.tag.tag_id
        logAnalyticsEvent('search', { search_term: s.label })
        logAnalyticsEvent('subscribe_tag', { tag_id: addedTagId, tag_name: result.tag.tag_name, tag_type: result.tag.tag_type, source: 'search' })
        setSearchValue('')
        setIsSearching(true)
        setSearchComplete(false)
        setLastAddedTagId(addedTagId)
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
      if (result.success && result.tag) {
        const addedTagId = result.tag.tag_id
        logAnalyticsEvent('search', { search_term: tagName })
        logAnalyticsEvent('subscribe_tag', { tag_id: addedTagId, tag_name: result.tag.tag_name, tag_type: result.tag.tag_type, source: 'custom' })
        setSearchValue('')
        setLastAddedTagId(addedTagId)
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
      {/* ═══ БАННЕР ЗАМОРОЗКИ ТЕГОВ (приоритет выше Hero) ═══ */}
      <FreezeTagsBanner />

      {/* ==================== HERO ==================== */}
      <section className={`relative ${isLoggedIn ? 'flex flex-col items-center justify-start pt-4 pb-5 min-h-0' : 'grid grid-rows-[minmax(200px,32dvh)_auto_auto_minmax(0,1fr)] md:grid-rows-[minmax(200px,40dvh)_auto_auto_minmax(0,1fr)] items-center justify-items-center min-h-[100dvh] pt-24 pb-12'}`}>
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
            fontSize: 'clamp(36px, 6vw, 72px)', // решение владельца 2026-09-08: кегль гостевого hero минус 25% (было 48/8vw/96)
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            textAlign: 'center',
          }}
        >
          {isLoggedIn ? (
            <>
              <span className="gradient-text">{getGreeting()}, </span>
              <span className="italic" style={{ color: '#00D4FF' }}>{user?.username || 'Пользователь'}</span>
            </>
          ) : (
            <>
              <span className="gradient-text">Освобождаем 90% времени на анализ новостей.</span>
              <br />
              <span className="italic" style={{ color: '#00D4FF' }}>Без ущерба осведомлённости</span>
            </>
          )}
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
            {/* ТЗ-65: печатающийся плейсхолдер гостям — оверлей поверх инпута */}
            {!isLoggedIn && !isFocused && searchValue === '' && !isAddingTag && (
              <div
                aria-hidden="true"
                className="absolute left-14 right-14 top-1/2 -translate-y-1/2 pointer-events-none text-lg text-text-muted whitespace-nowrap overflow-hidden text-center"
              >
                {prefersReducedMotion ? (
                  <>
                    <span className="hidden md:inline">{PLACEHOLDER_TYPED_TEXTS_DESKTOP[PLACEHOLDER_TYPED_TEXTS_DESKTOP.length - 1]}</span>
                    <span className="md:hidden">{PLACEHOLDER_TYPED_TEXTS_MOBILE[PLACEHOLDER_TYPED_TEXTS_MOBILE.length - 1]}</span>
                  </>
                ) : (
                  <>
                    <div className="hidden md:block">
                      <TextType
                        text={PLACEHOLDER_TYPED_TEXTS_DESKTOP}
                        typingSpeed={44}
                        deletingSpeed={22}
                        pauseDuration={2500}
                        initialDelay={600}
                        loop
                        showCursor
                        startOnVisible
                      />
                    </div>
                    <div className="md:hidden">
                      <TextType
                        text={PLACEHOLDER_TYPED_TEXTS_MOBILE}
                        typingSpeed={44}
                        deletingSpeed={22}
                        pauseDuration={2500}
                        initialDelay={600}
                        loop
                        showCursor
                        startOnVisible
                      />
                    </div>
                  </>
                )}
              </div>
            )}
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
              placeholder={isAddingTag ? 'Добавляем тег...' : isLoggedIn ? 'Введите компанию, сектор, личность или тренд...' : ''}
              aria-label="Поиск: компания, сектор, личность или тренд"
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

        {/* Демо-теги демо-аккаунта (гостям, ТЗ-59) — read-only, клик → регистрация */}
        {!isLoggedIn && <DemoTagsRow />}

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
                      enriching={!tag.enriched}
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
                      backgroundColor: tagLimit !== null && selectedTags.length >= tagLimit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 212, 255, 0.1)',
                      border: `1px solid ${tagLimit !== null && selectedTags.length >= tagLimit ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 212, 255, 0.2)'}`,
                      color: tagLimit !== null && selectedTags.length >= tagLimit ? '#EF4444' : '#00D4FF',
                    }}
                  >
                    {tagLimit !== null ? `${selectedTags.length}/${tagLimit}` : selectedTags.length}
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
          <PulseLine showLabel={isLoggedIn} />
        </motion.div>
        </div>
        {!isLoggedIn && <div />}
      </section>

      {/* ═══ ДЕМО-ЛЕНТА (гостям, ТЗ-59/60): теги и графики от демо-аккаунта ═══ */}
      {/* Выше карусели «Что Pulse делает вместо вас» — сначала живой продукт, потом рассказ */}
      {/* ТЗ-68: текст-объяснение с BlurHighlight — вместо бывшего subtitle в hero */}
      {!isLoggedIn && (
        <section className="px-6 pt-16 pb-4 max-w-[1200px] mx-auto w-full">
          {prefersReducedMotion ? (
            <p className="text-[32px] leading-loose text-text-primary max-w-xl mx-auto">{DEMO_FEED_TEXT}</p>
          ) : (
            <BlurHighlight
              blurAmount={8}
              inactiveOpacity={0.3}
              blurDelay={0.3}
              blurDuration={0.8}
              highlightColor="rgba(0, 212, 255, 0.25)"
              highlightClassName="py-0.5 px-1 rounded-[5px]"
              highlightDelay={0.4}
              highlightDuration={1}
              highlightDirection="left"
              highlightedBits={DEMO_FEED_BITS}
              viewportOptions={{ once: true, amount: 0.5 }}
              className="max-w-xl mx-auto"
            >
              <p className="text-[32px] leading-loose text-text-primary">{DEMO_FEED_TEXT}</p>
            </BlurHighlight>
          )}
        </section>
      )}
      {!isLoggedIn && <DemoFeedCarousel />}

      {/* ==================== ПУЛЬС РЫНКА — ИИ-САММАРИ ДЛЯ ГОСТЕЙ ==================== */}
      {/* Тот же GlobalSummary, что и у авторизованных, но публичный: /public/summary-global
          отдаёт только свежий кэш (генерацию не триггерит), без кнопки «Обновить».
          404/ошибка → блок молча скрыт. Выше «Что Pulse делает вместо вас». */}
      {/* Текст-объяснение над ИИ-саммари — идентичный BlurHighlight, как над демо-лентой (ТЗ-68) */}
      {!isLoggedIn && (
        <section className="px-6 pt-16 pb-4 max-w-[1200px] mx-auto w-full">
          {prefersReducedMotion ? (
            <p className="text-[32px] leading-loose text-text-primary max-w-xl mx-auto">{SUMMARY_TEXT}</p>
          ) : (
            <BlurHighlight
              blurAmount={8}
              inactiveOpacity={0.3}
              blurDelay={0.3}
              blurDuration={0.8}
              highlightColor="rgba(0, 212, 255, 0.25)"
              highlightClassName="py-0.5 px-1 rounded-[5px]"
              highlightDelay={0.4}
              highlightDuration={1}
              highlightDirection="left"
              highlightedBits={SUMMARY_BITS}
              viewportOptions={{ once: true, amount: 0.5 }}
              className="max-w-xl mx-auto"
            >
              <p className="text-[32px] leading-loose text-text-primary">{SUMMARY_TEXT}</p>
            </BlurHighlight>
          )}
        </section>
      )}
      {!isLoggedIn && <GlobalSummary isPublic />}

      {/* Дубль CTA после ИИ-саммари — конверсионная точка на прочитанном инсайте */}
      {!isLoggedIn && <RegisterCta />}

      {/* ==================== FEATURES — КАРУСЕЛЬ (гостям, ТЗ-57) ==================== */}
      {/* «Что Pulse делает вместо вас» — 7 карточек поверх NewsCarousel */}
      {!isLoggedIn && <FeaturesCarousel />}

      {/* ═══════ AI DAILY SUMMARY ═══════ */}
      {isLoggedIn && selectedTags.length > 0 && <DailySummary />}

      {/* ═══ ЭТО ВЫ ЕЩЁ НЕ ВИДЕЛИ (только непрочитанные) ═══ */}
      {/* ТЗ-46: старт по hasToken, чтобы не ждать /user/tags; zero-tags гейт внутри.
          Осознанный tradeoff: при протухшем токене улетит пакет параллельных 401,
          первый вызовет clearAuth → hasToken=false → размонтирование. */}
      {hasToken && <UnreadNewsCarousel />}

      {/* ═══ ВСЯ ЛЕНТА (все новости по тегам, хронологически) ═══ */}
      {hasToken && <AllNewsCarousel />}

      {/* ═══════ AI GLOBAL SUMMARY ═══════ */}
      {isLoggedIn && <GlobalSummary />}

      {/* ═══ ОБЩАЯ ЛЕНТА (все новости без фильтра тегов) ═══ */}
      {/* Только авторизованным: гостю вместо неё — демо-лента (ТЗ-59) */}
      {isLoggedIn && <GlobalNewsCarousel />}

      {/* ==================== PUBLIC INFO VOLUME (ТЗ-56) ==================== */}
      {/* «Объём информации» эталонного аккаунта — соцдоказательство для гостей.
          Только гостям (!isLoggedIn), выше баннера «Суперсила». Источник:
          GET /api/public/efficiency (публичный, кэш 60 с). Ошибка/404 → блок скрыт. */}
      {!isLoggedIn && <PublicInfoVolume />}

      {/* ==================== SUPERPOWER VIDEO BANNER ==================== */}
      {/* TZ_HOME_SUPERPOWER_VIDEO_BANNER: видео-баннер «Суперсила инвестора — знать».
          Только гостям (!isLoggedIn), под «Объёмом информации». Видео ленивое
          (IO + preload=none), CTA открывает модалку регистрации. */}
      {!isLoggedIn && (
        <section className="px-6 pt-4 pb-16 max-w-[1200px] mx-auto w-full">
          <SuperpowerVideoBanner />
        </section>
      )}

      {/* ==================== SENTIMENT INDEX (авторизованным) ==================== */}
      {/* Гостям блок рендерится ниже — сразу после календаря инвестора */}
      {isLoggedIn && <HomeSentimentIndex />}

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
      {/* Гостям слайдер показан в самом низу страницы (после календаря) */}
      {isLoggedIn && <PopularTagsSlider />}

      {/* ==================== SUBSCRIBE BLOCK ==================== */}
      {/* Портфель инвестиционно.рф — только авторизованным (с гостевой главной убран) */}
      {isLoggedIn && (
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
      )}

      {/* ==================== PREMIUM PROMPT MODAL ==================== */}
      <PremiumPromptModal
        isOpen={showPremiumPrompt}
        onClose={() => setShowPremiumPrompt(false)}
        currentTags={selectedTags.length}
        limit={tagLimit ?? 0}
      />

      {/* ==================== ВТОРОЙ HERO «ВАШИ ИНСТРУМЕНТЫ» (гостям) ==================== */}
      {/* Тот же шрифт/стиль, что и основной hero (ТЗ-54): кегль, градиент, голубой
          курсив, анимация. Размещён над «Пульсом рынка» как заголовок блока инструментов. */}
      {!isLoggedIn && (
        <section className="px-6 pt-12 pb-2 max-w-[1200px] mx-auto w-full">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOutExpo }}
            style={{
              fontSize: 'clamp(32px, 5.33vw, 64px)',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              textAlign: 'center',
            }}
          >
            <span className="gradient-text">Ваши </span>
            <span className="italic" style={{ color: '#00D4FF' }}>инструменты</span>
          </motion.h2>
        </section>
      )}

      {/* ==================== MARKET PULSE MINI ==================== */}
      {/* ТЗ-48: ленивый маунт — запрос /news_heatmap уходит только при приближении блока к вьюпорту */}
      <LazyRender>
        <MarketPulseMini />
      </LazyRender>

      {/* ==================== INVESTOR CALENDAR ==================== */}
      {/* ТЗ-48: ленивый маунт — запрос /calendar уходит только при приближении блока к вьюпорту */}
      <LazyRender>
        <CalendarBlock portfolio={portfolio} isAdmin={user?.isAdmin ?? false} />
      </LazyRender>

      {/* ==================== SENTIMENT INDEX (гостям, сразу после календаря) ==================== */}
      {!isLoggedIn && <HomeSentimentIndex />}

      {/* ==================== POPULAR TAGS SLIDER (гостям, самый низ) ==================== */}
      {!isLoggedIn && <PopularTagsSlider />}

      {/* ==================== CTA «БЕСПЛАТНАЯ РЕГИСТРАЦИЯ» (гостям, самый низ, ТЗ-58) ==================== */}
      {/* BorderGlow: светящаяся рамка следует за курсором, при появлении во вьюпорте
          свечение пробегает по рамке. Клик открывает модалку сразу на табе регистрации.
          Дубль кнопки — после ИИ-саммари (см. выше). */}
      {!isLoggedIn && <RegisterCta bottom />}

      {/* ==================== CASCADE TEST BANNER (ТЗ-47) ==================== */}
      {/* Временный баннер прототипа «Тест каскадов и сюжетов». Только авторизованным,
          самый низ страницы. Снимается фичефлагом SHOW_CASCADE_TEST_BANNER внутри компонента. */}
      {isLoggedIn && (
        <section className="px-6 pt-4 pb-16 max-w-[1200px] mx-auto w-full">
          <CascadeTestBanner />
        </section>
      )}

    </>
  )
}
