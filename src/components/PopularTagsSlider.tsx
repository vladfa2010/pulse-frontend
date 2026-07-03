import { useRef, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { usePopularTags, type TagPeriod, type PopularTag } from '@/hooks/usePopularTags'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { TrendingUp, Clock, Calendar } from 'lucide-react'

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
      boxShadow: `0 4px 20px -4px ${hexToRgba(color, 0.15)}, inset 0 -1px 0 0 ${hexToRgba(color, 0.1)}`,
      hoverShadow: `0 8px 30px -4px ${hexToRgba(color, 0.25)}, inset 0 -1px 0 0 ${hexToRgba(color, 0.2)}`,
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

  // offsetLeft/Top are relative to the positioned parent (.pts-card)
  const x = dotWrap.offsetLeft + dotWrap.offsetWidth / 2
  const y = dotWrap.offsetTop + dotWrap.offsetHeight / 2

  for (let i = 0; i < 2; i++) {
    const ripple = document.createElement('div')
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
function PeriodTabs({ active, onChange }: { active: TagPeriod; onChange: (p: TagPeriod) => void }) {
  return (
    <div className="relative flex items-center gap-1 p-1 rounded-xl bg-[#161616] border border-[#222222] w-fit">
      {PERIODS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors duration-300 cursor-pointer ${
            active === key ? 'text-white' : 'text-[#6B7280] hover:text-white/80'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
          {active === key && (
            <motion.div
              layoutId="periodTabSlider"
              className="absolute inset-0 rounded-lg bg-white/10 -z-10"
              transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

// ─── TagCard Sub-component ────────────────────────────────────────────────
function TagCard({
  tag,
  isSelected,
  onToggle,
}: {
  tag: PopularTag
  isSelected: boolean
  onToggle: () => void
}) {
  const color = TYPE_COLORS[tag.tag_type] || TYPE_COLORS.company
  const label = TYPE_LABELS[tag.tag_type] || tag.tag_type
  const styles = getCardStyles(tag.tag_type, isSelected)

  return (
    <motion.div
      layout
      className="relative flex-shrink-0 w-[104px] h-[80px] rounded-2xl p-1 flex flex-col items-center text-center cursor-pointer overflow-hidden select-none"
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
      <div className="flex items-center justify-center gap-0.5 mb-auto pt-0.5 relative z-10">
        <div className="pts-dot-wrap relative w-4 h-4 flex items-center justify-center flex-shrink-0">
          {/* Dot — always visible */}
          <div
            className="pts-card-dot w-2 h-2 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${hexToRgba(color, 0.4)}` }}
          />
          {/* Ring — appears on select via CSS transition */}
          <div
            className={`absolute inset-0 rounded-full border-[1.5px] transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isSelected ? 'scale-100 opacity-100' : 'scale-[0.3] opacity-0'
            }`}
            style={{
              borderColor: hexToRgba(color, 0.5),
              boxShadow: `0 0 8px ${hexToRgba(color, 0.25)}`,
            }}
          />
        </div>
        <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: hexToRgba(color, 0.8) }}>
          {label}
        </span>
      </div>

      {/* Tag name */}
      <div className="text-sm font-semibold text-white truncate max-w-full px-0.5 leading-tight my-auto z-10">
        {tag.tag_name}
      </div>

      {/* News count — big accent number */}
      <div className="flex items-baseline justify-center mt-auto z-10 pb-0.5">
        <span
          className="text-lg font-bold leading-none tracking-tight"
          style={{ color, textShadow: `0 0 16px ${hexToRgba(color, 0.25)}` }}
        >
          {tag.news_count}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────
function TagSkeleton() {
  return (
    <div className="flex-shrink-0 w-[104px] h-[80px] rounded-2xl bg-[#161616] border border-[#222222] animate-pulse" />
  )
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function PopularTagsSlider() {
  const [period, setPeriod] = useState<TagPeriod>('24h')
  const { data: tags, isLoading } = usePopularTags(period)
  const { isLoggedIn, portfolio, loadPortfolio, tagVersion, addTag, removeTag } = useAuth()
  const { open } = useAuthModal()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const carouselRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isHoveredRef = useRef(false)

  // Sync selected state with user's portfolio
  useEffect(() => {
    if (isLoggedIn) {
      loadPortfolio().then(() => {
        const ids = new Set(portfolio.map((p) => p.tag_id))
        setSelectedIds(ids)
      })
    }
  }, [isLoggedIn, tagVersion])

  // Auto-scroll (3 cards per tick, 5s interval)
  useEffect(() => {
    const el = carouselRef.current
    if (!el) return

    autoScrollRef.current = setInterval(() => {
      if (isHoveredRef.current) return
      const cardW = 104 + 7 // card + gap
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
  }, [tags])

  // Toggle tag subscription (logged-in only)
  const handleToggle = useCallback(
    async (tag: PopularTag) => {
      if (!isLoggedIn) {
        open('login')
        return
      }

      const isSelected = selectedIds.has(tag.tag_id)
      const cardEl = document.querySelector(`[data-tag-id="${tag.tag_id}"]`) as HTMLElement
      const color = TYPE_COLORS[tag.tag_type]

      if (isSelected) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(tag.tag_id)
          return next
        })
        setTimeout(() => {
          if (cardEl) createRipple(cardEl, color, false)
        }, 150)
        await removeTag(tag.tag_id)
      } else {
        if (cardEl) createRipple(cardEl, color, true)
        const result = await addTag({
          tagId: tag.tag_id,
          tagName: tag.tag_name,
          tagType: tag.tag_type,
        })
        if (!result.success) {
          console.error('[PopularTags] Failed to add tag:', result.error)
        }
      }
    },
    [isLoggedIn, selectedIds, addTag, removeTag, open]
  )

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
          <PeriodTabs active={period} onChange={setPeriod} />
        </div>

        {/* Carousel */}
        <div
          className="relative"
          onMouseEnter={() => {
            isHoveredRef.current = true
          }}
          onMouseLeave={() => {
            isHoveredRef.current = false
          }}
        >
          {/* Edge fades */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#060606] to-transparent z-10 pointer-events-none hidden sm:block" />
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#060606] to-transparent z-10 pointer-events-none hidden sm:block" />

          {/* Track */}
          <div
            ref={carouselRef}
            className="flex gap-[7px] overflow-x-auto scrollbar-hide pb-2"
            style={{ scrollBehavior: 'smooth' }}
          >
            <AnimatePresence mode="popLayout">
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
                      <TagSkeleton />
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
                      />
                    </motion.div>
                  ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
