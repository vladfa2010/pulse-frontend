import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Download,
  GraduationCap,
  Link2,
  Lock,
  Newspaper,
} from 'lucide-react'
import {
  completeLesson,
  fetchLesson,
  materialDownloadPath,
  submitLessonTest,
  type LessonButton,
  type LessonContent,
} from '@/lib/educationApi'
import { logAnalyticsEvent } from '@/lib/analytics'
import { resolveMediaHtml } from '@/lib/media'
import { useLessonAudio } from '@/lib/useLessonAudio'
import ReadMode from '@/components/education/ReadMode'
import LessonChartBlock, { readChartBlockAttrs, type ChartBlockAttrs } from '@/components/education/LessonChartBlock'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { useAuth } from '@/hooks/useAuth'

// Страница урока LMS (контракт GET /api/education/lessons/:id, ТЗ-100):
// видео (embed из белого списка доменов), текст (санитизированный HTML с бэка),
// тест (correct вырезаны — грейдинг через POST /lessons/:id/test), кнопка
// «Отметить пройденным» (POST /complete), навигация prev/next по позициям курса.
// Маршрут: /education/lesson/:id.

const easeOutExpo = [0.16, 1, 0.3, 1] as const

/** YouTube watch/shorts/share → embed (остальное — как есть, бэк уже проверил домен). */
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com' || u.hostname === 'm.youtube.com') {
      const id = u.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    }
  } catch {
    /* не URL — отдадим как есть */
  }
  return url
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'auth-required' }
  | { kind: 'forbidden'; message: string; unlockInDays: number | null }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; lesson: LessonContent }

// ТЗ-132: plain-text сегменты конспекта для озвучки — по абзацам (p/h/li),
// короткие склеиваются до ≤1800 символов (запас от лимита TTS 2000).
function extractSegments(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // ТЗ-137: доверенную вёрстку html-блоков не озвучиваем — сырой HTML попал бы
  // в озвучку мусором (кнопки/формы как текст).
  doc.querySelectorAll('.html-block').forEach((el) => el.remove())
  const blocks = Array.from(doc.querySelectorAll('p,h1,h2,h3,h4,li,blockquote'))
    .map(el => (el.textContent || '').trim())
    .filter(Boolean)
  const chunks = blocks.length > 0 ? blocks : [(doc.body.textContent || '').trim()].filter(Boolean)
  const out: string[] = []
  for (const b of chunks) {
    const last = out[out.length - 1]
    if (last && last.length + b.length + 2 <= 1800) out[out.length - 1] = `${last}\n\n${b}`
    else out.push(b)
  }
  return out
}

// ТЗ-132: формат времени аудио-линии «M:SS».
function fmtTime(s: number): string {
  const sec = Math.max(0, Math.round(s))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

// ТЗ-132 §5.1: SVG-иконки сегмента/читалки/плеера (дословно из мокапа).
const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z"/><path d="M4 20.5V5.5"/></svg>
)
const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 10v4a2 2 0 002 2h2l4 4V4L7 8H5a2 2 0 00-2 2z"/></svg>
)
const ExpandIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
)
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>
)
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>
)

export default function LessonPage() {
  const { id } = useParams<{ id: string }>()
  const { open: openAuthModal } = useAuthModal()
  const { isLoggedIn } = useAuth()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    if (!id) return
    setState({ kind: 'loading' })
    fetchLesson(id)
      .then(lesson => setState({ kind: 'ok', lesson }))
      .catch((err: any) => {
        if (err?.status === 404) return setState({ kind: 'not-found' })
        if (err?.status === 401) return setState({ kind: 'auth-required' })
        if (err?.status === 403) {
          const reason = err?.data?.reason || err?.data?.error
          const message =
            reason === 'subscription_expired'
              ? 'Ваша подписка истекла — продлите тариф, чтобы продолжить обучение.'
              : reason === 'test_blocked'
                ? 'Сначала пройдите тест предыдущего урока.'
                : reason === 'locked_by_drip'
                  ? 'Урок пока закрыт — он откроется по расписанию курса.'
                  : err?.message || 'Доступ к уроку закрыт'
          const unlockInDays =
            reason === 'locked_by_drip' && Number.isFinite(err?.data?.unlock_in_days)
              ? Number(err.data.unlock_in_days)
              : null
          return setState({ kind: 'forbidden', message, unlockInDays })
        }
        setState({ kind: 'error', message: err?.message || 'Не удалось загрузить урок' })
      })
    // isLoggedIn в deps (ТЗ-106 Задача 2): доступ к уроку зависит от JWT
    // (200/401/403, locked_by_drip) — после логина/логаута перезапрашиваем.
  }, [id, isLoggedIn])

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="w-8 h-8 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (state.kind === 'not-found') {
    return (
      <Shell>
        <GraduationCap size={40} className="mx-auto mb-4 text-[#4B5563]" />
        <h1 className="text-xl font-semibold text-white mb-2">Урок не найден</h1>
        <p className="text-sm text-[#9CA3AF] mb-6">
          Возможно, урок снят с публикации или ссылка устарела.
        </p>
        <Link to="/education" className="text-[#00D4FF] hover:underline text-sm">Все курсы</Link>
      </Shell>
    )
  }

  if (state.kind === 'auth-required') {
    return (
      <Shell>
        <Lock size={40} className="mx-auto mb-4 text-[#4B5563]" />
        <h1 className="text-xl font-semibold text-white mb-2">Войдите, чтобы открыть урок</h1>
        <p className="text-sm text-[#9CA3AF] mb-6">
          Этот урок доступен ученикам курса. Войдите или запишитесь на курс.
        </p>
        <button
          type="button"
          onClick={() => openAuthModal()}
          className="h-11 px-6 rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
          style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
        >
          Войти
        </button>
      </Shell>
    )
  }

  if (state.kind === 'forbidden') {
    return (
      <Shell>
        <Lock size={40} className="mx-auto mb-4 text-[#4B5563]" />
        <h1 className="text-xl font-semibold text-white mb-2">Урок недоступен</h1>
        <p className="text-sm text-[#9CA3AF] mb-2">{state.message}</p>
        {state.unlockInDays !== null && (
          <p className="text-sm text-[#FBBF24] mb-4">Откроется через {state.unlockInDays} дн.</p>
        )}
        <Link to="/education" className="text-[#00D4FF] hover:underline text-sm">Все курсы</Link>
      </Shell>
    )
  }

  if (state.kind === 'error') {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-white mb-2">Не удалось загрузить урок</h1>
        <p className="text-sm text-[#9CA3AF] mb-6">{state.message}</p>
        <Link to="/education" className="text-[#00D4FF] hover:underline text-sm">Все курсы</Link>
      </Shell>
    )
  }

  return <LessonView lesson={state.lesson} onChanged={l => setState({ kind: 'ok', lesson: l })} />
}

const KIND_LABEL: Record<string, string> = {
  video: 'Видео',
  text: 'Текст',
  video_text: 'Видео + текст',
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 text-center"
      style={{ backgroundColor: '#0a0a0a' }}
    >
      <div className="max-w-sm">{children}</div>
    </div>
  )
}

function LessonView({ lesson, onChanged }: { lesson: LessonContent; onChanged: (l: LessonContent) => void }) {
  const { isLoggedIn } = useAuth()
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => lesson.test?.questions.map(() => null) ?? [],
  )
  const [testResult, setTestResult] = useState<{ score: number; passed: boolean } | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  // ТЗ-129: детект недоступности видео (onLoad не сработал за 6 с / onError).
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoRetryKey, setVideoRetryKey] = useState(0)
  const videoLoadedRef = useRef(false)

  // ТЗ-127 Задача 4: ридер-бар конспекта — шаг 10%, диапазон 80–130%,
  // настройка в localStorage переживает переходы между уроками.
  const [readerScale, setReaderScale] = useState(() => {
    const v = Number(window.localStorage.getItem('lms_reader_scale'))
    return Number.isFinite(v) && v >= 0.8 && v <= 1.3 ? v : 1
  })
  const setScale = (v: number) => {
    const clamped = Math.min(1.3, Math.max(0.8, Math.round(v * 10) / 10))
    setReaderScale(clamped)
    window.localStorage.setItem('lms_reader_scale', String(clamped))
  }

  // ТЗ-132: режимы конспекта «Читать/Слушать» (НЕ персистим — каждый заход
  // начинается с чтения).
  const [segMode, setSegMode] = useState<'read' | 'listen'>('read')
  // Читалка: позиция/посещённые страницы — на сессию (state в LessonPage,
  // localStorage не используем).
  const [readOpen, setReadOpen] = useState(false)
  const [rmPage, setRmPage] = useState(1)
  const [rmPages, setRmPages] = useState(1)
  const [visited, setVisited] = useState<Set<number>>(new Set())
  const [rmDone, setRmDone] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | undefined>(undefined)
  const testRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const autoFiredRef = useRef(false)

  const hasTest = !!lesson.test && lesson.test.questions.length > 0
  const completed = !!lesson.progress?.completed
  const embedUrl = useMemo(
    () => (lesson.video_embed_url ? toEmbedUrl(lesson.video_embed_url) : null),
    [lesson.video_embed_url],
  )

  // ТЗ-129: сброс состояния видео при смене урока (LessonView живёт при
  // переходе prev/next — компонент по роуту не пересоздаётся).
  useEffect(() => {
    setVideoFailed(false)
    setVideoRetryKey(0)
    videoLoadedRef.current = false
  }, [lesson.id])

  // ТЗ-129: таймаут 6 с — нет onLoad → видео считаем недоступным. Ref, чтобы
  // таймер после успешной загрузки стейт не трогал.
  useEffect(() => {
    if (!embedUrl || videoFailed) return
    videoLoadedRef.current = false
    const t = window.setTimeout(() => {
      if (!videoLoadedRef.current) setVideoFailed(true)
    }, 6000)
    return () => window.clearTimeout(t)
  }, [embedUrl, videoRetryKey, videoFailed])

  const reload = () =>
    fetchLesson(lesson.id).then(onChanged).catch(() => undefined)

  const runTest = () => {
    if (submitting) return
    if (answers.some(a => a === null)) {
      setTestError('Ответьте на все вопросы')
      return
    }
    setSubmitting(true)
    setTestError(null)
    submitLessonTest(lesson.id, answers as number[])
      .then(async r => {
        setTestResult({ score: r.test_score, passed: r.passed })
        // Пройденный тест сразу фиксируем в прогрессе (complete проверит pass_score сам).
        if (r.passed) await completeLesson(lesson.id, r.test_score).then(reload).catch(() => undefined)
      })
      .catch((err: any) => setTestError(err?.message || 'Не удалось проверить ответы'))
      .finally(() => setSubmitting(false))
  }

  const markCompleted = () => {
    if (completing || completed) return
    setCompleting(true)
    setCompleteError(null)
    completeLesson(lesson.id)
      .then(reload)
      .catch((err: any) => setCompleteError(err?.message || 'Не удалось отметить прогресс'))
      .finally(() => setCompleting(false))
  }

  const testPassedNow = testResult?.passed || (completed && lesson.progress?.test_score != null)
  // ТЗ-127 Задача 6: блокировка «Следующий урок» при непройденном блокирующем тесте
  const nextBlocked = hasTest && lesson.test!.is_blocking && !testPassedNow

  const resetTest = () => {
    setAnswers(lesson.test?.questions.map(() => null) ?? [])
    setTestResult(null)
    setTestError(null)
  }

  // ТЗ-132: сброс режимов конспекта при смене урока (LessonView переживает
  // переход prev/next — компонент по роуту не пересоздаётся).
  useEffect(() => {
    setSegMode('read')
    setReadOpen(false)
    setRmPage(1)
    setVisited(new Set())
    setRmDone(false)
    autoFiredRef.current = false
  }, [lesson.id])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4500)
  }, [])

  const scrollToTest = useCallback(() => {
    // Небольшая задержка — читалка успевает закрыться, страница отскроллится.
    window.setTimeout(
      () => testRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      120,
    )
  }, [])

  // ТЗ-132 Задача 4: автозачёт урока за чтение/прослушивание/скролл.
  // Вилка: без теста — completeLesson; с тестом — CTA к тесту (бэк вернул бы
  // 422 без test_score). Гостю/непройденному доступу не предлагаем.
  const autoComplete = useCallback(
    (source: 'read' | 'listen' | 'scroll') => {
      if (!lesson.has_full_access || completed || autoFiredRef.current) return
      autoFiredRef.current = true
      if (hasTest) {
        showToast(source === 'listen' ? 'Прослушано до конца — теперь тест' : 'Конспект прочитан — теперь тест')
        scrollToTest()
        return
      }
      completeLesson(lesson.id)
        .then(reload)
        .catch(() => {
          autoFiredRef.current = false
        })
      showToast(source === 'listen' ? 'Конспект прослушан — урок засчитан ✓' : 'Урок засчитан ✓')
    },
    [completed, hasTest, lesson.id, lesson.has_full_access, reload, scrollToTest, showToast],
  )

  // ТЗ-132 Задача 2: озвучка конспекта («Слушать»).
  const segments = useMemo(() => extractSegments(lesson.text_content || ''), [lesson.text_content])

  // ТЗ-143: chart-блоки конспекта — живые графики монтируются порталами в
  // пустые div.chart-block после рендера dangerouslySetInnerHTML.
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [chartMounts, setChartMounts] = useState<{ el: HTMLElement; attrs: ChartBlockAttrs }[]>([])
  useEffect(() => {
    const root = contentRef.current
    if (!root || !lesson) { setChartMounts([]); return }
    const els = Array.from(root.querySelectorAll<HTMLElement>('div.chart-block'))
    setChartMounts(els.map((el) => ({ el, attrs: readChartBlockAttrs(el) })))
  }, [lesson, segMode]) // segMode: читалка пересобирает DOM конспекта
  const audio = useLessonAudio({
    lessonId: lesson.id,
    segments,
    active: segMode === 'listen',
    onListened: () => autoComplete('listen'),
    onError: (e) => {
      if (e.kind === 'fatal') {
        showToast(e.message)
        setSegMode('read') // тост «Озвучка недоступна» + возврат в «Читать»
      } else if (e.kind === 'toast') {
        showToast(e.message)
      }
      // kind === 'disabled' — заглушка «Аудио временно отключено» по audio.disabled
    },
  })

  // ТЗ-132 Задача 4 п.3: автозачёт за скролл — sentinel после конспекта
  // должен быть виден ≥2 с непрерывно (уход из вьюпорта сбрасывает таймер).
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !lesson.text_content) return
    let timer: number | undefined
    const io = new IntersectionObserver(
      entries => {
        for (const en of entries) {
          if (en.isIntersecting) {
            if (timer == null) {
              timer = window.setTimeout(() => autoComplete('scroll'), 2000)
            }
          } else if (timer != null) {
            window.clearTimeout(timer)
            timer = undefined
          }
        }
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      if (timer != null) window.clearTimeout(timer)
    }
  }, [lesson.id, lesson.text_content, autoComplete])

  // ТЗ-132 Задача 3: читалка — страница и посещённые страницы на сессию.
  const handleRmPage = useCallback((p: number) => {
    setRmPage(p)
    setVisited(prev => (prev.has(p) ? prev : new Set(prev).add(p)))
  }, [])

  const onReadDone = useCallback(() => {
    if (!lesson.has_full_access || completed) return
    if (hasTest) {
      setReadOpen(false)
      showToast('Конспект прочитан — теперь тест')
      scrollToTest()
      return
    }
    completeLesson(lesson.id).then(reload).catch(() => undefined)
    setRmDone(true)
    // ТЗ-149: глобальный тост при открытой читалке не показываем —
    // ReadMode сам рисует .rm-note «Урок засчитан» (~3 с) по факту completed
  }, [completed, hasTest, lesson.id, lesson.has_full_access, reload, scrollToTest, showToast])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      <div
        className="pt-24 pb-10"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 212, 255, 0.06), transparent)' }}
      >
        <div className="max-w-[1200px] mx-auto px-6 md:px-12">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <Link
              to={`/education/${encodeURIComponent(lesson.course_slug)}`}
              className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-white transition-colors mb-6 max-w-full"
            >
              <ArrowLeft size={16} className="flex-none" />
              {/* ТЗ-127 Задача 3: крошка мокапа — ellipsis на мобильном */}
              <span
                className="min-w-0"
                style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                Образование · {lesson.course_title} · Урок {lesson.position}
              </span>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutExpo }}
          >
            {/* ТЗ-127 Задача 3: eyebrow «Урок N из M · Видео» (мокап .l-eyebrow) */}
            <p className="l-eyebrow">Урок {lesson.position} из {lesson.total_lessons} · {KIND_LABEL[lesson.kind] || 'Урок'}</p>
            <h1
              className="text-white font-bold tracking-tight mb-4"
              style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', lineHeight: 1.15 }}
            >
              {lesson.title}
            </h1>
            {lesson.duration_min != null && (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-[#9CA3AF]">
                <Clock size={14} />
                {lesson.duration_min} мин
              </span>
            )}
          </motion.div>
        </div>
      </div>

      {/* ТЗ-127 Задача 2: липкий стрип «Прогресс курса» — только залогиненному
          (у гостя прогресса нет, course_progress анониму всё равно 0/0). */}
      {isLoggedIn && lesson.course_progress.total_lessons > 0 && (
        <div className="lesson-strip">
          <div className="strip-in">
            <span className="s-label">Прогресс курса <b>{lesson.course_progress.percent}%</b></span>
            <div className="progress">
              <i style={{ width: `${lesson.course_progress.percent}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1200px] mx-auto px-6 md:px-12 pb-20">
        {/* ТЗ-127 Задача 1: open-banner гостю на free-preview уроке */}
        {!isLoggedIn && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOutExpo }}
            className="open-banner mt-2"
          >
            <div>
              Это <b>открытый урок</b> курса. Полная программа, тесты и материалы — после записи.
            </div>
            <Link
              to={`/education/${encodeURIComponent(lesson.course_slug)}`}
              className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-[12.5px] font-bold transition-all hover:brightness-115"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
            >
              Записаться на курс
            </Link>
          </motion.div>
        )}

        {/* ТЗ-127 Задача 7: layout 1fr + сайдбар «Программа курса» (на <960px
            сайдбар уходит вниз — колонка одна, aside после контента). */}
        <div className="lesson-layout">
          <div>
        {/* Видео (embed из белого списка доменов — бэк валидирует).
            ТЗ-129: детект недоступности эвристический (cross-origin iframe
            не даёт статуса) — нет onLoad за 6 с или нативный onError →
            карточка ошибки с «Повторить». Ограничение v1: если хост отдал
            загруженный iframe-документ, а видео внутри заблокировано —
            эвристика это не ловит. */}
        {embedUrl && !videoFailed && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: easeOutExpo }}
            className="rounded-2xl overflow-hidden mb-8"
            style={{ border: '1px solid rgba(255,255,255,.08)' }}
          >
            <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
              <iframe
                key={videoRetryKey}
                src={embedUrl}
                title={lesson.title}
                className="absolute inset-0 w-full h-full"
                style={{ border: 0 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onLoad={() => { videoLoadedRef.current = true }}
                onError={() => setVideoFailed(true)}
              />
            </div>
          </motion.div>
        )}
        {embedUrl && videoFailed && (
          <VideoErrorCard
            host={videoHostName(lesson.video_embed_url)}
            onRetry={() => {
              setVideoFailed(false)
              videoLoadedRef.current = false
              setVideoRetryKey(k => k + 1)
            }}
          />
        )}

        {/* ТЗ-132 Задача 1: ридер-бар — слева сегмент «Читать/Слушать», справа
            А−/100%/А+ и кнопка читалки (в режиме «Слушать» контролы скрыты).
            Масштаб — CSS-переменная --reader-scale на контейнере (.edu-content
            умножает кегли на var(--reader-scale,1)). */}
        {lesson.text_content && (
          <div className="reader-bar">
            <div className="seg-mode" role="tablist" aria-label="Режим конспекта">
              <button
                type="button"
                className={segMode === 'read' ? 'on' : ''}
                onClick={() => setSegMode('read')}
                role="tab"
                aria-selected={segMode === 'read'}
              >
                <BookIcon /> Читать
              </button>
              <button
                type="button"
                className={segMode === 'listen' ? 'on' : ''}
                onClick={() => setSegMode('listen')}
                role="tab"
                aria-selected={segMode === 'listen'}
              >
                <SpeakerIcon /> Слушать
              </button>
            </div>
            {segMode === 'read' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="rb-btn"
                  title="Уменьшить текст"
                  disabled={readerScale <= 0.8}
                  onClick={() => setScale(readerScale - 0.1)}
                >
                  А−
                </button>
                <span className="rb-val" title="Сбросить размер" onClick={() => setScale(1)}>
                  {Math.round(readerScale * 100)}%
                </span>
                <button
                  type="button"
                  className="rb-btn"
                  title="Увеличить текст"
                  disabled={readerScale >= 1.3}
                  onClick={() => setScale(readerScale + 0.1)}
                >
                  А+
                </button>
                {/* ТЗ-132 Задача 3: вход в полноэкранную читалку (только «Читать»). */}
                <button type="button" className="rb-full" title="Режим чтения" onClick={() => setReadOpen(true)}>
                  <ExpandIcon />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ТЗ-132 Задача 2: аудио-линия «Слушать» — под reader-bar, текст
            конспекта на странице остаётся (можно следить глазами). */}
        {lesson.text_content && segMode === 'listen' && (
          audio.disabled ? (
            <div className="listen-bar">
              <span className="lb-disabled">Аудио временно отключено</span>
            </div>
          ) : (
            <div className="listen-bar">
              <button type="button" className="lb-play" onClick={audio.toggle} title="Слушать конспект">
                {audio.playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <div className="lb-body">
                <div
                  className="lb-track"
                  onClick={e => {
                    const r = e.currentTarget.getBoundingClientRect()
                    audio.seekByFraction((e.clientX - r.left) / r.width)
                  }}
                >
                  <i style={{ width: `${audio.pct}%` }} />
                </div>
                <div className="lb-meta">
                  <span>{fmtTime(audio.cur)}</span>
                  <span>
                    ≈ {fmtTime(audio.total)} · голос «Диктор»{audio.browserVoice ? ' · браузерный' : ''}
                  </span>
                </div>
              </div>
              <button type="button" className="lb-speed" onClick={audio.cycleSpeed} title="Скорость озвучки">
                {audio.speedLabel}
              </button>
            </div>
          )
        )}

        {/* Текст урока — HTML, санитизированный на бэке (sanitizeLessonHtml).
            Типографика — общий .edu-content (ТЗ-108), тот же класс, что в
            предпросмотре админки и карточке курса. */}
        {lesson.text_content && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: easeOutExpo }}
            className="edu-content rounded-2xl px-6 py-6 mb-8 text-[#D1D5DB] leading-relaxed"
            style={{
              background: 'rgba(255,255,255,.02)',
              border: '1px solid rgba(255,255,255,.05)',
              ['--reader-scale' as string]: readerScale,
            }}
            ref={contentRef}
            dangerouslySetInnerHTML={{ __html: resolveMediaHtml(lesson.text_content) }}
          />
        )}
        {lesson.text_content && chartMounts.map((m, i) => createPortal(
          <LessonChartBlock key={`${m.attrs.ticker}-${m.attrs.exchange}-${i}`} {...m.attrs} />,
          m.el,
        ))}

        {/* ТЗ-132 Задача 4 п.3: sentinel скролл-автозачёта — пустой div сразу
            после конспекта (виден ≥2 с непрерывно → вилка автозачёта). */}
        {lesson.text_content && (
          <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
        )}

        {/* ТЗ-124: CTA-кнопки урока — после конспекта, перед материалами.
            Внутренняя ссылка («/…») с target=self — Link; остальное — <a>. */}
        {lesson.buttons && lesson.buttons.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: easeOutExpo }}
            className="l-ctas"
          >
            {lesson.buttons.map((btn, i) => (
              <LessonCta key={i} btn={btn} lessonId={lesson.id} />
            ))}
          </motion.div>
        )}

        {/* ТЗ-123: материалы урока — перенос 1:1 из мокапа lesson.html
            (карточки как «Материалы курса», одна колонка). Пустой массив —
            секция не рендерится вообще. */}
        {lesson.materials.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: easeOutExpo }}
            className="l-materials"
          >
            <div className="l-materials-head">
              <div className="l-materials-title">
                <span className="inline-block w-2 h-2 rounded-full flex-none" style={{ background: '#00D4FF' }} />
                Материалы урока
              </div>
              <span className="l-materials-note">Файлы и ссылки к этому уроку</span>
            </div>
            <div className="l-materials-list">
              {lesson.materials.map(m => {
                const locked = !m.is_free && !lesson.has_full_access
                const kindMeta =
                  m.kind === 'news'
                    ? 'Новость PULSE'
                    : m.kind === 'link'
                      ? 'Внешняя ссылка'
                      : materialExt(m.url).toUpperCase() || 'Файл'
                const inner = (
                  <>
                    <span className={`m-ico${m.kind === 'news' ? ' news' : ''}`}>
                      {m.kind === 'news' ? (
                        <Newspaper size={18} strokeWidth={1.5} fill="none" />
                      ) : m.kind === 'link' ? (
                        <Link2 size={18} strokeWidth={1.5} />
                      ) : (
                        <Download size={18} strokeWidth={1.5} />
                      )}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="m-title">{m.title}</div>
                      <div className="m-kind">{kindMeta}</div>
                    </div>
                    {locked && (
                      <span className="m-lock">
                        <Lock size={16} strokeWidth={1.5} />
                      </span>
                    )}
                  </>
                )
                // locked-строка не кликабельна (как locked-материалы курса);
                // news — внутренняя ссылка на новость (ТЗ-123)
                if (locked) {
                  return (
                    <div key={m.id} className="material locked">
                      {inner}
                    </div>
                  )
                }
                if (m.kind === 'news') {
                  return (
                    <Link key={m.id} className="material" to={`/news/${m.news_id || m.id}`}>
                      {inner}
                    </Link>
                  )
                }
                if (m.kind === 'link' && m.url) {
                  return (
                    <a key={m.id} className="material" href={m.url} target="_blank" rel="noopener noreferrer">
                      {inner}
                    </a>
                  )
                }
                return (
                  <a key={m.id} className="material" href={materialDownloadPath(m.id)}>
                    {inner}
                  </a>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Тест: correct на бэке не отдаём — грейдинг через POST /lessons/:id/test.
            ТЗ-127 Задача 5: violet-оформление мокапа, радио-кружки, подсветка
            выбранных после проверки, «Попробовать ещё». */}
        {hasTest && !testPassedNow && (
          <motion.div
            ref={testRef}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: easeOutExpo }}
            className="l-test"
          >
            <div className="l-test-head">
              <h2 className="l-test-title">
                <span className="tick" />
                Тест к уроку
              </h2>
            </div>
            <p className="l-test-rules">
              {lesson.test!.questions.length}{' '}
              {lesson.test!.questions.length === 1 ? 'вопрос' : lesson.test!.questions.length < 5 ? 'вопроса' : 'вопросов'} ·
              проходной балл <b>{lesson.test!.pass_score}%</b> ·{' '}
              {lesson.test!.is_blocking
                ? <>тест <b>блокирующий</b>: без прохождения следующий урок не откроется</>
                : 'тест неблокирующий'}
            </p>
            <div>
              {lesson.test!.questions.map((q, qi) => (
                <div key={qi} className="l-q">
                  <p className="l-q-title">
                    <span className="q-num">{String(qi + 1).padStart(2, '0')}</span>
                    <span>{q.q}</span>
                  </p>
                  <div>
                    {q.options.map((opt, oi) => {
                      const selected = answers[qi] === oi
                      // Подсветка после проверки: правильных индексов бэк не отдаёт
                      // (критерий 4 ТЗ-100) — выбранные помечаем ok при passed /
                      // bad при провале, опции блокируются до «Попробовать ещё».
                      const stateCls = testResult
                        ? selected
                          ? testResult.passed ? ' ok' : ' bad'
                          : ' lock'
                        : selected ? ' sel' : ''
                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() =>
                            setAnswers(prev => prev.map((a, i) => (i === qi ? oi : a)))
                          }
                          className={`l-opt w-full text-left${stateCls}`}
                        >
                          <span className="radio" />
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            {testError && <p className="text-[12px] text-[#F87171] mt-4">{testError}</p>}
            {testResult && !testResult.passed && (
              <div className="l-test-result fail">
                <span>
                  Набрано <b>{testResult.score}%</b> — нужно минимум {lesson.test!.pass_score}%. Попробуйте ещё раз.
                </span>
              </div>
            )}
            <div className="flex gap-2.5 mt-5 flex-wrap">
              <button
                type="button"
                disabled={submitting}
                onClick={runTest}
                className="h-11 px-6 rounded-xl text-[13px] font-bold transition-all hover:brightness-115 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
              >
                {submitting ? 'Проверяем…' : 'Проверить ответы'}
              </button>
              {testResult && !testResult.passed && (
                <button
                  type="button"
                  onClick={resetTest}
                  className="h-11 px-6 rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
                  style={{ border: '1px solid #222', background: 'transparent', color: '#fff' }}
                >
                  Попробовать ещё
                </button>
              )}
            </div>
          </motion.div>
        )}

        {testPassedNow && (
          <div
            className="l-test-result pass mb-8"
          >
            <CheckCircle2 size={18} />
            <span>
              Тест пройден
              {lesson.progress?.test_score != null && <> — <b>{lesson.progress.test_score}%</b></>}
            </span>
          </div>
        )}

        {/* Прогресс */}
        {!hasTest && (
          <div className="flex items-center gap-3 mb-8">
            {completed ? (
              <span className="inline-flex items-center gap-2 text-[13px]" style={{ color: '#34D399' }}>
                <CheckCircle2 size={16} />
                Урок пройден
              </span>
            ) : (
              <button
                type="button"
                disabled={completing}
                onClick={markCompleted}
                className="h-11 px-6 rounded-xl text-[13px] font-bold transition-all hover:brightness-115 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
              >
                {completing ? 'Сохраняем…' : 'Отметить пройденным'}
              </button>
            )}
            {completeError && <p className="text-[12px] text-[#F87171]">{completeError}</p>}
          </div>
        )}

        {/* ТЗ-127 Задача 6: навигация с номерами уроков; «Следующий» заблокирован
            (disabled + amber-подсказка), пока блокирующий тест не пройден —
            раньше юзер попадал на 403 test_blocked. */}
        <div className="lesson-nav">
          {lesson.prev_lesson ? (
            <Link
              to={`/education/lesson/${lesson.prev_lesson.id}`}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-[13px] font-semibold transition-all hover:brightness-115"
              style={{ border: '1px solid #222', background: 'transparent', color: '#9CA3AF' }}
            >
              <ChevronLeft size={16} />
              Урок {lesson.prev_lesson.position}
            </Link>
          ) : (
            <span />
          )}
          {nextBlocked && (
            <span className="nav-note">
              ⚠ Сначала пройдите тест — он блокирует дальнейшее прохождение
            </span>
          )}
          {lesson.next_lesson ? (
            nextBlocked ? (
              <span
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-bold"
                style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606', opacity: 0.4, cursor: 'not-allowed' }}
              >
                Урок {lesson.next_lesson.position}
                <ArrowRight size={14} />
              </span>
            ) : (
              <Link
                to={`/education/lesson/${lesson.next_lesson.id}`}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
                style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
              >
                Урок {lesson.next_lesson.position}
                <ArrowRight size={14} />
              </Link>
            )
          ) : (
            <Link
              to={`/education/${encodeURIComponent(lesson.course_slug)}`}
              className="inline-flex items-center gap-1.5 text-sm text-[#00D4FF] hover:underline"
            >
              К программе курса
            </Link>
          )}
        </div>
          </div>

          {/* ТЗ-127 Задача 7: сайдбар «Программа курса» (мокап .side-*).
              Locked-статусы v1 сознательно не вычисляем (drip/test-цепочки
              фронту не видны) — закрытый урок корректно покажет свою 403-
              страницу. Гостю программа видна, completed все false. */}
          <aside className="lesson-side">
            <div className="side-card">
              <div className="side-title">Программа курса</div>
              {lesson.program.map(p => {
                const cls = p.id === lesson.id ? 'side-lesson current' : p.completed ? 'side-lesson done' : 'side-lesson'
                return (
                  <Link key={p.id} to={`/education/lesson/${p.id}`} className={cls} title={p.title}>
                    <span className="s-dot">{p.completed && p.id !== lesson.id ? '✓' : p.position}</span>
                    <span className="s-name">{p.title}</span>
                  </Link>
                )
              })}
            </div>
          </aside>
        </div>

        {/* ТЗ-132 Задача 3: полноэкранная читалка конспекта (fixed-оверлей). */}
        {lesson.text_content && (
          <ReadMode
            lessonId={lesson.id}
            title={lesson.title}
            html={lesson.text_content}
            open={readOpen}
            onClose={() => setReadOpen(false)}
            page={rmPage}
            onPageChange={handleRmPage}
            pages={rmPages}
            onPages={setRmPages}
            readerScale={readerScale}
            allVisited={rmPages > 0 && visited.size >= rmPages}
            hasTest={hasTest}
            completed={completed || rmDone}
            canComplete={lesson.has_full_access && !completed}
            onDone={onReadDone}
            nextLesson={lesson.next_lesson}
            courseSlug={lesson.course_slug}
          />
        )}

        {/* ТЗ-132: тосты автозачёта/ошибок озвучки.
            ТЗ-134: portal в body — тот же transformed-ancestor, что и у читалки;
            иначе тост заперт в stacking context <main> под шапкой. */}
        {toast && createPortal(<div className="lesson-toast">{toast}</div>, document.body)}
      </div>
    </div>
  )
}

// ТЗ-123: расширение файла материала для kind-меты («PDF», «XLSX»…) — из url
function materialExt(url: string | null): string {
  if (!url) return ''
  const m = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url)
  return m ? m[1] : ''
}

// ТЗ-129: одна CTA-кнопка урока. target=new_tab → новая вкладка + иконка ↗;
// target=self + «/…» → SPA-навигация; внешняя https → обычный переход.
function LessonCta({ btn, lessonId }: { btn: LessonButton; lessonId: string }) {
  const cls = `cta-btn c-${btn.color}`
  const track = () =>
    logAnalyticsEvent('education.lesson_cta_click', { lesson_id: lessonId, url: btn.url })
  const inner = (
    <>
      {btn.label}
      {btn.target === 'new_tab' && <ArrowUpRight size={15} strokeWidth={2} className="cta-ext" />}
    </>
  )
  if (btn.target === 'self' && btn.url.startsWith('/')) {
    return (
      <Link to={btn.url} className={cls} onClick={track}>
        {inner}
      </Link>
    )
  }
  if (btn.target === 'new_tab') {
    return (
      <a href={btn.url} target="_blank" rel="noopener noreferrer" className={cls} onClick={track}>
        {inner}
      </a>
    )
  }
  return (
    <a href={btn.url} className={cls} onClick={track}>
      {inner}
    </a>
  )
}

// ТЗ-129: красивое имя хоста видео из video_embed_url (для карточки ошибки).
// Функция не падает — try/catch, fallback 'Видео'.
function videoHostName(url: string | null): string {
  if (!url) return 'Видео'
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (/^(youtube\.com|youtu\.be|youtube-nocookie\.com|m\.youtube\.com)$/.test(host)) return 'YouTube'
    if (/^(vkvideo\.ru|vk\.com)$/.test(host)) return 'VK Видео'
    if (host === 'vimeo.com') return 'Vimeo'
    return host
  } catch {
    return 'Видео'
  }
}

// ТЗ-129: карточка «Сервис видео временно недоступен» — вместо мёртвого
// чёрного iframe (перенос 1:1 из мокапа f988368, .player-err). Размер 16:9 —
// конспект под карточкой не прыгает.
function VideoErrorCard({ host, onRetry }: { host: string; onRetry: () => void }) {
  return (
    <div className="player-err">
      <span className="pe-host">{host}</span>
      <div className="pe-ico">
        {/* video-off: перечёркнутая камера */}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="M16 10.5l5-3v9l-5-3z" strokeLinejoin="round" />
          <path d="M3.5 3.5l17 17" strokeLinecap="round" />
        </svg>
      </div>
      <div className="pe-title">Сервис видео временно недоступен</div>
      <div className="pe-text">
        {host} не отвечает — это замедление на стороне видео-сервиса, не у вас.
        Конспект и материалы урока ниже доступны полностью.
      </div>
      <div className="pe-actions">
        <button type="button" className="btn-ghost-video" onClick={onRetry}>↻ Повторить</button>
        <a
          className="btn-accent-video"
          href="mailto:vladfa@yandex.ru?subject=%D0%92%D0%B8%D0%B4%D0%B5%D0%BE%20%D0%BD%D0%B5%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%BD%D0%BE%20%E2%80%94%20%D1%83%D1%80%D0%BE%D0%BA%20%D0%BA%D1%83%D1%80%D1%81%D0%B0"
        >
          Написать в поддержку
        </a>
      </div>
    </div>
  )
}
