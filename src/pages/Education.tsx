import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { ArrowLeft, GraduationCap, Share2 } from 'lucide-react'
import { fetchVitrine } from '@/lib/educationApi'
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

const BADGE_LABEL: Record<string, string> = {
  new: 'Новый',
  popular: 'Популярный',
  recommended: 'Рекомендуем',
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

function CourseCard({ course, index }: { course: VitrineCourse; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.05, ease: easeOutExpo }}
    >
      <Link
        to={`/education/${course.slug}`}
        className="block rounded-2xl overflow-hidden transition-all hover:brightness-110"
        style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}
      >
        {course.cover_url ? (
          <img
            src={course.cover_url}
            alt={course.title}
            className="w-full block object-cover"
            style={{ aspectRatio: '16/9', filter: 'saturate(.92)' }}
            loading="lazy"
          />
        ) : (
          <div
            className="w-full"
            style={{ aspectRatio: '16/9', background: 'linear-gradient(135deg, hsl(200 55% 14%), hsl(240 45% 22%))' }}
          />
        )}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {course.badges.slice(0, 2).map(b => (
              <span
                key={b}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  background: 'rgba(0,212,255,.08)',
                  border: '1px solid rgba(0,212,255,.25)',
                  color: '#00D4FF',
                }}
              >
                {BADGE_LABEL[b] || b}
              </span>
            ))}
            <span className="text-[10px] text-[#6B7280]">{SIZE_LABEL[course.size] || 'Курс'}</span>
          </div>
          <div className="text-[14px] font-medium text-white leading-snug mb-2 line-clamp-2">
            {course.title}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
            <span>{course.lessons_count > 0 ? `${course.lessons_count} уроков` : course.author || ''}</span>
            <span className="text-white font-semibold">
              {course.price > 0 ? `${course.price.toLocaleString('ru-RU')} ₽` : 'бесплатно'}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function Shelf({ title, hint, courses }: { title: string; hint?: string; courses: VitrineCourse[] }) {
  if (courses.length === 0) return null
  return (
    <section className="max-w-[1200px] mx-auto px-6 md:px-12 mb-12 w-full">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-2 h-2 rounded-full flex-none" style={{ background: '#00D4FF' }} />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {hint && <p className="text-[12px] text-[#6B7280] pl-[18px] mb-5">{hint}</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {courses.map((c, i) => (
          <CourseCard key={c.id} course={c} index={i} />
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
  const { isLoggedIn } = useAuth()

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
          <Shelf title="По горячим следам" hint="Ситуационные мини-курсы по актуальным событиям" courses={data.shelves.hot} />
          <Shelf title="Рекомендуем" courses={data.shelves.recommended} />
          <Shelf title="Новое" courses={data.shelves.fresh} />
          <Shelf title="Все курсы" courses={data.catalog} />
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
