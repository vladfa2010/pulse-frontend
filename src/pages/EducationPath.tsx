import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { ArrowLeft, GraduationCap, Loader2, Lock } from 'lucide-react'
import { enrollPath, fetchPath, unenrollPath } from '@/lib/educationApi'
import type { PathDetail } from '@/lib/educationApi'
import { resolveMediaUrl } from '@/lib/media'
import { BASE } from '@/lib/seo'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'

// Страница программы (ТЗ-105 v2) — 1:1 по мокапу program.html.
// Hero (мета, статы, CTA + прогресс) → цепочка курсов по position
// (пилюлы статусов, «следующий курс» подсвечен) → hidden-note для закрытых.
// Тосты — по контракту enroll {enrolled, already, needs_purchase}.

const easeOutExpo = [0.16, 1, 0.3, 1] as const

const SIZE_LABEL: Record<string, string> = {
  micro: 'Микро-курс',
  standard: 'Курс',
  full: 'Полный курс',
}

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

export default function EducationPath() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<PathDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const { isLoggedIn } = useAuth()
  const { toast, toastError } = useToast()

  const reload = useCallback(() => {
    if (!slug) return
    fetchPath(slug)
      .then(setData)
      .catch(() => setFailed(true))
  }, [slug])

  useEffect(() => {
    setData(null)
    setFailed(false)
    reload()
  }, [reload])

  // ТЗ-105 v2: после логина/выхода перечитываем (my* дочисляется бэком по JWT).
  useEffect(() => {
    if (data) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  const handleEnroll = async () => {
    if (!slug || busy) return
    setBusy(true)
    try {
      const res = await enrollPath(slug)
      // Тексты тостов — по правилам ТЗ-105 v2 Задача 5.
      if (res.enrolled.length > 0) {
        const paid = res.needs_purchase.length
        toast(
          paid > 0
            ? `Записаны на ${res.enrolled.length} ${plural(res.enrolled.length, 'курс', 'курса', 'курсов')} · ${paid} ${plural(paid, 'курс платный — доступен по месту', 'курса платных — доступны по месту', 'курсов платных — доступны по месту')}`
            : `Записаны на программу — ${res.enrolled.length} ${plural(res.enrolled.length, 'курс', 'курса', 'курсов')} открыт`,
          'success',
        )
      } else if (res.already.length > 0) {
        toast('Вы уже записаны на программу — курсы на месте', 'info')
      } else {
        toast('Записаны на программу · курсы доступны после покупки', 'success')
      }
      reload()
    } catch (err: any) {
      toastError(err?.message || 'Не удалось записаться на программу')
    } finally {
      setBusy(false)
    }
  }

  const handleUnenroll = async () => {
    if (!slug || busy) return
    setBusy(true)
    try {
      await unenrollPath(slug)
      toast('Вы отписались от программы — записи на курсы и прогресс сохранились', 'info')
      reload()
    } catch (err: any) {
      toastError(err?.message || 'Не удалось отписаться от программы')
    } finally {
      setBusy(false)
    }
  }

  if (failed) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#060606' }}>
        <div className="max-w-[900px] mx-auto px-6 pt-28 pb-20 text-center">
          <GraduationCap size={36} className="text-[#4B5563] mx-auto mb-4" />
          <p className="text-[#9CA3AF] text-sm">Программа не найдена или недоступна.</p>
          <Link to="/education" className="inline-flex items-center gap-2 mt-6 text-[12px] font-semibold uppercase" style={{ color: '#00D4FF' }}>
            <ArrowLeft size={14} /> Образование
          </Link>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ backgroundColor: '#060606' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#00D4FF' }} />
      </div>
    )
  }

  const my = data.my
  const nextItem = my?.next_slug ? data.items.find(i => i.slug === my.next_slug) : undefined

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#060606' }}>
      <Helmet>
        <title>{data.title} — программа PULSE Образование</title>
        <meta name="description" content={data.description || `Программа «${data.title}» — ${data.courses_count} курсов, ${data.total_lessons} уроков.`} />
        <link rel="canonical" href={`${BASE}/education/paths/${data.slug}`} />
      </Helmet>

      <div className="max-w-[900px] mx-auto px-6 pb-20 pt-24">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <Link
            to="/education"
            className="inline-flex items-center gap-2 mb-5 text-[12px] font-semibold uppercase text-[#9CA3AF] hover:text-[#00D4FF] transition-colors"
          >
            <ArrowLeft size={14} />
            Образование
          </Link>
        </motion.div>

        {/* Hero (мокап .hero): плашка «Программа», H1, описание, статы, CTA-ряд. */}
        <motion.div
          className="path-hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOutExpo }}
        >
          <span className="path-kind-lg">Программа</span>
          <h1>{data.title}</h1>
          {data.description && <p className="path-desc">{data.description}</p>}
          <div className="path-stats">
            <div className="path-stat"><b>{data.courses_count}</b><span>курса</span></div>
            <div className="path-stat"><b>{data.total_lessons}</b><span>уроков</span></div>
            <div className="path-stat"><b>≈{formatMin(data.total_minutes)}</b><span>время</span></div>
            {my && (
              <div className="path-stat">
                <b>{my.done_courses} из {my.total_courses}</b>
                <span>пройдено</span>
              </div>
            )}
          </div>
          <div className="path-cta-row">
            {my?.enrolled ? (
              <>
                {nextItem && (
                  <Link
                    to={`/education/${nextItem.slug}`}
                    className="inline-flex items-center h-10 px-5 rounded-full text-[12px] font-semibold uppercase transition-all hover:brightness-115"
                    style={{ background: '#00D4FF', color: '#060606' }}
                  >
                    Продолжить: {nextItem.title}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleUnenroll}
                  disabled={busy}
                  className="inline-flex items-center h-10 px-5 rounded-full text-[12px] font-semibold uppercase transition-all hover:brightness-115"
                  style={{ background: 'transparent', border: '1px solid #222', color: '#FFFFFF' }}
                >
                  Отписаться от программы
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleEnroll}
                disabled={busy}
                className="inline-flex items-center h-10 px-5 rounded-full text-[12px] font-semibold uppercase transition-all hover:brightness-115"
                style={{ background: '#00D4FF', color: '#060606' }}
              >
                {busy ? 'Записываем…' : 'Начать программу'}
              </button>
            )}
            {my && (
              <div className="hero-progress">
                <div className="progress"><i style={{ width: `${my.percent}%` }} /></div>
                <span>{my.percent}%</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Цепочка курсов (мокап .chain): номер, обложка, название+мета, пилюля. */}
        <div className="path-chain">
          {data.items.map((item, idx) => {
            const isNext = my?.next_slug === item.slug
            const done = item.my_status === 'completed'
            return (
              <motion.div
                key={item.slug}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(idx, 8) * 0.05, ease: easeOutExpo }}
              >
                <Link
                  to={`/education/${item.slug}`}
                  className={`p-course${isNext ? ' next' : ''}${done ? ' done' : ''}`}
                >
                  <span className="p-num">{done ? '✓' : item.position}</span>
                  {item.cover_url ? (
                    <img className="p-cover" src={resolveMediaUrl(item.cover_url)} alt="" loading="lazy" />
                  ) : (
                    <span className="p-cover-ph" />
                  )}
                  <div className="p-info">
                    <div className="p-title">{item.title}</div>
                    <div className="p-meta">
                      {item.lessons_count} {plural(item.lessons_count, 'урок', 'урока', 'уроков')}
                      {' · '}{formatMin(item.total_minutes)}
                      {' · '}{SIZE_LABEL[item.size] || 'Курс'}
                      {isNext && ' · следующий курс'}
                      {item.included_tariffs && ` · или от тарифа ${item.included_tariffs}`}
                    </div>
                  </div>
                  {item.my_status === 'completed' && <span className="p-status done">Пройден</span>}
                  {item.my_status === 'in_progress' && (
                    <span className="p-status current">
                      {item.progress.total_lessons > 0
                        ? `${Math.round((item.progress.done_lessons / item.progress.total_lessons) * 100)}% · Продолжить`
                        : 'Продолжить'}
                    </span>
                  )}
                  {item.my_status === 'available' && <span className="p-status todo">Не начат</span>}
                  {item.my_status === 'needs_purchase' && (
                    <span className="p-status paid">Платный · {item.price.toLocaleString('ru-RU')} ₽</span>
                  )}
                </Link>
              </motion.div>
            )
          })}
          {data.hidden_count > 0 && (
            <div className="p-hidden-note">
              <Lock size={14} />
              +{data.hidden_count} закрытый {plural(data.hidden_count, 'курс', 'курса', 'курсов')} — доступ по приглашению администратора
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
