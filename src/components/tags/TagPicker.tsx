/**
 * =============================================================================
 * ТЗ-201 — TagPicker: компактный выбор тегов портфеля (блок внутри урока)
 * =============================================================================
 *
 * Логика повторяет поиск на главной (Home.tsx): дебаунс 200 мс,
 * GET /tags/search?q=, исключение уже выбранных, счётчик лимита по тарифу
 * (/plans + getEffectiveTagLimit). Home НЕ рефакторится — там пикер
 * переплетён с хиро-секцией; блок урока живёт самостоятельным компонентом.
 *
 * Заморозка (ТЗ-110) — per-tag is_frozen в portfolio: замороженные пилюли
 * без кнопки удаления; при наличии замороженных добавление заблокировано
 * до разруливания лимита (как FreezeTagsBanner на главной).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Loader2, Lock, Search, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { getEffectiveTagLimit, type PlanRef } from '@/lib/subscription'
import { logAnalyticsEvent } from '@/lib/analytics'
import Tag from '@/components/Tag'

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

interface Suggestion {
  id: string
  label: string
  type: 'company' | 'sector' | 'person' | 'trend'
}

interface TagPickerProps {
  /** Компактный режим — для блока в уроке (меньше отступы/размеры) */
  compact?: boolean
  /** Колбэк после успешного add/remove (аналитика у блока) */
  onChanged?: (action: 'add' | 'remove', tagId: string) => void
}

export default function TagPicker({ compact = false, onChanged }: TagPickerProps) {
  const { user, portfolio, addTag, removeTag } = useAuth()
  const [searchValue, setSearchValue] = useState('')
  const [searchResults, setSearchResults] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [addTagError, setAddTagError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Debounce: динамический поиск тегов через API (≥ 3 символов, как на главной)
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
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [searchValue])

  // Лимит по тарифу — тот же каталог /plans, что и на главной
  const [plans, setPlans] = useState<PlanRef[]>([])
  useEffect(() => {
    let cancelled = false
    api.get('/plans')
      .then(data => {
        if (cancelled) return
        setPlans((data?.plans || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          tagLimit: p.tag_limit ?? p.tagLimit ?? 3,
        })))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const tagLimit = getEffectiveTagLimit(user, plans)
  const frozenCount = useMemo(() => portfolio.filter(t => t.is_frozen).length, [portfolio])
  const hasFrozen = frozenCount > 0
  const limitReached = tagLimit !== null && portfolio.length >= tagLimit
  const addBlocked = hasFrozen || limitReached

  const filteredSuggestions = searchResults.filter(
    s => !portfolio.some(t => t.tag_id === s.id),
  )

  const handleSelect = async (s: Suggestion) => {
    if (addBlocked) return
    setAddTagError(null)
    setIsAddingTag(true)
    try {
      const result = await addTag({ tagId: s.id, tagName: s.label, tagType: s.type })
      if (result.success) {
        logAnalyticsEvent('subscribe_tag', { tag_id: s.id, tag_name: s.label, tag_type: s.type, source: 'lesson_tag_block' })
        setSearchValue('')
        onChanged?.('add', s.id)
      } else {
        setAddTagError(result.error || 'Не удалось добавить тег')
      }
    } finally {
      setIsAddingTag(false)
    }
  }

  const handleRemove = async (tagId: string) => {
    const ok = await removeTag(tagId)
    if (ok) {
      logAnalyticsEvent('unsubscribe_tag', { tag_id: tagId })
      onChanged?.('remove', tagId)
    } else {
      setAddTagError('Не удалось удалить тег')
    }
  }

  const pillH = compact ? 'h-9' : 'h-11'

  return (
    <div className="w-full">
      {/* Поиск */}
      <div
        className={`relative flex items-center w-full ${pillH} rounded-xl transition-all duration-200`}
        style={{
          backgroundColor: '#0E0E0E',
          border: isFocused ? '1px solid #00D4FF' : '1px solid #222222',
          boxShadow: isFocused
            ? '0 0 8px rgba(0, 212, 255, 0.8), 0 0 24px rgba(0, 212, 255, 0.5), 0 0 48px rgba(0, 212, 255, 0.15)'
            : 'none',
          opacity: addBlocked ? 0.6 : 1,
        }}
      >
        <Search size={16} className="absolute left-3.5 text-text-muted flex-shrink-0" />
        <input
          ref={searchRef}
          type="text"
          value={searchValue}
          disabled={isAddingTag || addBlocked}
          onChange={e => setSearchValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSearchValue('')
          }}
          className="w-full h-full bg-transparent text-sm text-text-primary placeholder-text-muted pl-10 pr-10 rounded-xl focus:outline-none disabled:opacity-50"
          placeholder={isAddingTag ? 'Добавляем тег...' : 'Компания, сектор, личность или тренд...'}
          aria-label="Поиск тега"
        />
        {searchValue && !isAddingTag && (
          <button
            onClick={() => setSearchValue('')}
            className="absolute right-3 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Очистить"
          >
            <X size={15} />
          </button>
        )}
        {isAddingTag && (
          <Loader2 size={15} className="absolute right-3 animate-spin text-cyan-accent" />
        )}
      </div>

      {/* Дропдаун результатов */}
      <AnimatePresence>
        {isFocused && searchValue.trim().length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="mt-2 rounded-xl overflow-hidden z-50"
            style={{ backgroundColor: '#0E0E0E', border: '1px solid #222222' }}
          >
            {searching && (
              <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ color: '#6B7280' }}>
                <Loader2 size={13} className="animate-spin" />
                <span className="text-xs">Поиск...</span>
              </div>
            )}
            {!searching && filteredSuggestions.map((s) => (
              <button
                key={s.id}
                onMouseDown={() => handleSelect(s)}
                className="w-full min-h-[40px] flex items-center gap-3 px-3.5 py-2 text-left hover:bg-bg-hover transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: typeColors[s.type] || '#00D4FF' }}
                />
                <span className="text-sm text-text-primary">{s.label}</span>
                <span className="ml-auto text-xs text-text-muted">{typeLabels[s.type]}</span>
              </button>
            ))}
            {!searching && filteredSuggestions.length === 0 && (
              <div className="px-3.5 py-2.5 text-xs text-text-muted">Ничего не найдено</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ошибка add/remove */}
      {addTagError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs mt-2" style={{ backgroundColor: '#EF444415', border: '1px solid #EF444430', color: '#EF4444' }}>
          <AlertCircle size={13} />
          <span>{addTagError}</span>
          <button onClick={() => setAddTagError(null)} className="ml-auto" style={{ color: '#EF444480' }} aria-label="Закрыть">✕</button>
        </div>
      )}

      {/* Пилюли портфеля */}
      {portfolio.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {portfolio.map(tag => (
            <div key={tag.tag_id} className="flex items-center">
              {tag.is_frozen ? (
                <div
                  className="inline-flex items-center gap-1.5 h-6 pl-2.5 pr-2.5 rounded-pill text-xs font-medium"
                  style={{ backgroundColor: '#161616', border: '1px solid #333333', color: '#9CA3AF' }}
                  title="Тег заморожен — разморозка после восстановления тарифа"
                >
                  <Lock size={10} style={{ color: '#6B7280' }} />
                  <span className="truncate max-w-[clamp(72px,25vw,150px)]">{tag.tag_name}</span>
                </div>
              ) : (
                <Tag
                  label={tag.tag_name}
                  type={(tag.tag_type as 'company' | 'sector' | 'person' | 'trend') || 'company'}
                  onRemove={() => handleRemove(tag.tag_id)}
                  enriching={!tag.enriched}
                  small
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Счётчик лимита / заморозка */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {hasFrozen && (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.25)', color: '#FBBF24' }}>
            <Lock size={11} />
            {frozenCount} {frozenCount === 1 ? 'тег заморожен' : 'тега заморожено'} — <Link to="/" className="underline hover:opacity-80">разобраться на главной</Link>
          </span>
        )}
        {!hasFrozen && tagLimit !== null && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: limitReached ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 212, 255, 0.1)',
              border: `1px solid ${limitReached ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 212, 255, 0.2)'}`,
              color: limitReached ? '#EF4444' : '#00D4FF',
            }}
          >
            {portfolio.length}/{tagLimit}
          </span>
        )}
        {limitReached && !hasFrozen && (
          <span className="text-xs text-text-muted">
            Лимит тегов исчерпан — <Link to="/pricing" className="text-cyan-accent underline hover:opacity-80">обновите тариф</Link>
          </span>
        )}
      </div>
    </div>
  )
}
