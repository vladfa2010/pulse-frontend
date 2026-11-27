/**
 * =============================================================================
 * PULSE — Страница «Повторение» выделений (ТЗ-237, этап 3, задача 10)
 * =============================================================================
 *
 * /education/review (маршрут ВЫШЕ /education/:slug — App.tsx). Две вкладки:
 * «Сегодня» — до 5 карточек из GET /review/today (самые давно не
 * повторявшиеся): цитата → скрытая заметка («Показать заметку») → «Помню»
 * (POST /review/seen, карточка уходит) / «Открыть в уроке» (?hl=).
 * «Все заметки» (?tab=all) — полный список с фильтром по курсу.
 * Вёрстка карточек — §2.9. Пуш крона ведёт сюда с utm → review_push_open.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Brain, Eye, GraduationCap } from 'lucide-react'
import {
  fetchReviewToday,
  markReviewSeen,
  fetchHighlights,
  type ReviewCard,
  type Highlight,
} from '@/lib/educationApi'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { logAnalyticsEvent } from '@/lib/analytics'

type Tab = 'today' | 'all'

function ReviewCardView({ card, onRemember }: { card: ReviewCard; onRemember: (id: string) => void }) {
  const [noteShown, setNoteShown] = useState(false)
  const [busy, setBusy] = useState(false)

  // review_card_seen — один раз на монтирование карточки (задача 11)
  useEffect(() => {
    logAnalyticsEvent('review_card_seen', { highlight_id: card.id })
  }, [card.id])

  const remember = async () => {
    if (busy) return
    setBusy(true)
    try {
      await markReviewSeen(card.id)
      onRemember(card.id)
    } catch { /* карточка останется — повтор по следующему тапу */ }
    finally { setBusy(false) }
  }

  return (
    <div className="rounded-2xl p-[18px]" style={{ background: '#ffffff05', border: '1px solid rgba(255,255,255,.06)' }}>
      <div className="text-[10.5px] uppercase tracking-[.08em] text-[#9CA3AF] mb-2">
        {card.course_title} · {card.lesson_title}
      </div>
      <div className="text-[15px] leading-[1.55] text-white mb-3">«{card.exact_text}»</div>
      {card.note && (
        noteShown ? (
          <div
            className="text-[13px] text-[#D1D5DB] mb-3 px-3.5 py-3 rounded-[11px]"
            style={{ border: '1px solid rgba(0,212,255,.35)', background: 'rgba(0,212,255,.05)' }}
          >
            {card.note}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNoteShown(true)}
            className="w-full text-left text-[13px] text-[#9CA3AF] mb-3 px-3.5 py-3 rounded-[11px]"
            style={{ border: '1px dashed #33383F' }}
          >
            Показать заметку
          </button>
        )
      )}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => void remember()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
          style={{ background: '#00D4FF', color: '#060606' }}
        >
          <Brain size={14} /> {busy ? '…' : 'Помню'}
        </button>
        <Link
          to={`/education/lesson/${card.lesson_id}?hl=${card.id}`}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors hover:border-[#00D4FF] hover:text-[#00D4FF]"
          style={{ border: '1px solid #222222', color: '#9CA3AF' }}
        >
          Открыть в уроке
        </Link>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const { isLoggedIn } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'all' ? 'all' : 'today'

  const [cards, setCards] = useState<ReviewCard[] | null>(null)
  const [all, setAll] = useState<Highlight[] | null>(null)
  const [courseFilter, setCourseFilter] = useState<string>('')

  // review_push_open — заход по пушу крона (utm в URL, задача 11)
  useEffect(() => {
    if (params.get('utm_campaign') === 'lesson_review') {
      logAnalyticsEvent('review_push_open', { source: params.get('utm_source') || 'push' })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLoggedIn) return
    try {
      fetchReviewToday()
        .then(d => setCards(Array.isArray(d?.cards) ? d.cards : []))
        .catch(() => setCards([]))
    } catch { setCards([]) }
  }, [isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn) return
    // приёмка F4: грузим и на табе «Сегодня» — иначе пустое состояние
    // «хайлайтов нет вообще» недостижимо (задача 10.4)
    try {
      fetchHighlights({ limit: 200 })
        .then(d => setAll(Array.isArray(d?.items) ? d.items : []))
        .catch(() => setAll([]))
    } catch { setAll([]) }
  }, [isLoggedIn, tab])

  const handleRemember = useCallback((id: string) => {
    setCards(prev => (prev ? prev.filter(c => c.id !== id) : prev))
  }, [])

  const courses = useMemo(() => {
    const m = new Map<string, string>()
    for (const h of all || []) m.set(h.course_slug, h.course_title)
    return [...m.entries()]
  }, [all])

  const filteredAll = useMemo(
    () => (all || []).filter(h => !courseFilter || h.course_slug === courseFilter),
    [all, courseFilter],
  )

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="text-center max-w-sm">
          <GraduationCap size={40} className="mx-auto mb-4 text-[#4B5563]" />
          <h1 className="text-xl font-semibold text-white mb-2">Повторение выделений</h1>
          <p className="text-sm text-[#9CA3AF] mb-6">Войдите, чтобы повторять свои выделения и заметки.</p>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="rounded-full px-6 py-2.5 text-sm font-semibold"
            style={{ background: '#00D4FF', color: '#060606' }}
          >
            Войти
          </button>
        </div>
      </div>
    )
  }

  const setTab = (t: Tab) => {
    if (t === 'all') params.set('tab', 'all')
    else params.delete('tab')
    setParams(params, { replace: true })
  }

  return (
    <div className="min-h-screen px-4 md:px-6 pt-24 pb-16 max-w-[760px] mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Повторение выделений</h1>
      <p className="text-sm text-[#9CA3AF] mb-6">Короткий ежедневный повтор — цитаты, которые вы сохраняли в уроках.</p>

      {/* Табы — §2.8 */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid #1a1a1a' }}>
        {(['today', 'all'] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors"
            style={{
              color: tab === t ? '#FFFFFF' : '#9CA3AF',
              borderBottom: `2px solid ${tab === t ? '#00D4FF' : 'transparent'}`,
              marginBottom: -1,
              background: 'none',
            }}
          >
            {t === 'today' ? 'Сегодня' : 'Все заметки'}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        cards === null ? (
          <p className="text-sm text-[#6B7280]">Загрузка…</p>
        ) : cards.length === 0 ? (
          <div className="text-center py-14">
            <Eye size={32} className="mx-auto mb-3 text-[#4B5563]" />
            <p className="text-sm text-[#9CA3AF]">
              {(all === null || (all && all.length > 0))
                ? 'На сегодня всё. Новые повторения появятся завтра.'
                : 'Выделяйте текст в уроках — здесь появятся повторения.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {cards.map(c => <ReviewCardView key={c.id} card={c} onRemember={handleRemember} />)}
          </div>
        )
      )}

      {tab === 'all' && (
        all === null ? (
          <p className="text-sm text-[#6B7280]">Загрузка…</p>
        ) : all.length === 0 ? (
          <p className="text-sm text-[#9CA3AF]">Выделяйте текст в уроках — цитаты и заметки появятся здесь.</p>
        ) : (
          <>
            {courses.length > 1 && (
              <select
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value)}
                className="mb-4 text-sm px-3 py-2 rounded border bg-transparent outline-none"
                style={{ borderColor: '#222222', color: '#D1D5DB' }}
              >
                <option value="">Все курсы</option>
                {courses.map(([slug, title]) => (
                  <option key={slug} value={slug}>{title}</option>
                ))}
              </select>
            )}
            <div className="flex flex-col gap-2">
              {filteredAll.map(h => (
                <Link
                  key={h.id}
                  to={`/education/lesson/${h.lesson_id}?hl=${h.id}`}
                  className="hl-note-item transition-colors hover:border-[#2e2e2e]"
                >
                  <span className="bar" />
                  <span className="flex-1 min-w-0">
                    <span className="q">{h.exact_text}</span>
                    {h.note && <span className="n">📝 <span>{h.note}</span></span>}
                    <span className="block text-[11px] text-[#9CA3AF] mt-1">{h.course_title} · {h.lesson_title}</span>
                  </span>
                </Link>
              ))}
            </div>
          </>
        )
      )}
    </div>
  )
}
