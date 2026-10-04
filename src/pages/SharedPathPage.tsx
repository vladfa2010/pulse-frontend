import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { motion } from 'framer-motion'
import { ArrowLeft, GraduationCap, Route } from 'lucide-react'
import { fetchSharedPath } from '@/lib/educationApi'
import { resolveMediaUrl } from '@/lib/media'
import type { SharedPathData, SharedPathItem } from '@/lib/educationApi'

// Публичная страница «Инвестиционный путь» — доступна без авторизации по
// ссылке /education/path/:token. Дизайн — мокап lms-full/mockup/path.html:
// хиро с инициалами владельца, стат-пилюли, вертикальный таймлайн курсов,
// финальный CTA «Соберите свой путь». noindex — чтобы не индексировалась.
// 404 (ссылка отозвана/не существует) — отдельный экран.

const easeOutExpo = [0.16, 1, 0.3, 1] as const

const SIZE_LABEL: Record<string, string> = {
  micro: 'Микро',
  standard: 'Курс',
  full: 'Полный',
}

function initials(username: string): string {
  const parts = username.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/** minutes → «≈X ч» с округлением до 0.1 (контракт: minutes — минуты). */
function fmtHours(minutes: number): string {
  if (minutes <= 0) return '0 ч'
  return `≈${Math.round((minutes / 60) * 10) / 10} ч`
}

function pluralCourses(n: number): string {
  const m = n % 10
  const h = n % 100
  return m === 1 && h !== 11 ? 'курс' : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? 'курса' : 'курсов'
}

function pluralLessons(n: number): string {
  const m = n % 10
  const h = n % 100
  return m === 1 && h !== 11 ? 'урок' : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? 'урока' : 'уроков'
}

export default function SharedPathPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<SharedPathData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // noindex: страница персональная, в выдачу не нужна
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'robots'
      document.head.appendChild(meta)
    }
    const prev = meta.content
    meta.content = 'noindex'
    return () => { meta.content = prev }
  }, [])

  useEffect(() => {
    if (!token) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    fetchSharedPath(token)
      .then(res => { if (!cancelled) setData(res) })
      .catch(err => {
        if (cancelled) return
        if (err?.status === 404) setNotFound(true)
        setData(null)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="w-8 h-8 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="text-center max-w-sm">
          <Route size={40} className="mx-auto mb-4 text-[#4B5563]" />
          <h1 className="text-xl font-semibold text-white mb-2">Ссылка больше не активна</h1>
          <p className="text-sm text-[#9CA3AF] mb-6">
            Владелец отозвал доступ или ссылка устарела. Попросите его поделиться путём заново.
          </p>
          <Link to="/education" className="text-[#00D4FF] hover:underline text-sm">Перейти в Образование</Link>
        </div>
      </div>
    )
  }

  const { owner, stats, items } = data
  const completedCount = items.filter(i => i.completed).length

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      <div
        className="pt-24 pb-10 px-6 md:px-12"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 212, 255, 0.06), transparent)' }}
      >
        <div className="max-w-[760px] mx-auto">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <Link
              to="/education"
              className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-white transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              <span>Все курсы</span>
            </Link>
          </motion.div>

          {/* Хиро: инициалы + «Инвестиционный путь» + username */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutExpo }}
            className="flex items-center gap-5 mb-6"
          >
            <div
              className="w-16 h-16 rounded-full flex-none flex items-center justify-center text-[22px] font-bold"
              style={{ color: '#060606', background: 'linear-gradient(135deg, #00D4FF, #A78BFA)' }}
            >
              {initials(owner.username)}
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="w-6 h-px" style={{ background: '#00D4FF' }} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#00D4FF' }}>
                  Инвестиционный путь
                </span>
              </div>
              <h1 className="text-white font-bold tracking-tight" style={{ fontSize: 'clamp(26px, 4vw, 36px)', lineHeight: 1.15 }}>
                {owner.username}
              </h1>
            </div>
          </motion.div>

          {/* Стат-пилюли */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: easeOutExpo }}
            className="flex flex-wrap gap-2.5"
          >
            <Stat value={String(stats.courses)} label={pluralCourses(stats.courses)} />
            {completedCount > 0 && (
              <Stat value={String(completedCount)} label="завершён" accent="#34D399" />
            )}
            <Stat value={String(stats.lessons_done)} label={`${pluralLessons(stats.lessons_done)} пройдено`} />
            <Stat value={fmtHours(stats.minutes)} label="время обучения" />
          </motion.div>
        </div>
      </div>

      <div className="max-w-[760px] mx-auto px-6 md:px-12 pb-20">
        {items.length === 0 ? (
          /* Пустой путь */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutExpo }}
            className="flex flex-col items-center text-center py-14 rounded-2xl"
            style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}
          >
            <GraduationCap size={36} className="text-[#4B5563] mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Путь только начинается</h2>
            <p className="text-[13px] text-[#9CA3AF] max-w-xs">
              Пока нет ни одного курса. Загляните сюда позже — прогресс появится здесь.
            </p>
          </motion.div>
        ) : (
          /* Вертикальный таймлайн узлов-курсов */
          <div className="relative" style={{ paddingLeft: 34 }}>
            <div
              className="absolute top-3 bottom-3 w-[2px] rounded-full"
              style={{
                left: 11,
                background: 'linear-gradient(180deg, #34D399, #00D4FF, rgba(255,255,255,.12))',
              }}
            />
            {items.map((item, i) => (
              <PathNode key={item.slug} item={item} index={i} />
            ))}
          </div>
        )}

        {/* Финальный CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: easeOutExpo }}
          className="mt-14 text-center px-6 py-10 rounded-2xl"
          style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}
        >
          <h2 className="text-[20px] font-bold text-white mb-2">Соберите свой путь</h2>
          <p className="text-[13px] text-[#9CA3AF] mb-6 max-w-md mx-auto">
            Курсы по инвестициям и финансам — с тестами, материалами и разборами живых новостей.
          </p>
          <Link
            to="/education"
            className="inline-flex items-center h-10 px-6 rounded-full text-[12px] font-bold uppercase tracking-wide transition-all hover:brightness-115"
            style={{ background: '#00D4FF', color: '#060606' }}
          >
            Смотреть каталог
          </Link>
        </motion.div>

        <p className="text-center mt-8 text-[11px] text-[#6B7280]">
          Страница доступна только по этой ссылке · Владелец может отозвать доступ в любой момент
        </p>
      </div>
    </div>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div
      className="px-[18px] py-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}
    >
      <b className="block text-[19px] text-white" style={accent ? { color: accent } : undefined}>{value}</b>
      <span className="block text-[11px] text-[#6B7280] uppercase tracking-wide">{label}</span>
    </div>
  )
}

function PathNode({ item, index }: { item: SharedPathItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.08, ease: easeOutExpo }}
      className="relative mb-[22px]"
    >
      {/* Точка на линии */}
      <span
        className="absolute rounded-full"
        style={{
          left: -29,
          top: 26,
          width: 12,
          height: 12,
          background: item.completed ? '#34D399' : '#0a0a0a',
          border: `2px solid ${item.completed ? '#34D399' : '#00D4FF'}`,
          boxShadow: `0 0 10px ${item.completed ? 'rgba(52,211,153,.5)' : 'rgba(0,212,255,.5)'}`,
        }}
      />
      <Link
        to={`/education/${item.slug}`}
        className="flex gap-4 p-4 rounded-2xl transition-all hover:-translate-y-0.5"
        style={{
          background: 'rgba(255,255,255,.03)',
          border: '1px solid rgba(255,255,255,.06)',
        }}
      >
        {item.cover_url ? (
          <img
            src={resolveMediaUrl(item.cover_url)}
            alt={item.title}
            className="w-32 flex-none object-cover rounded-[10px]"
            style={{ aspectRatio: '16/10', filter: 'saturate(.92)' }}
            loading="lazy"
          />
        ) : (
          <div
            className="w-32 flex-none rounded-[10px]"
            style={{ aspectRatio: '16/10', background: 'linear-gradient(135deg, hsl(200 55% 14%), hsl(240 45% 22%))' }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {item.size !== 'standard' && (
              <span
                className="text-[9px] font-bold uppercase tracking-wide px-[7px] py-[2px] rounded-full"
                style={{ color: '#A78BFA', border: '1px solid rgba(167,139,250,.4)' }}
              >
                {SIZE_LABEL[item.size] || item.size}
              </span>
            )}
            {item.type === 'situational' && (
              <span
                className="text-[9px] font-bold uppercase tracking-wide px-[7px] py-[2px] rounded-full"
                style={{ color: '#6B7280', border: '1px solid rgba(255,255,255,.08)' }}
              >
                по новости
              </span>
            )}
          </div>
          <div className="text-[16px] font-semibold text-white leading-snug mb-1.5 line-clamp-2">
            {item.title}
          </div>
          {item.completed ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: '#34D399' }}>
              ✓ Пройден
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: '#00D4FF' }}>
                Изучаю · {item.progress_percent}%
              </span>
              <div
                className="mt-2 h-1 rounded-full overflow-hidden"
                style={{ maxWidth: 260, background: 'rgba(255,255,255,.08)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, item.progress_percent))}%`, background: 'linear-gradient(90deg, #00D4FF, #A78BFA)' }}
                />
              </div>
            </>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
