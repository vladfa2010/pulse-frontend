import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { ArrowLeft, GraduationCap, Share2 } from 'lucide-react'
import { fetchMyCourses, fetchVitrine } from '@/lib/educationApi'
import { resolveMediaUrl } from '@/lib/media'
import type { VitrineCourse, VitrineFilter, VitrineResponse } from '@/lib/educationApi'
import { useAuth } from '@/hooks/useAuth'
import CalendarTodayBlock from '@/components/education/CalendarTodayBlock'
import SharePathModal from '@/components/education/SharePathModal'

// Витрина образования (ТЗ-100; блок «Сегодня в календаре» — ТЗ-103 v2).
// Тёмная тема как у страницы курса (cyan #00D4FF). Полки hot/recommended/fresh
// и каталог — по существующему GET /api/education/courses (без параметров).

const easeOutExpo = [0.16, 1, 0.3, 1] as const

const SIZE_LABEL: Record<string, string> = {
  micro: 'Микро-курс',
  standard: 'Курс',
  full: 'Полный курс',
}

// ТЗ-131: маппинг бейджей карточки по мокапу education.html (максимум 2 шт.;
// неизвестные бейджи не рендерим). Ключ класса → { label, kind }.
const BADGE_MAP: Record<string, { label: string; kind: 'new' | 'rec' | 'pop' }> = {
  new: { label: 'Новое', kind: 'new' },
  rec: { label: 'Рекомендуем', kind: 'rec' },
  recommended: { label: 'Рекомендуем', kind: 'rec' },
  pop: { label: 'Популярное', kind: 'pop' },
  popular: { label: 'Популярное', kind: 'pop' },
  hot: { label: 'Популярное', kind: 'pop' },
}

// ТЗ-131: склонения и формат минут для меты карточки («12 уроков · 45 мин · 128 уч.»).
function plural(n: number, one: string, few: string, many: string): string {
  const m = n % 10
  const h = n % 100
  if (m === 1 && h !== 11) return one
  if (m >= 2 && m <= 4 && (h < 10 || h >= 20)) return few
  return many
}

function formatMin(m: number): string {
  if (m <= 0) return '0 мин'
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} ч` : `${h} ч ${r} мин`
}

// ТЗ-126: пилюли фильтров витрины (ТЗ-100 п.2; мокап education.html .pill).
// «Мои курсы» — только для залогиненного.
const FILTERS: Array<{ key: VitrineFilter; label: string; authOnly?: boolean }> = [
  { key: 'all', label: 'Все' },
  { key: 'free', label: 'Бесплатные' },
  { key: 'paid', label: 'Платные' },
  { key: 'hot', label: 'По горячим следам' },
  { key: 'mine', label: 'Мои курсы', authOnly: true },
]

// ТЗ-131: карточка курса 1:1 по мокапу education.html. mine — прогресс
// записи (percent) из /education/my; полоса показывается при percent > 0.
function CourseCard({ course, index, mine, onSelectCategory }: {
  course: VitrineCourse
  index: number
  mine?: number
  onSelectCategory: (cat: { id: string; name: string }) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.05, ease: easeOutExpo }}
    >
      <Link to={`/education/${course.slug}`} className="edu-card">
        <div className="edu-card-cover">
          {course.cover_url ? (
            <img src={resolveMediaUrl(course.cover_url)} alt={course.title} loading="lazy" />
          ) : (
            <div className="edu-card-cover-ph" />
          )}
          <span className={`card-type${course.type === 'situational' ? ' hot' : ''}`}>
            {course.type === 'situational' ? 'Ситуационный' : SIZE_LABEL[course.size] || 'Курс'}
          </span>
          {course.category && (
            <button
              type="button"
              className="card-cat"
              // TODO v10: заменить клиентский фильтр на серверный (?category= уже принимает бэк).
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelectCategory(course.category!)
              }}
            >
              {course.category.name}
            </button>
          )}
        </div>
        <div className="card-body">
          {course.type === 'situational' && course.source?.title && (
            <div className="card-src"><i />по новости: <span>«{course.source.title}»</span></div>
          )}
          <div className="card-title">{course.title}</div>
          <div className="card-meta">
            {course.lessons_count} {plural(course.lessons_count, 'урок', 'урока', 'уроков')}
            {' · '}{formatMin(course.total_minutes)}
            {' · '}{course.students_count} {plural(course.students_count, 'ученик', 'ученика', 'учеников')}
          </div>
          {mine !== undefined && mine > 0 && (
            <div className="progress-line">
              <div className="progress"><i style={{ width: `${mine}%` }} /></div>
              <span className="pct">{mine}%</span>
            </div>
          )}
          {course.visibility === 'hidden' && course.my_enrollment && (
            <>
              <span className="secret-pill">Скрытый курс</span>
              <span className="secret-note">Не виден на витрине — вы записаны администратором</span>
            </>
          )}
          {course.tariff_name && !course.my_enrollment && (
            <div className="card-tariff">или от тарифа {course.tariff_name}</div>
          )}
          <div className="card-foot">
            <span className={`card-price${course.price === 0 ? ' free' : ''}`}>
              {course.price === 0 ? 'Бесплатно' : `${course.price.toLocaleString('ru-RU')} ₽`}
            </span>
            <span className="card-badges">
              {course.badges.slice(0, 2).map(b => {
                const badge = BADGE_MAP[b]
                if (!badge) return null
                return (
                  <span key={b} className={`badge ${badge.kind}`}>
                    <i />{badge.label}
                  </span>
                )
              })}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ТЗ-131: полка — горизонтальная лента 280px-карточек (.row-scroll, мокап
// education.html). Боковые паддинги компенсируем -mx/px (как пилюли фильтров) —
// лента скроллится в край экрана. Пустую полку не рендерим.
function Shelf({ title, hint, courses, pctOf, onSelectCategory }: {
  title: string
  hint?: string
  courses: VitrineCourse[]
  pctOf: (id: string) => number | undefined
  onSelectCategory: (cat: { id: string; name: string }) => void
}) {
  if (courses.length === 0) return null
  return (
    <section className="max-w-[1200px] mx-auto px-6 md:px-12 mb-12 w-full">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-2 h-2 rounded-full flex-none" style={{ background: '#00D4FF' }} />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {hint && <p className="text-[12px] text-[#6B7280] pl-[18px] mb-5">{hint}</p>}
      <div className="row-scroll -mx-6 px-6 md:-mx-12 md:px-12">
        {courses.map((c, i) => (
          <CourseCard key={c.id} course={c} index={i} mine={pctOf(c.id)} onSelectCategory={onSelectCategory} />
        ))}
      </div>
    </section>
  )
}

export default function Education() {
  const [data, setData] = useState<VitrineResponse | null>(null)
  const [failed, setFailed] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [filter, setFilter] = useState<VitrineFilter>('all')
  // ТЗ-131: клиентский фильтр по категории (чип на обложке карточки).
  // TODO v10: заменить на серверный фильтр (?category= бэк уже принимает).
  const [catFilter, setCatFilter] = useState<{ id: string; name: string } | null>(null)
  // ТЗ-131: прогресс «моих» курсов (percent) для полосы на карточках любой полки.
  const [pctMap, setPctMap] = useState<Map<string, number>>(new Map())
  const { isLoggedIn } = useAuth()

  useEffect(() => {
    if (!isLoggedIn) {
      setPctMap(new Map())
      return
    }
    let cancelled = false
    fetchMyCourses()
      .then(list => {
        if (cancelled) return
        setPctMap(new Map(list.map(m => [m.id, m.progress.percent])))
      })
      .catch(() => undefined) // прогресс — украшение; витрина не должна ломаться
    return () => { cancelled = true }
  }, [isLoggedIn])

  // ТЗ-126: разлогин на активном «Мои курсы» — сбрасываем на «Все»
  // (иначе пилюля пропадёт, а фильтр останется mine — рассинхрон).
  useEffect(() => {
    if (!isLoggedIn && filter === 'mine') setFilter('all')
  }, [isLoggedIn, filter])

  useEffect(() => {
    let cancelled = false
    fetchVitrine(filter)
      .then(res => { if (!cancelled) setData(res) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
    // isLoggedIn в deps (ТЗ-106 Задача 2): витрина персонализирована
    // (my_enrollment дочисляется бэкендом по JWT) — после логина рефетчим.
    // filter в deps (ТЗ-126): рефетч при смене пилюли.
  }, [isLoggedIn, filter])

  const pctOf = (id: string) => pctMap.get(id)

  // ТЗ-131: фильтр по категории (клиентский, TODO v10 — серверный).
  const visible = (list: VitrineCourse[]) =>
    catFilter ? list.filter(c => c.category?.id === catFilter.id) : list

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      <div
        className="pt-24 pb-10"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 212, 255, 0.06), transparent)' }}
      >
        <div className="max-w-[1200px] mx-auto px-6 md:px-12">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-white transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              <span>На главную</span>
            </Link>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutExpo }}
            className="text-white font-bold tracking-tight"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.1 }}
          >
            Образование
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: easeOutExpo }}
            className="text-[#9CA3AF] mt-3"
          >
            Курсы PULSE: от мини-курсов по горячим новостям до полных программ
          </motion.p>
          {isLoggedIn && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.14, ease: easeOutExpo }}
              className="mt-6"
            >
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-[12px] font-semibold transition-all hover:brightness-115"
                style={{ background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.25)', color: '#00D4FF' }}
              >
                <Share2 size={14} />
                Поделиться путём
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* ТЗ-126: пилюли фильтров витрины (мокап .pill) — под шапкой, над календарём. */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-12 mb-8 w-full">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 md:-mx-12 md:px-12">
          {FILTERS.filter(f => !f.authOnly || isLoggedIn).map(f => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className="flex-none rounded-full font-semibold transition-all hover:brightness-115"
                style={{
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  background: active ? 'rgba(0,212,255,.1)' : 'rgba(255,255,255,.04)',
                  border: `1px solid ${active ? 'rgba(0,212,255,.4)' : '#222'}`,
                  color: active ? '#00D4FF' : '#9CA3AF',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ТЗ-103: блок календарного мэтчинга над полками (сам скрывается при
          пустом ответе или выключенном фичефлаге). */}
      <CalendarTodayBlock />

      {filter === 'mine' && data && data.catalog.length === 0 ? (
        <section className="max-w-[1200px] mx-auto px-6 md:px-12 mb-20 w-full">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap size={36} className="text-[#4B5563] mb-4" />
            <p className="text-[#9CA3AF] text-sm mb-6">Вы ещё ни на что не записаны. Запишитесь на первый курс</p>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="inline-flex items-center h-10 px-5 rounded-full text-[12px] font-semibold transition-all hover:brightness-115"
              style={{ background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.4)', color: '#00D4FF' }}
            >
              Смотреть каталог
            </button>
          </div>
        </section>
      ) : data ? (
        <>
          {catFilter && (
            <div className="max-w-[1200px] mx-auto px-6 md:px-12 mb-6 w-full">
              <button
                type="button"
                onClick={() => setCatFilter(null)}
                className="inline-flex items-center gap-2 rounded-full text-[12px] font-semibold transition-all hover:brightness-115"
                style={{ padding: '6px 14px', background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.4)', color: '#00D4FF' }}
              >
                {catFilter.name}
                <span style={{ opacity: 0.7 }}>✕</span>
              </button>
            </div>
          )}
          <Shelf title="По горячим следам" hint="Ситуационные мини-курсы по актуальным событиям"
            courses={visible(data.shelves.hot)} pctOf={pctOf} onSelectCategory={setCatFilter} />
          <Shelf title="Рекомендуем" courses={visible(data.shelves.recommended)} pctOf={pctOf} onSelectCategory={setCatFilter} />
          <Shelf title="Новое" courses={visible(data.shelves.fresh)} pctOf={pctOf} onSelectCategory={setCatFilter} />
          <Shelf title="Все курсы" courses={visible(data.catalog)} pctOf={pctOf} onSelectCategory={setCatFilter} />
        </>
      ) : failed ? (
        <section className="max-w-[1200px] mx-auto px-6 md:px-12 mb-20 w-full">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap size={36} className="text-[#4B5563] mb-4" />
            <p className="text-[#9CA3AF] text-sm">Не удалось загрузить витрину. Попробуйте обновить страницу.</p>
          </div>
        </section>
      ) : (
        <section className="max-w-[1200px] mx-auto px-6 md:px-12 mb-20 w-full">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl animate-pulse"
                style={{ height: 220, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}
              />
            ))}
          </div>
        </section>
      )}

      <div className="h-12" />

      <SharePathModal open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  )
}
