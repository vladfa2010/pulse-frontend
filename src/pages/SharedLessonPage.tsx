import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, BookOpen, GraduationCap, TimerOff } from 'lucide-react'
import { fetchSharedLesson } from '@/lib/educationApi'
import { SafeHtmlContent } from '@/components/education/SafeHtmlContent'
import TagSelectBlockView from '@/components/education/TagSelectBlockView'
import CommunityTagsBlockView from '@/components/education/CommunityTagsBlockView'

// Публичная страница разового шеринга урока (ТЗ-187 «Меджик-линк») —
// доступна без авторизации по ссылке /share/lesson/:token. Ссылка сгорает
// при первом открытии (повторное открытие → 410), живёт 1 час (просрочка →
// 410). Гость видит только текст урока. noindex — как у SharedPathPage.
// После успешного открытия токен сохраняем: если гость зарегистрируется,
// useAuth подставит его в register для атрибуции (registration_source).

const easeOutExpo = [0.16, 1, 0.3, 1] as const

type ShareState =
  | { kind: 'loading' }
  | { kind: 'ok'; title: string; contentHtml: string; courseTitle: string; courseSlug: string }
  | { kind: 'used'; courseSlug: string | null }
  | { kind: 'expired' }
  | { kind: 'notfound' }

export default function SharedLessonPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<ShareState>({ kind: 'loading' })

  // noindex: страница персональная и одноразовая, в выдачу не нужна
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
    if (!token || !/^[0-9a-f]{48}$/.test(token)) {
      setState({ kind: 'notfound' })
      return
    }
    let cancelled = false
    setState({ kind: 'loading' })
    fetchSharedLesson(token)
      .then(res => {
        if (cancelled) return
        window.localStorage.setItem('lesson_share_token', token)
        setState({
          kind: 'ok',
          title: res.lesson.title,
          contentHtml: res.lesson.content_html,
          courseTitle: res.course.title,
          courseSlug: res.course.slug,
        })
      })
      .catch((err: any) => {
        if (cancelled) return
        if (err?.status === 410 && err?.data?.course_slug) {
          setState({ kind: 'used', courseSlug: err.data.course_slug })
        } else if (err?.status === 410) {
          setState({ kind: 'expired' })
        } else {
          setState({ kind: 'notfound' })
        }
      })
    return () => { cancelled = true }
  }, [token])

  // ТЗ-201/ТЗ-202: живые блоки тегов в shared-конспекте — порталами в пустые
  // div (как на LessonPage). Только kind='ok' даёт контент; SafeHtmlContent —
  // memo на html, DOM стабилен, навеска на [state] безопасна.
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [tagSelectMounts, setTagSelectMounts] = useState<HTMLElement[]>([])
  const [communityTagsMounts, setCommunityTagsMounts] = useState<HTMLElement[]>([])
  useEffect(() => {
    if (state.kind !== 'ok') { setTagSelectMounts([]); setCommunityTagsMounts([]); return }
    const root = contentRef.current
    if (!root) return
    setTagSelectMounts(Array.from(root.querySelectorAll('div.tag-select-block')))
    setCommunityTagsMounts(Array.from(root.querySelectorAll('div.community-tags-block')))
  }, [state])

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="w-8 h-8 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }  if (state.kind === 'used' || state.kind === 'expired' || state.kind === 'notfound') {
    const isUsed = state.kind === 'used'
    const title = isUsed
      ? 'Ссылка уже использована'
      : state.kind === 'expired'
        ? 'Срок действия ссылки истёк'
        : 'Ссылка не найдена'
    const hint = isUsed
      ? 'Разовая ссылка сработала при первом открытии. Попросите отправителя поделиться уроком заново.'
      : state.kind === 'expired'
        ? 'Ссылка живёт один час. Попросите отправителя создать новую.'
        : 'Такой ссылки не существует или курс недоступен.'
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="text-center max-w-sm">
          {isUsed ? (
            <BookOpen size={40} className="mx-auto mb-4 text-[#4B5563]" />
          ) : state.kind === 'expired' ? (
            <TimerOff size={40} className="mx-auto mb-4 text-[#4B5563]" />
          ) : (
            <GraduationCap size={40} className="mx-auto mb-4 text-[#4B5563]" />
          )}
          <h1 className="text-xl font-semibold text-white mb-2">{title}</h1>
          <p className="text-sm text-[#9CA3AF] mb-6">{hint}</p>
          {isUsed && state.courseSlug ? (
            <Link
              to={`/education/${state.courseSlug}`}
              className="inline-flex items-center h-10 px-6 rounded-full text-[12px] font-bold uppercase tracking-wide"
              style={{ background: '#00D4FF', color: '#060606' }}
            >
              Открыть курс
            </Link>
          ) : (
            <Link to="/education" className="text-[#00D4FF] hover:underline text-sm">
              Перейти в Образование
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      <div
        className="pt-24 pb-8 px-6 md:px-12"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 212, 255, 0.06), transparent)' }}
      >
        <div className="max-w-[760px] mx-auto">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <Link
              to={`/education/${state.courseSlug}`}
              className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-white transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              <span>Курс «{state.courseTitle}»</span>
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutExpo }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <span className="w-6 h-px" style={{ background: '#00D4FF' }} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#00D4FF' }}>
                Урок курса
              </span>
            </div>
            <h1
              className="text-white font-bold tracking-tight"
              style={{ fontSize: 'clamp(26px, 4vw, 36px)', lineHeight: 1.15 }}
            >
              {state.title}
            </h1>
          </motion.div>
        </div>
      </div>

      <div className="max-w-[760px] mx-auto px-6 md:px-12 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: easeOutExpo }}
          className="edu-content rounded-2xl p-6 md:p-8"
          style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}
        >
          <SafeHtmlContent html={state.contentHtml} innerRef={contentRef} />
        </motion.div>
        {tagSelectMounts.map((el, i) => createPortal(
          <TagSelectBlockView key={`shared-tag-select-${i}`} glow={el.dataset.glow === '1'} />,
          el,
        ))}
        {communityTagsMounts.map((el, i) => createPortal(
          <CommunityTagsBlockView key={`shared-community-tags-${i}`} glow={el.dataset.glow === '1'} />,
          el,
        ))}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: easeOutExpo }}
          className="mt-10 text-center px-6 py-8 rounded-2xl"
          style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}
        >
          <h2 className="text-[18px] font-bold text-white mb-2">Весь курс — в PULSE</h2>
          <p className="text-[13px] text-[#9CA3AF] mb-5 max-w-md mx-auto">
            Уроки, тесты и материалы курса «{state.courseTitle}» доступны после регистрации.
          </p>
          <Link
            to={`/education/${state.courseSlug}`}
            className="inline-flex items-center h-10 px-6 rounded-full text-[12px] font-bold uppercase tracking-wide transition-all hover:brightness-115"
            style={{ background: '#00D4FF', color: '#060606' }}
          >
            Открыть курс
          </Link>
        </motion.div>

        <p className="text-center mt-8 text-[11px] text-[#6B7280]">
          Одноразовая ссылка · уже использована и больше не действует
        </p>
      </div>
    </div>
  )
}
