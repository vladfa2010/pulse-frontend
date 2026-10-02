import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Link2,
  Lock,
  Newspaper,
  Plus,
  User,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { api } from '@/lib/api'
import { enrollCourse, fetchCourseEvents, fetchPublicCourse, materialDownloadPath } from '@/lib/educationApi'
import type { CalendarMatchEvent, PublicCourseCard, PublicCourseMaterial } from '@/lib/educationApi'
import { daysUntil, eventKindColor, moscowDateString } from '@/lib/educationMatch'
import SuggestMaterialModal from '@/components/education/SuggestMaterialModal'

// Публичная страница курса (ТЗ-100; UGC-блоки — ТЗ-102): титул, программа,
// редакционные материалы, «Материалы сообщества» (approved UGC с плашкой
// «предложил @username») и кнопка «+ Предложить материал» только для записанных.
// Маршрут: /education/:slug (ссылки из админки открывают именно его).

const easeOutExpo = [0.16, 1, 0.3, 1] as const

interface CourseNewsItem {
  id: string
  slug: string | null
  title_ru: string
  published_at: string | null
}

const SIZE_LABEL: Record<string, string> = {
  micro: 'Микро-курс',
  standard: 'Курс',
  full: 'Полный курс',
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ru-RU')
}

function pluralDays(n: number): string {
  const m = n % 10
  const h = n % 100
  return m === 1 && h !== 11 ? 'день' : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? 'дня' : 'дней'
}

/** Разделение editorial/community (контракт ТЗ-102 — по полю origin; бэк также
 *  может отдать community отдельным полем community_materials — берём оба варианта). */
function splitMaterials(card: PublicCourseCard): {
  editorial: PublicCourseMaterial[]
  community: PublicCourseMaterial[]
} {
  const declared = card.community_materials
  const editorial = (card.materials || []).filter(
    m => (m as { origin?: string }).origin !== 'user',
  )
  const community = declared && declared.length
    ? declared
    : (card.materials || []).filter(m => (m as { origin?: string }).origin === 'user')
  return { editorial, community }
}

export default function CoursePage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const { isLoggedIn } = useAuth()
  const [card, setCard] = useState<PublicCourseCard | null>(null)
  const [courseNews, setCourseNews] = useState<CourseNewsItem[]>([])
  const [events, setEvents] = useState<CalendarMatchEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showSuggest, setShowSuggest] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [verifyingPayment, setVerifyingPayment] = useState(false)
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null)
  const { open: openAuthModal } = useAuthModal()

  // Покупка платных курсов — под фичефлагом (VITE_EDUCATION_PAYMENTS_ENABLED).
  // Выкл → текущее поведение: платная карточка ведёт на /pricing.
  const paymentsEnabled = import.meta.env.VITE_EDUCATION_PAYMENTS_ENABLED === 'true'

  // Возврат с оплаты: ?payment_id=...[&paid=1] в URL карточки курса —
  // поллим статус платежа до completed, перезагружаем карточку (появится enrollment).
  const paymentId = searchParams.get('payment_id')

  useEffect(() => {
    if (!paymentId) return
    let cancelled = false
    let timer: number | undefined
    let attempts = 0
    const MAX_ATTEMPTS = 15 // 15 × 2 с = 30 с поллинга

    setVerifyingPayment(true)
    setPaymentNotice(null)

    const checkStatus = async () => {
      try {
        attempts++
        const data = await api.get(`/payment/status/${paymentId}`)
        const status = data?.payment?.status
        if (status === 'completed') {
          if (cancelled) return
          setVerifyingPayment(false)
          setPaymentNotice(null)
          // Доступ появился на бэке — перезапрашиваем карточку (my_enrollment).
          reloadCard()
          // Убираем query-параметры оплаты из URL.
          window.history.replaceState(null, '', window.location.pathname)
          return
        }
        if (status === 'failed' || status === 'canceled' || status === 'cancelled') {
          if (cancelled) return
          setVerifyingPayment(false)
          setPaymentNotice('Платёж не был завершён. Попробуйте купить курс снова.')
          return
        }
      } catch {
        // Сетевая ошибка — продолжаем поллить до лимита попыток.
      }
      if (cancelled) return
      if (attempts < MAX_ATTEMPTS) {
        timer = window.setTimeout(checkStatus, 2000)
      } else {
        setVerifyingPayment(false)
        setPaymentNotice('Платёж обрабатывается, доступ появится в течение пары минут')
      }
    }

    checkStatus()
    return () => { cancelled = true; if (timer) window.clearTimeout(timer) }
  }, [paymentId])

  const reloadCard = () => {
    if (!slug) return
    fetchPublicCourse(slug).then(setCard).catch(() => undefined)
  }

  const onEnroll = () => {
    if (!slug || enrolling) return
    if (!isLoggedIn) {
      // Гостю — сначала авторизация, кнопка остаётся на месте после входа.
      openAuthModal()
      return
    }
    setEnrolling(true)
    setEnrollError(null)
    enrollCourse(slug)
      .then(() => reloadCard())
      // 409 (тариф сняли между рендером и кликом) и прочие ошибки —
      // показываем текст и перезапрашиваем карточку (CTA перерисуется актуальным).
      .catch((err: any) => {
        setEnrollError(err?.message || 'Не удалось записаться — попробуйте ещё раз')
        reloadCard()
      })
      .finally(() => setEnrolling(false))
  }

  const onBuy = () => {
    if (!slug || buying) return
    if (!isLoggedIn) {
      // Гостю — сначала авторизация; после входа карточка персонализируется (deps isLoggedIn).
      openAuthModal()
      return
    }
    setBuying(true)
    setBuyError(null)
    api
      .post(`/education/courses/${encodeURIComponent(slug)}/buy`, {})
      .then((data: any) => {
        // demo: true — редирект на существующую demo-страницу оплаты (сама доведёт);
        // иначе — редирект на ЮKassa. В обоих случаях уходим по confirmation_url.
        if (data?.confirmation_url) {
          window.location.href = data.confirmation_url
        } else {
          setBuyError('Не получили ссылку на оплату — попробуйте ещё раз')
          setBuying(false)
        }
      })
      .catch((err: any) => {
        if (err?.status === 409) {
          // Уже записан (гонка с оплатой/webhook) — просто перезагружаем карточку.
          reloadCard()
        } else {
          setBuyError(err?.message || 'Не удалось начать оплату — попробуйте ещё раз')
        }
        setBuying(false)
      })
  }

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    setNotFound(false)
    fetchPublicCourse(slug)
      .then(setCard)
      .catch(err => {
        if (err?.status === 404) setNotFound(true)
        setCard(null)
      })
      .finally(() => setLoading(false))
    // «Курс в новостях» — необязательный блок, гасим ошибки.
    api
      .get(`/education/courses/${encodeURIComponent(slug)}/news`)
      .then(list => setCourseNews(Array.isArray(list) ? list : []))
      .catch(() => setCourseNews([]))
    // «Связанные события» (ТЗ-103) — необязательный блок: 404 (фичефлаг выкл)
    // и прочие ошибки гасим, блок не рендерится.
    fetchCourseEvents(slug)
      .then(data => setEvents(Array.isArray(data?.events) ? data.events : []))
      .catch(() => setEvents([]))
    // isLoggedIn в deps (ТЗ-106 Задача 2): карточка персонализирована
    // (my_enrollment, progress) — после логина/логаута без рефетча CTA врёт.
  }, [slug, isLoggedIn])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="w-8 h-8 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !card) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="text-center max-w-sm">
          <GraduationCap size={40} className="mx-auto mb-4 text-[#4B5563]" />
          <h1 className="text-xl font-semibold text-white mb-2">Курс не найден</h1>
          <p className="text-sm text-[#9CA3AF] mb-6">
            Возможно, курс снят с публикации или ссылка устарела.
          </p>
          <Link to="/" className="text-[#00D4FF] hover:underline text-sm">На главную</Link>
        </div>
      </div>
    )
  }

  const { editorial, community } = splitMaterials(card)
  const enrolled = !!card.my_enrollment
  const totalMinutes = card.program.reduce((s, l) => s + (l.duration_min || 0), 0)
  // ТЗ-121: альтернатива покупке — «курс в подписке». Показываем гостю и юзеру
  // без подходящего тарифа (платный курс, не записан, доступа по подписке нет,
  // тарифы привязаны). Основной тариф — первый (порядок из getActivePlans).
  const subAltTariffs =
    card.price > 0 && !card.my_enrollment && !card.access_via_subscription && (card.included_tariffs?.length ?? 0) > 0
      ? card.included_tariffs!
      : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      <div
        className="pt-24 pb-12 px-6 md:px-12"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 212, 255, 0.06), transparent)' }}
      >
        <div className="max-w-[1000px] mx-auto">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <Link
              to="/education"
              className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-white transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              <span>Все курсы</span>
            </Link>
          </motion.div>

          <div className="grid md:grid-cols-[1.15fr_.85fr] gap-10 items-start">
            {/* Титул */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeOutExpo }}
            >
              {card.badges.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {card.badges.map(b => (
                    <span
                      key={b}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{
                        background: 'rgba(0,212,255,.08)',
                        border: '1px solid rgba(0,212,255,.25)',
                        color: '#00D4FF',
                      }}
                    >
                      {b === 'new' ? 'Новый' : b === 'popular' ? 'Популярный' : b === 'recommended' ? 'Рекомендуем' : b}
                    </span>
                  ))}
                </div>
              )}
              <h1 className="text-white font-bold tracking-tight mb-4" style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.1 }}>
                {card.title}
              </h1>
              {/* ТЗ-108: description — HTML (санитизирован на бэке), рендерим как
                  урок: dangerouslySetInnerHTML + общая типографика .edu-content.
                  whiteSpace pre-wrap — старые plain-text описания не слипнутся. */}
              {card.description && (
                <div
                  className="edu-content leading-relaxed mb-6"
                  style={{ whiteSpace: 'pre-wrap' }}
                  dangerouslySetInnerHTML={{ __html: card.description }}
                />
              )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#9CA3AF]">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen size={14} style={{ color: '#00D4FF' }} />
                  <b className="text-white">{SIZE_LABEL[card.size] || 'Курс'}</b>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap size={14} />
                  <b className="text-white">{card.program.length}</b>&nbsp;уроков
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FileText size={14} />
                  <b className="text-white">{card.materials.length}</b>&nbsp;материалов
                </span>
                {totalMinutes > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={14} />
                    ≈ {Math.round(totalMinutes / 60 * 10) / 10} ч
                  </span>
                )}
                {card.author && (
                  <span className="inline-flex items-center gap-1.5">
                    <User size={14} />
                    {card.author}
                  </span>
                )}
              </div>
            </motion.div>

            {/* Обложка + CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: easeOutExpo }}
            >
              <div
                className="relative rounded-2xl overflow-hidden mb-4"
                style={{ border: '1px solid rgba(255,255,255,.08)' }}
              >
                {card.cover_url ? (
                  <img
                    src={card.cover_url}
                    alt={card.title}
                    className="w-full block object-cover"
                    style={{ aspectRatio: '16/10', filter: 'saturate(.92)' }}
                  />
                ) : (
                  <div
                    className="w-full"
                    style={{ aspectRatio: '16/10', background: 'linear-gradient(135deg, hsl(200 55% 14%), hsl(240 45% 22%))' }}
                  />
                )}
              </div>
              <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}>
                {enrolled ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] text-[#9CA3AF]">Вы записаны</span>
                      {card.progress && <b className="text-white text-sm">{card.progress.percent}%</b>}
                    </div>
                    {card.progress ? (
                      <div className="h-1.5 rounded-full mb-4" style={{ background: 'rgba(255,255,255,.06)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${card.progress.percent}%`, background: 'linear-gradient(90deg, #00D4FF, #0099CC)' }}
                        />
                      </div>
                    ) : (
                      <p className="text-[12px] text-[#9CA3AF] mb-4">Доступ ко всем урокам открыт</p>
                    )}
                    <a
                      href="#program"
                      className="block text-center h-11 leading-[44px] rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
                      style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                    >
                      {card.progress && card.progress.percent > 0 ? 'Продолжить' : 'Начать курс'}
                    </a>
                  </>
                ) : card.access_via_subscription ? (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] text-[#9CA3AF]">Ваш тариф</span>
                      <b className="text-white text-sm">включён</b>
                    </div>
                    <p className="text-[12px] text-[#9CA3AF] mb-4">Курс входит в вашу подписку — покупать не нужно</p>
                    {enrollError && <p className="text-[12px] text-[#F87171] mb-2">{enrollError}</p>}
                    <button
                      type="button"
                      disabled={enrolling}
                      onClick={onEnroll}
                      className="w-full block text-center h-11 leading-[44px] rounded-xl text-[13px] font-bold transition-all hover:brightness-115 disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                    >
                      {enrolling ? 'Открываем…' : 'Открыть курс'}
                    </button>
                  </>
                ) : card.price > 0 && paymentsEnabled ? (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] text-[#9CA3AF]">Полный доступ</span>
                      <b className="text-white text-sm">{card.price.toLocaleString('ru-RU')} ₽</b>
                    </div>
                    {card.locked_materials_count > 0 && (
                      <p className="text-[12px] text-[#34D399] mb-1">
                        {editorial.filter(m => m.is_free).length} материалов бесплатно — без покупки
                      </p>
                    )}
                    {verifyingPayment ? (
                      <div className="flex items-center justify-center gap-2 h-11 rounded-xl mt-1" style={{ background: 'rgba(0,212,255,.06)', border: '1px solid rgba(0,212,255,.2)' }}>
                        <div className="w-4 h-4 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[13px] font-semibold text-[#00D4FF]">Проверяем оплату…</span>
                      </div>
                    ) : (
                      <>
                        {buyError && <p className="text-[12px] text-[#F87171] mb-2">{buyError}</p>}
                        {paymentNotice && <p className="text-[12px] text-[#FBBF24] mb-2">{paymentNotice}</p>}
                        <button
                          type="button"
                          disabled={buying}
                          onClick={onBuy}
                          className="w-full block text-center h-11 leading-[44px] rounded-xl text-[13px] font-bold transition-all hover:brightness-115 disabled:opacity-60"
                          style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                        >
                          {buying ? 'Переходим к оплате…' : `Купить курс — ${card.price.toLocaleString('ru-RU')} ₽`}
                        </button>
                      </>
                    )}
                  </>
                ) : card.price > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] text-[#9CA3AF]">Полный доступ</span>
                      <b className="text-white text-sm">{card.price.toLocaleString('ru-RU')} ₽</b>
                    </div>
                    {card.locked_materials_count > 0 && (
                      <p className="text-[12px] text-[#34D399] mb-1">
                        {editorial.filter(m => m.is_free).length} материалов бесплатно — без записи
                      </p>
                    )}
                    <Link
                      to="/pricing"
                      className="block text-center h-11 leading-[44px] rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
                      style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                    >
                      Купить курс
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] text-[#9CA3AF]">Полный доступ</span>
                      <b className="text-white text-sm">бесплатно</b>
                    </div>
                    {card.locked_materials_count > 0 && (
                      <p className="text-[12px] text-[#34D399] mb-1">
                        {editorial.filter(m => m.is_free).length} материалов бесплатно — без записи
                      </p>
                    )}
                    {enrollError && <p className="text-[12px] text-[#F87171] mb-2">{enrollError}</p>}
                    <button
                      type="button"
                      disabled={enrolling}
                      onClick={onEnroll}
                      className="w-full block text-center h-11 leading-[44px] rounded-xl text-[13px] font-bold transition-all hover:brightness-115 disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                    >
                      {enrolling ? 'Записываем…' : 'Записаться'}
                    </button>
                  </>
                )}
                {/* ТЗ-121: «или в подписке» — разделитель dashed + ghost-кнопка на
                    /pricing (у гостя там свой auth-flow). Цену «₽/мес» показываем
                    только для monthly-тарифов — годовую конверсию не считаем. */}
                {subAltTariffs && (
                  <div className="mt-5">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex-1" style={{ borderTop: '1px dashed rgba(167,139,250,.35)' }} />
                      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A78BFA' }}>или</span>
                      <span className="flex-1" style={{ borderTop: '1px dashed rgba(167,139,250,.35)' }} />
                    </div>
                    <div className="flex items-baseline justify-between gap-2 mt-4 mb-1">
                      <span className="text-[12px] text-[#9CA3AF]">В подписке {subAltTariffs[0].name}</span>
                      {subAltTariffs[0].billing_frequency === 'monthly' && subAltTariffs[0].price != null && (
                        <b className="text-sm whitespace-nowrap" style={{ color: '#A78BFA' }}>
                          {subAltTariffs[0].price.toLocaleString('ru-RU')} ₽/мес
                        </b>
                      )}
                    </div>
                    <p className="text-[12px] text-[#9CA3AF] mb-4">
                      Этот и все клубные курсы — пока подписка активна. Отмена в любой момент.
                    </p>
                    <Link
                      to="/pricing"
                      className="block text-center h-11 leading-[44px] rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
                      style={{ border: '1px solid rgba(167,139,250,.45)', color: '#A78BFA', background: 'rgba(167,139,250,.06)' }}
                    >
                      Оформить {subAltTariffs[0].name} и открыть курс
                    </Link>
                    {subAltTariffs.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="text-[11px] text-[#6B7280]">Также входит в тариф:</span>
                        {subAltTariffs.slice(1).map(t => (
                          <Link
                            key={t.id}
                            to="/pricing"
                            className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors hover:brightness-125"
                            style={{ color: '#A78BFA', border: '1px solid rgba(167,139,250,.45)' }}
                          >
                            {t.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Программа */}
      <section id="program" className="max-w-[1000px] mx-auto px-6 md:px-12 mb-12">
        <SectionTitle>Программа курса</SectionTitle>
        {card.program.length === 0 ? (
          <p className="text-sm text-[#6B7280]">Программа появится позже.</p>
        ) : (
          <div className="space-y-2">
            {card.program.map(l => {
              // Доступный урок (запись/превью, не drip-замок) — ссылка на страницу
              // урока; закрытый — просто строка с замком/плашкой drip.
              const open = (enrolled || l.is_free_preview) && !l.locked_by_drip
              const row = (
                <>
                  <span className="text-[12px] text-[#6B7280] w-6 flex-none">{l.position}.</span>
                  <span className="flex-1 min-w-0 text-sm text-white truncate">{l.title}</span>
                  {l.locked_by_drip ? (
                    <span className="flex items-center gap-1.5 text-[11px] text-[#FBBF24] flex-none">
                      <Lock size={12} />
                      откроется через {l.unlock_in_days ?? '?'} дн.
                    </span>
                  ) : (
                    <>
                      {l.kind !== 'text' && (
                        <span className="text-[11px] text-[#6B7280] flex-none">
                          {l.kind === 'video' ? 'видео' : 'видео + текст'}
                        </span>
                      )}
                      {l.duration_min != null && (
                        <span className="text-[11px] text-[#6B7280] flex-none">{l.duration_min} мин</span>
                      )}
                      {!enrolled && !l.is_free_preview && <Lock size={13} className="text-[#4B5563] flex-none" />}
                      {l.is_free_preview && (
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-none"
                          style={{ color: '#34D399', border: '1px solid rgba(52,211,153,.3)' }}
                        >
                          превью
                        </span>
                      )}
                    </>
                  )}
                </>
              )
              return open ? (
                <Link
                  key={l.id}
                  to={`/education/lesson/${l.id}`}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors hover:bg-[rgba(255,255,255,.04)]"
                  style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)' }}
                >
                  {row}
                </Link>
              ) : (
                <div
                  key={l.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)' }}
                >
                  {row}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Материалы курса (редакционные) */}
      <section className="max-w-[1000px] mx-auto px-6 md:px-12 mb-12">
        <div className="flex items-center justify-between gap-4 mb-5">
          <SectionTitle>Материалы курса</SectionTitle>
          {enrolled && isLoggedIn && (
            <button
              onClick={() => setShowSuggest(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12px] font-semibold transition-all hover:brightness-115"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
            >
              <Plus size={14} />
              Предложить материал
            </button>
          )}
        </div>
        {editorial.length === 0 ? (
          <p className="text-sm text-[#6B7280]">Материалы появятся позже.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {editorial
              .filter(m => enrolled || m.is_free)
              .map(m => (
                <MaterialCard key={m.id} m={m} />
              ))}
          </div>
        )}
        {!enrolled && card.locked_materials_count > 0 && (
          <p className="text-[12px] text-[#6B7280] mt-3">
            Ещё {card.locked_materials_count} материалов доступны после записи на курс.
          </p>
        )}
      </section>

      {/* Материалы сообщества (ТЗ-102): только если есть approved-UGC */}
      {community.length > 0 && (
        <section className="max-w-[1000px] mx-auto px-6 md:px-12 mb-12">
          <SectionTitle hint="Проверены редакцией, добавлены учениками курса">
            Материалы сообщества
          </SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            {community.map(m => (
              <MaterialCard key={m.id} m={m} community />
            ))}
          </div>
        </section>
      )}

      {/* Курс в новостях */}
      {courseNews.length > 0 && (
        <section className="max-w-[1000px] mx-auto px-6 md:px-12 mb-12">
          <SectionTitle hint="Свежие новости, к которым прикреплён курс">Курс в новостях</SectionTitle>
          <div className="space-y-2">
            {courseNews.map(n => (
              <Link
                key={n.id}
                to={n.slug ? `/news/${n.slug}` : '/feed'}
                className="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors hover:bg-[rgba(255,255,255,.04)]"
                style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)' }}
              >
                <Newspaper size={15} className="flex-none" style={{ color: '#00D4FF' }} />
                <span className="flex-1 min-w-0 text-sm text-white truncate">{n.title_ru}</span>
                <span className="text-[11px] text-[#6B7280] flex-none">{fmtDate(n.published_at)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Связанные события (ТЗ-103) — мэтчинг курса с событиями календаря
          ближайших 14 дней по общим тегам. Пусто/404 (флаг выкл) — блока нет. */}
      {(() => {
        const today = moscowDateString()
        // Прошедшие события не показываем нигде (бэк их и так не отдаёт — страховка).
        const future = events.filter(ev => {
          const d = daysUntil(ev.date, today)
          return !Number.isNaN(d) && d >= 0
        })
        if (future.length === 0) return null
        return (
          <section className="max-w-[1000px] mx-auto px-6 md:px-12 mb-20">
            <SectionTitle hint="События ближайших 14 дней, к которым подходит курс">
              Связанные события
            </SectionTitle>
            <div className="space-y-2">
              {future.map((ev, i) => {
                const color = eventKindColor(ev.kind)
                const days = daysUntil(ev.date, today)
                return (
                  <Link
                    key={`${ev.date}:${ev.kind}:${ev.ticker || ev.company || ''}:${i}`}
                    to={`/#calendar-${ev.date}`}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors hover:bg-[rgba(255,255,255,.04)]"
                    style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)' }}
                  >
                    <CalendarDays size={15} className="flex-none" style={{ color }} />
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider flex-none"
                      style={{ background: `${color}1F`, color, border: `1px solid ${color}40` }}
                    >
                      {ev.kind}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-white truncate">
                      {ev.company || ev.title}
                      {ev.status === 'expected' && (
                        <span className="text-[11px] text-[#F59E0B]"> · ожидается</span>
                      )}
                    </span>
                    <span className="text-[11px] text-[#6B7280] flex-none">
                      {fmtDate(ev.date)}
                      {days > 0 && ` · через ${days} ${pluralDays(days)}`}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })()}

      <div className="h-8" />

      <SuggestMaterialModal open={showSuggest} courseSlug={card.slug} onClose={() => setShowSuggest(false)} />
    </div>
  )
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-2 h-2 rounded-full flex-none" style={{ background: '#00D4FF' }} />
        <h2 className="text-lg font-semibold text-white">{children}</h2>
      </div>
      {hint && <p className="text-[12px] text-[#6B7280] pl-[18px]">{hint}</p>}
    </div>
  )
}

function MaterialCard({ m, community = false }: { m: PublicCourseMaterial; community?: boolean }) {
  const inner = (
    <>
      <div className="flex items-center gap-3 mb-2">
        {m.kind === 'link' ? (
          <Link2 size={16} style={{ color: community ? '#A78BFA' : '#00D4FF' }} />
        ) : m.kind === 'news' ? (
          <Newspaper size={16} style={{ color: community ? '#A78BFA' : '#00D4FF' }} />
        ) : (
          <FileText size={16} style={{ color: community ? '#A78BFA' : '#00D4FF' }} />
        )}
        <span className="flex-1 min-w-0 text-sm font-medium text-white line-clamp-2">{m.title}</span>
        {m.kind === 'link' ? (
          <ExternalLink size={13} className="flex-none text-[#6B7280]" />
        ) : (
          <Download size={13} className="flex-none text-[#6B7280]" />
        )}
      </div>
      {community && (
        <div className="flex items-center gap-1.5 pl-[28px]">
          <CheckCircle2 size={11} style={{ color: '#34D399' }} />
          <span className="text-[11px] text-[#6B7280]">
            предложил <b style={{ color: '#9CA3AF' }}>@{m.submitted_by?.username || 'ученик'}</b>
          </span>
        </div>
      )}
    </>
  )

  const style: React.CSSProperties = community
    ? { background: 'rgba(167,139,250,.04)', border: '1px solid rgba(167,139,250,.18)' }
    : { background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)' }

  // Ссылки — в новой вкладке; файлы — через download-эндпоинт (attachment);
  // новости не скачиваются (400 на бэке) — карточка без перехода.
  if (m.kind === 'news') {
    return (
      <div className="block px-4 py-3 rounded-xl" style={style}>
        {inner}
      </div>
    )
  }
  if (m.kind === 'link' && m.url) {
    return (
      <a
        href={m.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block px-4 py-3 rounded-xl transition-all hover:brightness-125"
        style={style}
      >
        {inner}
      </a>
    )
  }
  return (
    <a
      href={materialDownloadPath(m.id)}
      className="block px-4 py-3 rounded-xl transition-all hover:brightness-125"
      style={style}
    >
      {inner}
    </a>
  )
}
