import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, RefreshCw, AlertCircle } from 'lucide-react'
import { logAnalyticsEvent } from '@/lib/analytics'
import { calendarCopy } from '@/lib/copy'
import { getCalendar } from '@/lib/calendarApi'
import { matchPortfolio } from '@/lib/calendarMatch'
import type { PortfolioTag } from '@/hooks/useAuth'
import type {
  CalendarDay,
  CalendarEventGroup,
  CalendarResponse,
  EventKind,
} from '@/types/calendar'

/* =============================================================================
   CalendarBlock — «Календарь инвестора» на главной
   ============================================================================= */

interface CalendarBlockProps {
  portfolio: PortfolioTag[]
  isAdmin?: boolean
}

const ALL_FILTER: EventKind | 'Все' = 'Все'
const FILTERS: (EventKind | 'Все')[] = [
  'Все',
  'МСФО',
  'РСБУ',
  'СД',
  'СА',
  'Дивиденды',
  'Другое',
]

const KIND_COLORS: Record<EventKind, string> = {
  МСФО: '#00D4FF',
  РСБУ: '#A78BFA',
  СД: '#FBBF24',
  СА: '#FB7185',
  Дивиденды: '#34D399',
  Другое: '#9CA3AF',
}

const FILTER_STORAGE_KEY = 'pulse_calendar_filter'
const RU_MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
]
const RU_WEEKDAYS_LONG = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
]

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

function parseLocalDate(date: string): Date {
  // Normalize to YYYY-MM-DD in case backend ever returns an ISO string.
  const dayStr = date.slice(0, 10)
  // Use local-noon parsing to avoid timezone shifts.
  return new Date(`${dayStr}T12:00:00`)
}

function formatSelectedDate(date: string): string {
  const d = parseLocalDate(date)
  const day = d.getDate()
  const month = RU_MONTHS_SHORT[d.getMonth()]
  const weekday = RU_WEEKDAYS_LONG[d.getDay()]
  return `${day} ${month}, ${weekday}`
}

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  })
}

function findDefaultDate(days: CalendarDay[], serverDate: string): string {
  const map = new Map(days.map((d) => [d.date, d]))
  if (map.has(serverDate)) return serverDate
  for (const d of days) {
    if (d.date > serverDate) return d.date
  }
  return days[days.length - 1]?.date ?? serverDate
}

function groupKey(date: string, group: CalendarEventGroup): string {
  return `${date}:${group.kind}:${group.title}`
}

export default function CalendarBlock({ portfolio, isAdmin = false }: CalendarBlockProps) {
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CalendarResponse, Error>({
    queryKey: ['calendar'],
    queryFn: getCalendar,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
  })

  // When calendar snapshot is not uploaded yet, only admins see a placeholder.
  // Regular users and guests get no block at all.
  if (
    isError &&
    (error as any)?.status === 503 &&
    error.message === 'calendar_not_loaded'
  ) {
    if (!isAdmin) return null
    return (
      <section className="px-6 md:px-12 pb-10 max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
        >
          <CalendarNotLoaded />
        </motion.div>
      </section>
    )
  }

  return (
    <section className="px-6 md:px-12 pb-10 max-w-[1200px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOutExpo }}
      >
        {isLoading ? (
          <CalendarSkeleton />
        ) : (
          <CalendarContent
            data={data!}
            portfolio={portfolio}
            isError={isError}
            refetch={refetch}
            queryClient={queryClient}
          />
        )}
      </motion.div>
    </section>
  )
}

/* ── Calendar Content ─────────────────────────────────────────────────────── */

interface CalendarContentProps {
  data: CalendarResponse
  portfolio: PortfolioTag[]
  isError: boolean
  refetch: () => void
  queryClient: ReturnType<typeof useQueryClient>
}

function CalendarContent({
  data,
  portfolio,
  isError,
  refetch,
  queryClient,
}: CalendarContentProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<EventKind | 'Все'>(() => {
    if (typeof window === 'undefined') return ALL_FILTER
    const saved = localStorage.getItem(FILTER_STORAGE_KEY)
    return FILTERS.includes(saved as any)
      ? (saved as EventKind | 'Все')
      : ALL_FILTER
  })
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  )

  const stripRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)
  const prevServerDateRef = useRef<string | null>(null)
  const matchRateSentRef = useRef(false)
  const didDragRef = useRef(false)
  const dragStateRef = useRef<{
    startX: number
    scrollStart: number
  } | null>(null)

  // Default selected day: server_date, nearest future, or last available.
  useEffect(() => {
    const defaultDate = findDefaultDate(data.days, data.server_date)
    if (
      !initializedRef.current ||
      selectedDate === prevServerDateRef.current
    ) {
      setSelectedDate(defaultDate)
    }
    prevServerDateRef.current = data.server_date
    initializedRef.current = true
  }, [data, selectedDate])

  // Persist filter choice.
  useEffect(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, activeFilter)
  }, [activeFilter])

  // Reset group expansions when day/filter changes.
  useEffect(() => {
    setExpandedGroups(new Set())
  }, [selectedDate, activeFilter])

  // Auto-scroll selected date chip to the center of the strip.
  useEffect(() => {
    if (!selectedDate || !stripRef.current) return
    const chip = stripRef.current.querySelector(
      `[data-date="${selectedDate}"]`
    ) as HTMLElement | null
    if (!chip) return
    const container = stripRef.current
    const chipCenter = chip.offsetLeft + chip.offsetWidth / 2
    const containerCenter = container.clientWidth / 2
    container.scrollTo({
      left: chipCenter - containerCenter,
      behavior: 'smooth',
    })
  }, [selectedDate, data.days.length])

  // One-time match-rate analytics per session.
  useEffect(() => {
    if (!data || portfolio.length === 0 || matchRateSentRef.current) return
    const allCompanies = data.days.flatMap((day) =>
      day.groups.flatMap((g) => g.companies)
    )
    const matched = matchPortfolio(allCompanies, portfolio)
    const totalCompanyTags =
      portfolio.filter((t) => t.tag_type === 'company').length || portfolio.length
    logAnalyticsEvent('calendar_match_rate', {
      matched: matched.size,
      total_company_tags: totalCompanyTags,
    })
    matchRateSentRef.current = true
  }, [data, portfolio])

  const selectedDay = useMemo(
    () => data.days.find((d) => d.date === selectedDate) ?? null,
    [data.days, selectedDate]
  )

  const filteredGroups = useMemo(() => {
    if (!selectedDay) return []
    if (activeFilter === 'Все') return selectedDay.groups
    return selectedDay.groups.filter((g) => g.kind === activeFilter)
  }, [selectedDay, activeFilter])

  const selectedDayMatchedTickers = useMemo(() => {
    if (!selectedDay) return new Set<string>()
    return matchPortfolio(
      selectedDay.groups.flatMap((g) => g.companies),
      portfolio
    )
  }, [selectedDay, portfolio])

  const filteredMatchedTickers = useMemo(() => {
    return matchPortfolio(
      filteredGroups.flatMap((g) => g.companies),
      portfolio
    )
  }, [filteredGroups, portfolio])

  const { eventCount, companyCount, yourCount } = useMemo(() => {
    const eventCount = filteredGroups.length
    const companyTickers = new Set<string>()
    for (const g of filteredGroups) {
      for (const c of g.companies) {
        companyTickers.add(c.ticker)
      }
    }
    return {
      eventCount,
      companyCount: companyTickers.size,
      yourCount: filteredMatchedTickers.size,
    }
  }, [filteredGroups, filteredMatchedTickers])

  const todayDay = useMemo(
    () => data.days.find((d) => d.date === data.server_date) ?? null,
    [data.days, data.server_date]
  )

  const todayHasVisibleEvents = useMemo(() => {
    if (!todayDay) return false
    if (activeFilter === 'Все') return todayDay.groups.length > 0
    return todayDay.groups.some((g) => g.kind === activeFilter)
  }, [todayDay, activeFilter])

  const handleDayClick = useCallback(
    (date: string) => {
      if (didDragRef.current) return
      setSelectedDate(date)
      const day = data.days.find((d) => d.date === date)
      const hasPortfolioEvents = day
        ? matchPortfolio(
            day.groups.flatMap((g) => g.companies),
            portfolio
          ).size > 0
        : false
      logAnalyticsEvent('calendar_day_select', {
        date,
        has_portfolio_events: hasPortfolioEvents,
      })
    },
    [data.days, portfolio]
  )

  const handleFilterChange = useCallback(
    (filter: EventKind | 'Все') => {
      setActiveFilter(filter)
      logAnalyticsEvent('calendar_filter_change', { filter })
    },
    []
  )

  const handleRefresh = useCallback(() => {
    logAnalyticsEvent('calendar_refresh_click', {})
    queryClient.invalidateQueries({ queryKey: ['calendar'] })
  }, [queryClient])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!stripRef.current) return
      didDragRef.current = false
      dragStateRef.current = {
        startX: e.pageX,
        scrollStart: stripRef.current.scrollLeft,
      }
      const el = stripRef.current
      const onMove = (ev: MouseEvent) => {
        if (!dragStateRef.current) return
        const dx = ev.pageX - dragStateRef.current.startX
        if (Math.abs(dx) > 5) didDragRef.current = true
        el.scrollLeft = dragStateRef.current.scrollStart - dx
      }
      const onUp = () => {
        dragStateRef.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    []
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!stripRef.current || e.touches.length !== 1) return
      didDragRef.current = false
      dragStateRef.current = {
        startX: e.touches[0].pageX,
        scrollStart: stripRef.current.scrollLeft,
      }
      const el = stripRef.current
      const onMove = (ev: TouchEvent) => {
        if (!dragStateRef.current || ev.touches.length !== 1) return
        const dx = ev.touches[0].pageX - dragStateRef.current.startX
        if (Math.abs(dx) > 5) didDragRef.current = true
        el.scrollLeft = dragStateRef.current.scrollStart - dx
      }
      const onEnd = () => {
        dragStateRef.current = null
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('touchend', onEnd)
        window.removeEventListener('touchcancel', onEnd)
      }
      window.addEventListener('touchmove', onMove, { passive: true })
      window.addEventListener('touchend', onEnd)
      window.addEventListener('touchcancel', onEnd)
    },
    []
  )

  const toggleGroup = useCallback(
    (key: string, group: CalendarEventGroup) => {
      if (!selectedDate) return
      setExpandedGroups((prev) => {
        const next = new Set(prev)
        const willExpand = !next.has(key)
        if (willExpand) {
          logAnalyticsEvent('calendar_group_expand', {
            date: selectedDate,
            kind: group.kind,
            companies_count: group.companies.length,
          })
          next.add(key)
        } else {
          next.delete(key)
        }
        return next
      })
    },
    [selectedDate]
  )

  if (isError) {
    return (
      <CalendarCard>
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <AlertCircle size={28} className="text-[#EF4444]" />
          <p className="text-sm text-[#EF4444]">{calendarCopy.error}</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:brightness-110"
            style={{
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.15)',
              color: '#00D4FF',
            }}
          >
            <RefreshCw size={14} />
            {calendarCopy.retry}
          </button>
        </div>
      </CalendarCard>
    )
  }

  return (
    <CalendarCard>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background:
                'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(52, 211, 153, 0.1))',
              border: '1px solid rgba(0, 212, 255, 0.2)',
            }}
          >
            <CalendarDays size={16} style={{ color: '#00D4FF' }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              {calendarCopy.title}
            </h2>
            <p className="text-xs text-[#6B7280]">{calendarCopy.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {data.generated_at && (
            <span className="hidden sm:inline text-xs text-[#6B7280]">
              {calendarCopy.updated} {formatGeneratedAt(data.generated_at)}
            </span>
          )}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:brightness-110"
            style={{
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.15)',
              color: '#00D4FF',
            }}
          >
            <RefreshCw size={14} />
            {calendarCopy.refresh}
          </button>
        </div>
      </div>

      {/* ── Date strip ── */}
      <div
        ref={stripRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 cursor-grab active:cursor-grabbing select-none"
      >
        {data.days.map((day) => {
          const isSelected = day.date === selectedDate
          const isToday = day.date === data.server_date
          const isWeekend = day.weekday === 'сб' || day.weekday === 'вс'
          const dayNum = parseLocalDate(day.date).getDate()
          const visibleKinds =
            activeFilter === 'Все'
              ? [...new Set(day.groups.map((g) => g.kind))]
              : day.groups
                  .filter((g) => g.kind === activeFilter)
                  .map((g) => g.kind)
          const hasPortfolioEvents =
            matchPortfolio(
              day.groups.flatMap((g) => g.companies),
              portfolio
            ).size > 0
          const dimmed = activeFilter !== 'Все' && visibleKinds.length === 0

          return (
            <button
              key={day.date}
              data-date={day.date}
              onClick={() => handleDayClick(day.date)}
              className="relative flex flex-col items-center justify-center rounded-xl py-2 transition-all pointer-events-auto"
              style={{
                width: 58,
                minWidth: 58,
                opacity: dimmed ? 0.4 : 1,
                background: isSelected
                  ? 'rgba(0, 212, 255, 0.12)'
                  : 'transparent',
                border: `1px solid ${
                  isSelected
                    ? '#00D4FF'
                    : isToday
                    ? 'rgba(0, 212, 255, 0.45)'
                    : 'rgba(255, 255, 255, 0.06)'
                }`,
                boxShadow: isSelected
                  ? '0 0 14px rgba(0, 212, 255, 0.25)'
                  : 'none',
              }}
            >
              <span
                className="text-[10px] uppercase font-medium"
                style={{
                  color: isToday && !isSelected ? '#00D4FF' : '#9CA3AF',
                }}
              >
                {day.weekday}
              </span>
              <span
                className="text-[17px] font-bold leading-tight"
                style={{
                  color:
                    isWeekend && !isSelected
                      ? '#5b6472'
                      : isSelected || isToday
                      ? '#00D4FF'
                      : '#fff',
                }}
              >
                {dayNum}
              </span>
              <div className="h-2 flex items-center justify-center gap-[2px] mt-0.5">
                {visibleKinds.slice(0, 3).map((kind) => (
                  <div
                    key={kind}
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: KIND_COLORS[kind] }}
                  />
                ))}
              </div>
              {hasPortfolioEvents && (
                <div
                  className="absolute bottom-1 left-2 right-2 h-[2px] rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #00D4FF, #34D399)',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3">
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter
          const color = filter === 'Все' ? '#00D4FF' : KIND_COLORS[filter]
          const label =
            filter === 'Все' ? 'Все' : calendarCopy.filters[filter]
          return (
            <button
              key={filter}
              onClick={() => handleFilterChange(filter)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all pointer-events-auto whitespace-nowrap"
              style={{
                background: isActive
                  ? `${color}1F`
                  : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${
                  isActive ? color : 'rgba(255, 255, 255, 0.08)'
                }`,
                color: isActive ? color : '#D1D5DB',
              }}
            >
              {filter !== 'Все' && (
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
              )}
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Selected day header ── */}
      {selectedDate && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h3 className="text-base font-semibold text-white">
            {formatSelectedDate(selectedDate)}
          </h3>
          {selectedDate === data.server_date && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: 'rgba(0, 212, 255, 0.12)',
                color: '#00D4FF',
                border: '1px solid rgba(0, 212, 255, 0.25)',
              }}
            >
              {calendarCopy.today}
            </span>
          )}
          <span className="ml-auto text-xs text-[#6B7280]">
            {calendarCopy.eventCounter(eventCount, companyCount, yourCount)}
          </span>
        </div>
      )}

      {/* ── Stale banner ── */}
      {data.stale && (
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs mb-4"
          style={{
            background: 'rgba(251, 191, 36, 0.12)',
            border: '1px solid rgba(251, 191, 36, 0.25)',
            color: '#FBBF24',
          }}
        >
          <AlertCircle size={14} />
          {calendarCopy.stale}
        </div>
      )}

      {/* ── Nearest events banner when today has no events ── */}
      {selectedDate &&
        selectedDate !== data.server_date &&
        todayDay &&
        !todayHasVisibleEvents && (
          <div className="text-sm text-[#6B7280] mb-3">
            {calendarCopy.nearest}
          </div>
        )}

      {/* ── Day content ── */}
      <motion.div
        key={selectedDate ?? 'empty'}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {filteredGroups.length === 0 ? (
          <div className="text-sm text-[#6B7280] py-8">
            {activeFilter === 'Все'
              ? calendarCopy.emptyDay
              : calendarCopy.emptyFilter}
          </div>
        ) : (
          filteredGroups.map((group, idx) => {
            const key = groupKey(selectedDate!, group)
            const expanded = expandedGroups.has(key)
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: idx * 0.06,
                  duration: 0.4,
                  ease: easeOutExpo,
                }}
                className="rounded-xl p-4 mb-3"
                style={{
                  background: 'rgba(255, 255, 255, 0.018)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <EventGroup
                  group={group}
                  portfolio={portfolio}
                  selectedDayMatchedTickers={selectedDayMatchedTickers}
                  expanded={expanded}
                  onToggle={() => toggleGroup(key, group)}
                />
              </motion.div>
            )
          })
        )}
      </motion.div>

      {/* ── Footer ── */}
      <p className="text-xs text-[#6B7280] mt-4">{calendarCopy.source}</p>
    </CalendarCard>
  )
}

/* ── Event Group ───────────────────────────────────────────────────────────── */

interface EventGroupProps {
  group: CalendarEventGroup
  portfolio: PortfolioTag[]
  selectedDayMatchedTickers: Set<string>
  expanded: boolean
  onToggle: () => void
}

function EventGroup({
  group,
  selectedDayMatchedTickers,
  expanded,
  onToggle,
}: EventGroupProps) {
  const color = KIND_COLORS[group.kind]
  const displayCompanies =
    group.companies.length > 6 && !expanded
      ? group.companies.slice(0, 6)
      : group.companies
  const hiddenCount =
    group.companies.length > 6 && !expanded
      ? group.companies.length - 6
      : 0

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: `${color}1F`,
              color,
              border: `1px solid ${color}40`,
            }}
          >
            {group.kind}
          </span>
          <h4 className="text-[13.5px] font-semibold text-white leading-snug">
            {group.title}
          </h4>
        </div>
        <span
          className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-medium"
          style={{
            background:
              group.status === 'expected'
                ? 'rgba(245, 158, 11, 0.12)'
                : 'rgba(52, 211, 153, 0.12)',
            color:
              group.status === 'expected' ? '#F59E0B' : '#34D399',
            border:
              group.status === 'expected'
                ? '1px solid rgba(245, 158, 11, 0.25)'
                : '1px solid rgba(52, 211, 153, 0.25)',
          }}
        >
          {calendarCopy.status[group.status]}
        </span>
      </div>

      <div className="space-y-1">
        {displayCompanies.map((company) => {
          const inPortfolio = selectedDayMatchedTickers.has(company.ticker)
          return (
            <button
              key={company.ticker}
              onClick={() =>
                logAnalyticsEvent('calendar_company_click', {
                  ticker: company.ticker,
                  kind: group.kind,
                  in_portfolio: inPortfolio,
                })
              }
              className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors pointer-events-auto"
              style={{
                background: inPortfolio
                  ? 'rgba(0, 212, 255, 0.05)'
                  : 'transparent',
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: inPortfolio ? '#00D4FF' : color,
                  boxShadow: inPortfolio
                    ? '0 0 6px rgba(0, 212, 255, 0.4)'
                    : 'none',
                }}
              />
              <span className="text-sm text-[#D1D5DB] flex-1 truncate">
                {company.name}
              </span>
              {inPortfolio && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    background: 'rgba(0, 212, 255, 0.12)',
                    color: '#00D4FF',
                    border: '1px solid rgba(0, 212, 255, 0.2)',
                  }}
                >
                  {calendarCopy.portfolioBadge}
                </span>
              )}
              <span className="text-xs text-[#6B7280] font-mono tabular-nums">
                {company.ticker}
              </span>
            </button>
          )
        })}

        {hiddenCount > 0 && (
          <button
            onClick={onToggle}
            className="text-xs text-[#9CA3AF] hover:text-white transition-colors pointer-events-auto mt-1"
          >
            {calendarCopy.expand(hiddenCount)}
          </button>
        )}
        {group.companies.length > 6 && expanded && (
          <button
            onClick={onToggle}
            className="text-xs text-[#9CA3AF] hover:text-white transition-colors pointer-events-auto mt-1"
          >
            {calendarCopy.collapse}
          </button>
        )}
      </div>
    </>
  )
}

/* ── Card wrapper ─────────────────────────────────────────────────────────── */

function CalendarCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6 md:p-8 relative overflow-hidden"
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div
        className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(0, 212, 255, 0.3), transparent)',
        }}
      />
      {children}
    </div>
  )
}

/* ── Not loaded placeholder ───────────────────────────────────────────────── */

function CalendarNotLoaded() {
  return (
    <CalendarCard>
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background:
              'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(52, 211, 153, 0.1))',
            border: '1px solid rgba(0, 212, 255, 0.2)',
          }}
        >
          <CalendarDays size={16} style={{ color: '#00D4FF' }} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">
            {calendarCopy.title}
          </h2>
          <p className="text-xs text-[#6B7280]">{calendarCopy.subtitle}</p>
        </div>
      </div>

      <div
        className="flex flex-col items-center justify-center gap-3 py-12 rounded-xl"
        style={{
          background: 'rgba(255, 255, 255, 0.015)',
          border: '1px dashed rgba(255, 255, 255, 0.08)',
        }}
      >
        <CalendarDays size={32} style={{ color: '#6B7280', opacity: 0.6 }} />
        <p className="text-sm text-[#9CA3AF]">{calendarCopy.notLoaded}</p>
      </div>
    </CalendarCard>
  )
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

function CalendarSkeleton() {
  return (
    <CalendarCard>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg animate-pulse"
            style={{ background: 'rgba(255, 255, 255, 0.06)' }}
          />
          <div className="space-y-2">
            <div
              className="h-5 w-32 rounded animate-pulse"
              style={{ background: 'rgba(255, 255, 255, 0.06)' }}
            />
            <div
              className="h-3 w-52 rounded animate-pulse"
              style={{ background: 'rgba(255, 255, 255, 0.06)' }}
            />
          </div>
        </div>
        <div
          className="h-9 w-28 rounded-xl animate-pulse"
          style={{ background: 'rgba(255, 255, 255, 0.06)' }}
        />
      </div>

      <div className="flex gap-2 pb-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl animate-pulse"
            style={{
              width: 58,
              height: 58,
              background: 'rgba(255, 255, 255, 0.06)',
            }}
          />
        ))}
      </div>

      <div className="flex gap-2 pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-20 rounded-full animate-pulse"
            style={{ background: 'rgba(255, 255, 255, 0.06)' }}
          />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl animate-pulse"
            style={{ background: 'rgba(255, 255, 255, 0.06)' }}
          />
        ))}
      </div>
    </CalendarCard>
  )
}
