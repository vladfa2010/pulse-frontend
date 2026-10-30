import { useRef, useState, useCallback, useEffect, useId, useMemo, memo } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { logAnalyticsEvent } from '@/lib/analytics'
import { usePopularTags, type TagPeriod, type PopularTag } from '@/hooks/usePopularTags'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { TrendingUp, Clock, Calendar, Lock } from 'lucide-react'

// ─── Color constants (matching DESIGN_SYSTEM.md) ──────────────────────────
const TYPE_COLORS: Record<string, string> = {
  company: '#00D4FF',
  sector: '#A78BFA',
  person: '#FBBF24',
  trend: '#34D399',
}
const TYPE_LABELS: Record<string, string> = {
  company: 'Компании',
  sector: 'Секторы',
  person: 'Личности',
  trend: 'Тренды',
}
const PERIODS: { key: TagPeriod; label: string; icon: typeof Clock }[] = [
  { key: '24h', label: '24 часа', icon: Clock },
  { key: '7d', label: '7 дней', icon: Calendar },
  { key: '30d', label: 'Месяц', icon: Calendar },
]

// ─── Helpers ──────────────────────────────────────────────────────────────
function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function getCardStyles(type: string, isSelected: boolean) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.company
  if (isSelected) {
    return {
      background: `linear-gradient(180deg, ${hexToRgba(color, 0.06)} 0%, ${hexToRgba(color, 0.02)} 100%)`,
      borderColor: hexToRgba(color, 0.15),
      boxShadow: `0 4px 18px -4px ${hexToRgba(color, 0.17)}, inset 0 -1px 0 0 ${hexToRgba(color, 0.11)}`,
      hoverShadow: `0 8px 27px -4px ${hexToRgba(color, 0.29)}, inset 0 -1px 0 0 ${hexToRgba(color, 0.22)}`,
    }
  }
  return {
    background: `linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)`,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    boxShadow: '0 2px 12px -4px rgba(0, 0, 0, 0.3)',
    hoverShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.4)',
  }
}

// ─── Ripple Effect ────────────────────────────────────────────────────────
function createRipple(cardEl: HTMLElement, color: string, isSelecting: boolean) {
  const dotWrap = cardEl.querySelector('.pts-dot-wrap') as HTMLElement | null
  if (!dotWrap) return

  // getBoundingClientRect gives exact viewport coordinates; subtract card rect
  // to get dot position relative to the card regardless of offsetParent chain.
  const dotRect = dotWrap.getBoundingClientRect()
  const cardRect = cardEl.getBoundingClientRect()
  const x = dotRect.left - cardRect.left + dotWrap.offsetWidth / 2
  const y = dotRect.top - cardRect.top + dotWrap.offsetHeight / 2

  for (let i = 0; i < 2; i++) {
    const ripple = document.createElement('div')
    ripple.className = 'pts-ripple'
    ripple.style.cssText = `
      position: absolute; border-radius: 50%; pointer-events: none;
      transform: translate(-50%, -50%) scale(0);
      left: ${x}px; top: ${y}px;
      width: 30px; height: 30px;
      border: 1.5px solid ${hexToRgba(color, 0.5)};
      animation: ${isSelecting ? 'rippleCollapse' : 'rippleExpand'}
                 ${isSelecting ? '2.75s' : '3.4s'}
                 ${isSelecting ? 'ease-out' : 'ease-in-out'}
                 forwards;
      animation-delay: ${[0, 0.35][i]}s;
    `
    cardEl.appendChild(ripple)
    ripple.addEventListener('animationend', () => ripple.remove())
  }
}

// ─── Styles (injected via <style>) ────────────────────────────────────────
const SLIDER_STYLES = `
  .pts-ripple {
    pointer-events: none !important;
  }
  @keyframes rippleExpand {
    0%   { transform: translate(-50%, -50%) scale(0); opacity: 0.5; }
    100% { transform: translate(-50%, -50%) scale(12); opacity: 0; }
  }
  @keyframes rippleCollapse {
    0%   { transform: translate(-50%, -50%) scale(8); opacity: 0; }
    100% { transform: translate(-50%, -50%) scale(0); opacity: 0.45; }
  }
`

// ─── PeriodTabs Sub-component ─────────────────────────────────────────────
const PeriodTabs = memo(function PeriodTabs({
  active,
  onChange,
  layoutId,
  compact = false,
}: {
  active: TagPeriod
  onChange: (p: TagPeriod) => void
  /** ТЗ-202: layoutId обязан быть уникален на инстанс (useId), иначе при
      двух смонтированных слайдерах подложка таба «перепрыгивает» между ними */
  layoutId: string
  /** ТЗ-202 v2: компактный вид блока в уроке (все размеры −25%) */
  compact?: boolean
}) {
  return (
    <div className="relative flex items-center gap-1 p-1 rounded-xl bg-[#161616] border border-[#222222] w-fit">
      {PERIODS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`relative z-10 flex items-center ${compact ? 'gap-1 px-2.5 py-1 text-xs' : 'gap-1.5 px-3.5 py-1.5 text-sm'} rounded-lg font-medium transition-colors duration-300 cursor-pointer ${
            active === key ? 'text-white' : 'text-[#6B7280] hover:text-white/80'
          }`}
        >
          <Icon className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          {label}
          {active === key && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-0 rounded-lg bg-white/10 -z-10"
              transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
            />
          )}
        </button>
      ))}
    </div>
  )
})

// ─── TagCard Sub-component ────────────────────────────────────────────────
function TagCard({
  tag,
  isSelected,
  onToggle,
  cardRef,
  compact = false,
}: {
  tag: PopularTag
  isSelected: boolean
  onToggle: () => void
  cardRef?: (el: HTMLDivElement | null) => void
  compact?: boolean
}) {
  const color = TYPE_COLORS[tag.tag_type] || TYPE_COLORS.company
  const label = TYPE_LABELS[tag.tag_type] || tag.tag_type
  const styles = getCardStyles(tag.tag_type, isSelected)

  return (
    <motion.div
      ref={cardRef}
      className={`pts-card relative flex-shrink-0 ${compact ? 'w-[78px] h-[60px] rounded-xl p-0.5' : 'w-[104px] h-[80px] rounded-2xl p-1'} flex flex-col items-center text-center cursor-pointer overflow-hidden select-none`}
      style={{
        background: styles.background,
        border: `1px solid ${styles.borderColor}`,
        boxShadow: styles.boxShadow,
      }}
      whileHover={{ y: -1, boxShadow: styles.hoverShadow }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={onToggle}
    >
      {/* Type dot + ring */}
      <div className={`flex items-center justify-center gap-0.5 mb-auto ${compact ? 'pt-0' : 'pt-0.5'} z-10`}>
        <div className={`pts-dot-wrap relative ${compact ? 'w-3 h-3' : 'w-4 h-4'} flex items-center justify-center flex-shrink-0`}>
          {/* Dot — always visible */}
          <div
            className={`pts-card-dot ${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full`}
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${hexToRgba(color, 0.4)}` }}
          />
          {/* Ring — appears on select via CSS transition */}
          <div
            className={`absolute inset-0 rounded-full border-[1.5px] transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none ${
              isSelected ? 'scale-100 opacity-100' : 'scale-[0.3] opacity-0'
            }`}
            style={{
              borderColor: hexToRgba(color, 0.5),
              boxShadow: `0 0 8px ${hexToRgba(color, 0.25)}`,
            }}
          />
        </div>
        <span className={`${compact ? 'text-[8px]' : 'text-[9px]'} font-medium uppercase tracking-wider`} style={{ color: hexToRgba(color, 0.8) }}>
          {label}
        </span>
      </div>

      {/* Tag name */}
      <div className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-white truncate max-w-full px-0.5 leading-tight my-auto z-10`}>
        {tag.tag_name}
      </div>

      {/* News count — big accent number */}
      <div className={`flex items-baseline justify-center mt-auto z-10 ${compact ? 'pb-0' : 'pb-0.5'}`}>
        <span
          className={`${compact ? 'text-sm' : 'text-lg'} font-bold leading-none tracking-tight`}
          style={{ color, textShadow: `0 0 16px ${hexToRgba(color, 0.25)}` }}
        >
          {tag.news_count}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────
function TagSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex-shrink-0 ${compact ? 'w-[78px] h-[60px] rounded-xl' : 'w-[104px] h-[80px] rounded-2xl'} bg-[#161616] border border-[#222222] animate-pulse`} />
  )
}

// ─── Main Component ───────────────────────────────────────────────────────
// ТЗ-202: пропсы встраивания. Дефолты = прежнее поведение главной (регрессионно
// не трогаем): section-обёртка, limit 15, автоскролл 5с, source 'popular'.
export interface PopularTagsSliderProps {
  /** 'section' — главная (секция + контейнер 1200px); 'embedded' — в потоке
      .edu-content урока: без обёрток, fade-градиентов и автоскролла */
  variant?: 'section' | 'embedded'
  limit?: number
  autoScroll?: boolean
  analyticsSource?: string
  /** ТЗ-203 v2: сигнал демо-переключения (инкремент = просьба переключить
      вкладку 24ч → 7д). Действует только пока юзер сам не выбрал другой
      период — не перебиваем его выбор. Главная (section) не передаёт. */
  switchSignal?: number
}

export default function PopularTagsSlider({
  variant = 'section',
  limit = 15,
  autoScroll = true,
  analyticsSource = 'popular',
  switchSignal = 0,
}: PopularTagsSliderProps = {}) {
  const [period, setPeriod] = useState<TagPeriod>('24h')
  // ТЗ-203 v2: после пробега подсветки блока вкладка сама переключается
  // 24ч → 7д (показ интерактивности). Трогаем только дефолтный период —
  // выбор юзера не перебиваем.
  useEffect(() => {
    if (switchSignal > 0) setPeriod((p) => (p === '24h' ? '7d' : p))
  }, [switchSignal])
  const { data: tags, isLoading } = usePopularTags(period, limit)
  const { isLoggedIn, portfolio, addTag, removeTag } = useAuth()
  const { open } = useAuthModal()
  const selectedIds = useMemo(() => new Set(portfolio.map((p) => p.tag_id)), [portfolio])
  // ТЗ-110/ТЗ-202: заморозка — per-tag is_frozen (глобального флага нет);
  // при замороженных карточки не кликабельны (иначе addTag молча вернёт 403)
  const frozenCount = useMemo(() => portfolio.filter((p) => p.is_frozen).length, [portfolio])
  const hasFrozen = isLoggedIn && frozenCount > 0
  const tabLayoutId = `periodTabSlider-${useId()}`
  // ТЗ-202 v2: embedded (блок в уроке) рендерится компактно — все размеры −25%,
  // чтобы в строку влезало больше карточек. Главная (section) не меняется.
  const compact = variant === 'embedded'
  const carouselRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isHoveredRef = useRef(false)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const setCardRef = useCallback((el: HTMLDivElement | null, tagId: string) => {
    if (el) cardRefs.current.set(tagId, el)
    else cardRefs.current.delete(tagId)
  }, [])

  // Auto-scroll (3 cards per tick, 5s interval) — только section-вариант
  useEffect(() => {
    if (!autoScroll) return
    const el = carouselRef.current
    if (!el) return

    autoScrollRef.current = setInterval(() => {
      if (isHoveredRef.current) return
      const cardW = (compact ? 78 : 104) + (compact ? 5 : 7) // card + gap
      const maxScroll = el.scrollWidth - el.clientWidth
      if (el.scrollLeft >= maxScroll - 10) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: cardW * 3, behavior: 'smooth' })
      }
    }, 5000)

    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current)
    }
  }, [tags, autoScroll, compact])

  // Toggle tag subscription (logged-in only)
  const handleToggle = useCallback(
    async (tag: PopularTag) => {
      if (!isLoggedIn) {
        open('login')
        return
      }
      if (hasFrozen) return // ТЗ-202: заморожено — клики перекрыты плашкой

      const isSelected = selectedIds.has(tag.tag_id)
      const cardEl = cardRefs.current.get(tag.tag_id)
      const color = TYPE_COLORS[tag.tag_type] || TYPE_COLORS.company

      if (isSelected) {
        setTimeout(() => {
          if (cardEl) createRipple(cardEl, color, false)
        }, 150)
        await removeTag(tag.tag_id)
        logAnalyticsEvent('unsubscribe_tag', { tag_id: tag.tag_id, tag_name: tag.tag_name, source: analyticsSource })
      } else {
        if (cardEl) createRipple(cardEl, color, true)
        const result = await addTag({
          tagId: tag.tag_id,
          tagName: tag.tag_name,
          tagType: tag.tag_type,
        })
        if (result.success) {
          logAnalyticsEvent('subscribe_tag', { tag_id: result.tag?.tag_id || tag.tag_id, tag_name: result.tag?.tag_name || tag.tag_name, tag_type: result.tag?.tag_type || tag.tag_type, source: analyticsSource })
        } else {
          console.error('[PopularTags] Failed to add tag:', result.error)
        }
      }
    },
    [isLoggedIn, hasFrozen, selectedIds, addTag, removeTag, open, analyticsSource]
  )

  // ─── Заморозка: компактная плашка (ТЗ-202 п.6) ───
  const freezeBanner = hasFrozen ? (
    <div className={`${compact ? 'mb-2.5 text-[11px] px-2 py-1' : 'mb-4 text-xs px-2.5 py-1.5'} inline-flex items-center gap-1.5 rounded-full`} style={{ backgroundColor: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.25)', color: '#FBBF24' }}>
      <Lock size={11} />
      {frozenCount} {frozenCount === 1 ? 'тег заморожен' : 'тега заморожено'} — <Link to="/" className="underline hover:opacity-80">разобраться на главной</Link>
    </div>
  ) : null

  // ─── Карусель (общая для обоих вариантов) ───
  const carousel = (
    <div
      className="relative"
      onMouseEnter={() => {
        isHoveredRef.current = true
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false
      }}
    >
      {/* Edge fades — только section: в embedded фон карточки (#101010), а
          градиенты захардкожены под фон главной (#060606) — были бы полосами */}
      {variant === 'section' && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#060606] to-transparent z-10 pointer-events-none hidden sm:block" />
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#060606] to-transparent z-10 pointer-events-none hidden sm:block" />
        </>
      )}

      {/* Track */}
      <div
        ref={carouselRef}
        className={`flex ${compact ? 'gap-[5px]' : 'gap-[7px]'} overflow-x-auto scrollbar-hide ${variant === 'section' ? 'pt-1 pb-[26px]' : 'py-1'}`}
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className={`flex ${compact ? 'gap-[5px]' : 'gap-[7px]'} ${hasFrozen ? 'pointer-events-none opacity-60' : ''}`}>
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={`skeleton-${i}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: i * 0.05,
                    duration: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <TagSkeleton compact={compact} />
                </motion.div>
              ))
            : tags?.map((tag, i) => (
                <motion.div
                  key={tag.tag_id}
                  data-tag-id={tag.tag_id}
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: i * 0.08,
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <TagCard
                    tag={tag}
                    isSelected={selectedIds.has(tag.tag_id)}
                    onToggle={() => handleToggle(tag)}
                    cardRef={(el) => setCardRef(el, tag.tag_id)}
                    compact={compact}
                  />
                </motion.div>
              ))}
        </div>
      </div>
    </div>
  )

  if (variant === 'embedded') {
    // ТЗ-202: рендер в потоке .edu-content — без section/контейнера главной.
    // ТЗ-202 v2: компактный вид — размеры −25%, карточек в строку влезает больше.
    return (
      <div className="w-full">
        <style>{SLIDER_STYLES}</style>
        <div className={`flex flex-wrap items-center justify-between gap-2 ${compact ? 'mb-2.5' : 'mb-4'}`}>
          <div className="flex items-center gap-1.5">
            <TrendingUp className={compact ? 'w-3.5 h-3.5 text-[#00D4FF]' : 'w-4 h-4 text-[#00D4FF]'} />
            <span className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-white`}>Теги сообщества</span>
          </div>
          <PeriodTabs active={period} onChange={setPeriod} layoutId={tabLayoutId} compact={compact} />
        </div>
        {freezeBanner}
        {carousel}
      </div>
    )
  }

  return (
    <section className="w-full py-8">
      <style>{SLIDER_STYLES}</style>

      <div className="max-w-[1200px] mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-white flex items-center gap-2.5">
              <TrendingUp className="w-5 h-5 text-[#00D4FF]" />
              Популярные теги
            </h2>
            <p className="text-sm text-[#6B7280] mt-1">Выберите интересующие вас темы</p>
          </div>
          <PeriodTabs active={period} onChange={setPeriod} layoutId={tabLayoutId} />
        </div>
        {freezeBanner}
        {carousel}
      </div>
    </section>
  )
}
