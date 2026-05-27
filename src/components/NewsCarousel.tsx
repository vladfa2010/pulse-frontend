/**
 * =============================================================================
 * PULSE — Универсальная карусель новостей
 * =============================================================================
 *
 * Компактная, центрированная карусель без видимого скроллбара.
 * Карточки фиксированной ширины, контент центрирован.
 */

import { useRef, useState, useEffect, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface NewsCarouselProps {
  title: string
  subtitle?: string
  count?: number
  accentColor?: string
  children: ReactNode
}

export default function NewsCarousel({
  title,
  subtitle,
  count,
  accentColor = '#00D4FF',
  children,
}: NewsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 10)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    checkScroll()
    return () => el.removeEventListener('scroll', checkScroll)
  }, [])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = dir === 'left' ? -450 : 450
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }

  return (
    <section className="w-full py-5">
      {/* Header */}
      <div className="max-w-[1200px] mx-auto px-6 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold" style={{ color: accentColor }}>
            {title}
          </h2>
          {count !== undefined && (
            <span className="text-[10px] text-text-muted ml-1">({count})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {subtitle && <span className="text-[10px] text-text-muted mr-2 hidden sm:inline">{subtitle}</span>}
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all
              ${canScrollLeft ? 'bg-white/10 hover:bg-white/20 cursor-pointer' : 'bg-white/5 cursor-default opacity-30'}`}
          >
            <ChevronLeft size={16} className="text-text-muted" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all
              ${canScrollRight ? 'bg-white/10 hover:bg-white/20 cursor-pointer' : 'bg-white/5 cursor-default opacity-30'}`}
          >
            <ChevronRight size={16} className="text-text-muted" />
          </button>
        </div>
      </div>

      {/* Carousel track */}
      <div className="max-w-[1200px] mx-auto relative">
        {/* Left fade */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to right, #000000, transparent)' }} />
        )}
        {/* Right fade */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to left, #000000, transparent)' }} />
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto px-6 pb-1 scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>
      </div>
    </section>
  )
}
