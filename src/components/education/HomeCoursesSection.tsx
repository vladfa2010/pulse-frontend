/**
 * =============================================================================
 * PULSE — Главная: секция образования (ТЗ-226)
 * =============================================================================
 *
 * Четыре подсекции, каждая скрыта при пустом ответе/404 (флаг
 * EDUCATION_MATCH_ENABLED выключен = 404 → блока нет, без заглушок):
 *   1. «Продолжить обучение»   — только variant='auth': /education/my без
 *      via_path и пройденных, топ-3 по last_activity (ТЗ-105 v2 / ТЗ-126 /
 *      ТЗ-154). CTA → страница урока next_lesson_id (гейт доступа там, ТЗ-149).
 *      Компактная карточка — не CourseCard: /my не отдаёт meta-поля карточки
 *      (minutes/students), а расширять горячий контур ТЗ-105 v2 ради главной
 *      не будем (решение при реализации ТЗ-226).
 *   2. «Под сегодняшние новости» — оба variant: /home/today-courses
 *      (подтверждённые связи news_course_links за 48 ч; у авторизованного
 *      персонально по тегам портфеля). Причина-подпись + чипы matched_tags.
 *   3. «Под события календаря» — оба variant: /calendar-today (ТЗ-103 v2),
 *      до 3 событий; у авторизованного события с пересечением tag_ids ∩ теги
 *      портфеля — первыми, с пометкой «из твоего портфеля». Курсы берём из
 *      matched_courses ответа — повторный fetchCoursesForEvent из ТЗ не делаем:
 *      тот же источник, лишний fetch на главной (4-й запрос вместо 4+N).
 *   4. «Популярное на платформе» — оба variant: витрина shelves.hot (топ-4),
 *      бейдж «новый» для slug из shelves.fresh.
 *
 * Аналитика: home_courses_*_click {slug} и home_courses_section_view
 * (один раз за маунт, IntersectionObserver). Вся секция — null, если пусты
 * все подсекции. Рельсы — CSS .row-scroll (паттерн NewsFeed ТЗ-214).
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Play, ArrowRight, CalendarDays } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchMyCourses,
  fetchHomeTodayCourses,
  fetchCalendarToday,
  fetchVitrine,
  type MyCourse,
  type TodayCoursesResponse,
  type CalendarTodayEvent,
  type MatchedCourse,
  type VitrineCourse,
} from '@/lib/educationApi'
import CourseCard, { type CourseCardData } from '@/components/CourseCard'
import MatchedCourseChips from './MatchedCourseChips'
import { eventKindColor, moscowDateString, relDayLabel } from '@/lib/educationMatch'
import { logAnalyticsEvent } from '@/lib/analytics'
import { resolveMediaUrl } from '@/lib/media'

const SECTION_CLASS = 'max-w-[1200px] mx-auto px-6 md:px-12 mb-12 w-full'

// Палитра чипов — как в PopularTagsSlider (DESIGN_SYSTEM.md); у today-courses
// имена тегов без типа, берём нейтральный «компания» (cyan).
const CHIP_COLOR = '#00D4FF'

function SectionHeader({ title, linkTo, linkLabel }: { title: string; linkTo?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-1">
      <span className="w-2 h-2 rounded-full flex-none" style={{ background: '#00D4FF' }} />
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {linkTo && (
        <Link
          to={linkTo}
          className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-white transition-colors"
        >
          {linkLabel}
          <ArrowRight size={13} />
        </Link>
      )}
    </div>
  )
}

// last_activity (ISO из БД) → «сегодня» / «вчера» / «N дн назад» / дата.
function relActivity(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = (x: Date) => x.toDateString()
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (day(d) === day(now)) return 'сегодня'
  if (diffDays === 1) return 'вчера'
  if (diffDays > 1 && diffDays < 30) return `${diffDays} дн назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

// ─── Подсекция 1: «Продолжить обучение» (только авторизованный) ────────────

function ContinueBlock() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<MyCourse[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchMyCourses()
      .then(d => {
        if (cancelled) return
        const list = (d.courses || [])
          .filter(c => !c.via_path && c.next_lesson_id)
          .sort((a, b) => {
            if (!a.last_activity && !b.last_activity) return 0
            if (!a.last_activity) return 1
            if (!b.last_activity) return -1
            return b.last_activity.localeCompare(a.last_activity)
          })
          .slice(0, 3)
        setCourses(list)
      })
      .catch(() => { if (!cancelled) setCourses([]) })
    return () => { cancelled = true }
  }, [])

  if (!courses || courses.length === 0) return null

  return (
    <section className={SECTION_CLASS}>
      <SectionHeader title="Продолжить обучение" linkTo="/education" linkLabel="Моё обучение" />
      <div className="row-scroll">
        {courses.map(c => (
          <div key={c.slug} className="relative">
            <Link
              to={`/education/${c.slug}`}
              className="block rounded-2xl p-4 transition-all hover:brightness-125"
              style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                {c.cover_url ? (
                  <img
                    src={resolveMediaUrl(c.cover_url)}
                    alt={c.title}
                    loading="lazy"
                    className="w-12 h-12 rounded-xl object-cover flex-none"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl flex-none" style={{ background: 'rgba(255,255,255,.04)' }} />
                )}
                <span className="flex-1 min-w-0 text-[14px] font-medium text-white leading-snug line-clamp-2">
                  {c.title}
                </span>
              </div>
              {c.progress.percent > 0 && (
                <div className="h-1 rounded-full mb-2 overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
                  <div className="h-full rounded-full" style={{ width: `${c.progress.percent}%`, background: '#00D4FF' }} />
                </div>
              )}
              <div className="text-[11px] text-[#6B7280]">
                Урок {c.progress.completed_lessons + 1} из {c.progress.total_lessons}
                {c.last_activity ? ` · ${relActivity(c.last_activity)}` : ''}
              </div>
            </Link>
            {/* CTA поверх карточки-Link: preventDefault + stopPropagation (паттерн
                edu-card-share в CourseCard) — уводит сразу на урок, минуя страницу курса */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                logAnalyticsEvent('home_courses_continue_click', { slug: c.slug })
                navigate(`/education/lesson/${c.next_lesson_id}`)
              }}
              className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-black transition-all hover:brightness-110"
              style={{ background: '#00D4FF' }}
            >
              <Play size={11} />
              Продолжить
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Подсекция 2: «Под сегодняшние новости» (оба variant) ──────────────────

function TodayCoursesBlock() {
  const [data, setData] = useState<TodayCoursesResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchHomeTodayCourses()
      .then(d => { if (!cancelled) setData(d && Array.isArray(d.courses) ? d : null) })
      .catch(() => { if (!cancelled) setData(null) }) // 404 (флаг выкл) — блок скрыт
    return () => { cancelled = true }
  }, [])

  if (!data || data.courses.length === 0) return null

  return (
    <section className={SECTION_CLASS}>
      <SectionHeader title="Под сегодняшние новости" />
      <div className="row-scroll">
        {data.courses.map(c => (
          <Link
            key={c.slug}
            to={`/education/${c.slug}`}
            onClick={() => logAnalyticsEvent('home_courses_today_click', { slug: c.slug })}
            className="block rounded-2xl p-4 transition-all hover:brightness-125"
            style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}
          >
            <div className="flex items-center gap-3">
              {c.cover_url ? (
                <img
                  src={resolveMediaUrl(c.cover_url)}
                  alt={c.title}
                  loading="lazy"
                  className="w-12 h-12 rounded-xl object-cover flex-none"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl flex-none" style={{ background: 'rgba(255,255,255,.04)' }} />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-white leading-snug line-clamp-2 mb-1">
                  {c.title}
                </div>
                <div className="text-[11px] text-[#6B7280]">
                  {c.price > 0 ? `${c.price.toLocaleString('ru-RU')} ₽` : 'бесплатно'}
                </div>
              </div>
            </div>
            <div className="flex items-center flex-wrap gap-1.5 mt-3">
              <span className="text-[10px] text-[#6B7280]">
                {data.personalized ? 'в твоих новостях' : 'в новостях сегодня'}
                {c.news_count > 1 ? ` · ${c.news_count} новости` : ''}
              </span>
              {(c.matched_tags || []).map(t => (
                <span
                  key={t}
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{ color: CHIP_COLOR, border: `1px solid ${CHIP_COLOR}33`, background: `${CHIP_COLOR}0d` }}
                >
                  {t}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ─── Подсекция 3: «Под события календаря» (оба variant) ────────────────────

function EventCoursesBlock({ variant }: { variant: 'auth' | 'guest' }) {
  const { portfolio } = useAuth()
  const [events, setEvents] = useState<CalendarTodayEvent[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCalendarToday()
      .then(d => {
        if (cancelled) return
        let list = (Array.isArray(d?.events) ? d.events : []).slice(0, 3)
        if (variant === 'auth' && portfolio.length > 0) {
          // «Мои» события — с пересечением tag_ids ∩ теги портфеля, первыми
          const mine = list.filter(ev => (ev.tag_ids || []).some(id => portfolio.some(p => p.tag_id === id)))
          const rest = list.filter(ev => !(ev.tag_ids || []).some(id => portfolio.some(p => p.tag_id === id)))
          list = [...mine, ...rest]
        }
        setEvents(list)
      })
      .catch(() => { if (!cancelled) setEvents([]) }) // 404 (флаг выкл) — блок скрыт
    return () => { cancelled = true }
  }, [variant, portfolio])

  if (!events || events.length === 0) return null

  const today = moscowDateString()

  return (
    <section className={SECTION_CLASS}>
      <SectionHeader title="Под события календаря" linkTo="/#investor-calendar" linkLabel="Весь календарь" />
      <p className="text-[12px] text-[#6B7280] pl-[18px] mb-5">
        События ближайших двух дней, к которым можно подготовиться
      </p>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {events.map((ev, i) => {
          const color = eventKindColor(ev.kind)
          const rel = relDayLabel(ev.date, today)
          const commonTags = variant === 'auth'
            ? portfolio.filter(p => (ev.tag_ids || []).includes(p.tag_id)).map(p => p.tag_name)
            : []
          const courses: MatchedCourse[] = ev.matched_courses || []
          if (courses.length === 0) return null
          return (
            <div
              key={`${ev.date}:${ev.kind}:${ev.ticker || i}:${i}`}
              className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays size={13} style={{ color }} />
                <span className="text-[13px] font-medium text-white truncate flex-1">{ev.title}</span>
              </div>
              <div className="flex items-center flex-wrap gap-1.5 mb-3 pl-[21px]">
                <span className="text-[10px]" style={{ color }}>
                  {rel || new Date(`${ev.date.slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                </span>
                {commonTags.length > 0 && (
                  <>
                    <span className="text-[10px] text-[#6B7280]">· из твоего портфеля</span>
                    {commonTags.slice(0, 3).map(t => (
                      <span
                        key={t}
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{ color: CHIP_COLOR, border: `1px solid ${CHIP_COLOR}33`, background: `${CHIP_COLOR}0d` }}
                      >
                        {t}
                      </span>
                    ))}
                  </>
                )}
              </div>
              <div className="pl-[21px]">
                <MatchedCourseChips
                  courses={courses}
                  caption="Подготовиться"
                  onCourseClick={(slug) => logAnalyticsEvent('home_courses_event_click', { slug, kind: ev.kind })}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Подсекция 4: «Популярное на платформе» (оба variant) ──────────────────

function PopularCoursesBlock() {
  const [hot, setHot] = useState<VitrineCourse[] | null>(null)
  const [freshSlugs, setFreshSlugs] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    fetchVitrine('all')
      .then(d => {
        if (cancelled) return
        setHot((d?.shelves?.hot || []).slice(0, 4))
        setFreshSlugs(new Set((d?.shelves?.fresh || []).map(c => c.slug)))
      })
      .catch(() => { if (!cancelled) setHot([]) })
    return () => { cancelled = true }
  }, [])

  if (!hot || hot.length === 0) return null

  return (
    <section className={SECTION_CLASS}>
      <SectionHeader title="Популярное на платформе" linkTo="/education" linkLabel="Витрина" />
      <div className="row-scroll">
        {hot.map((c, i) => {
          const course: CourseCardData = {
            ...c,
            badges: freshSlugs.has(c.slug) && !c.badges.includes('new')
              ? [...c.badges, 'new']
              : c.badges,
          }
          return (
            <div key={c.slug} onClick={() => logAnalyticsEvent('home_courses_popular_click', { slug: c.slug })}>
              <CourseCard course={course} index={i} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Секция-обёртка ─────────────────────────────────────────────────────────

export default function HomeCoursesSection({ variant }: { variant: 'auth' | 'guest' }) {
  const ref = useRef<HTMLDivElement>(null)
  const viewedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      logAnalyticsEvent('home_courses_section_view', { variant })
      return
    }
    const rootEl = el // для tryLog: сужение типа не протекает в hoisted-функцию
    const obs = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) tryLog()
    }, { threshold: 0.2 })
    // Подсекции приезжают асинхронно: если контент появился ПОСЛЕ первого
    // срабатывания IO (wrapper уже во вьюпорте, новых intersection-событий
    // не будет) — ловим монтирование подсекций MutationObserver'ом
    const mo = new MutationObserver(() => tryLog())
    mo.observe(rootEl, { childList: true })

    function tryLog() {
      // Подсекции скрыты (пустой ответ/404 флага) → wrapper пустой, section_view
      // за «пустой» просмотр не отправляем (ревью ТЗ-226, замечание 2)
      if (viewedRef.current || !rootEl.querySelector('section')) return
      viewedRef.current = true
      logAnalyticsEvent('home_courses_section_view', { variant })
      obs.disconnect()
      mo.disconnect()
    }

    obs.observe(rootEl)
    return () => { obs.disconnect(); mo.disconnect() }
  }, [variant])

  return (
    <div ref={ref}>
      {variant === 'auth' && <ContinueBlock />}
      <TodayCoursesBlock />
      <EventCoursesBlock variant={variant} />
      <PopularCoursesBlock />
      {/* Гостевой лок-баннер «Войти» вместо блока 1 НЕ делаем (решение
          владельца, ТЗ-226 §4 — регистрации и так три на экране) */}
    </div>
  )
}
