import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  CircleHelp,
  Clock,
  GraduationCap,
  Lock,
} from 'lucide-react'
import {
  completeLesson,
  fetchLesson,
  submitLessonTest,
  type LessonContent,
} from '@/lib/educationApi'
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
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => lesson.test?.questions.map(() => null) ?? [],
  )
  const [testResult, setTestResult] = useState<{ score: number; passed: boolean } | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  const hasTest = !!lesson.test && lesson.test.questions.length > 0
  const completed = !!lesson.progress?.completed
  const embedUrl = useMemo(
    () => (lesson.video_embed_url ? toEmbedUrl(lesson.video_embed_url) : null),
    [lesson.video_embed_url],
  )

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      <div
        className="pt-24 pb-10 px-6 md:px-12"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 212, 255, 0.06), transparent)' }}
      >
        <div className="max-w-[860px] mx-auto">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <Link
              to={`/education/${encodeURIComponent(lesson.course_slug)}`}
              className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-white transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              <span>{lesson.course_title}</span>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutExpo }}
          >
            <p className="text-[12px] text-[#6B7280] mb-2">Урок {lesson.position}</p>
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

      <div className="max-w-[860px] mx-auto px-6 md:px-12 pb-20">
        {/* Видео (embed из белого списка доменов — бэк валидирует) */}
        {embedUrl && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: easeOutExpo }}
            className="rounded-2xl overflow-hidden mb-8"
            style={{ border: '1px solid rgba(255,255,255,.08)' }}
          >
            <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
              <iframe
                src={embedUrl}
                title={lesson.title}
                className="absolute inset-0 w-full h-full"
                style={{ border: 0 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </motion.div>
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
            }}
            dangerouslySetInnerHTML={{ __html: lesson.text_content }}
          />
        )}

        {/* Тест: correct на бэке не отдаём — грейдинг через POST /lessons/:id/test */}
        {hasTest && !testPassedNow && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: easeOutExpo }}
            className="rounded-2xl p-6 mb-8"
            style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <CircleHelp size={16} style={{ color: '#00D4FF' }} />
              <h2 className="text-white font-semibold">Тест урока</h2>
            </div>
            <p className="text-[12px] text-[#6B7280] mb-5">
              Проходной балл: {lesson.test!.pass_score}%. {!lesson.test!.is_blocking && 'Тест неблокирующий.'}
            </p>
            <div className="space-y-5">
              {lesson.test!.questions.map((q, qi) => (
                <div key={qi}>
                  <p className="text-sm text-white mb-2">
                    {qi + 1}. {q.q}
                  </p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => {
                      const selected = answers[qi] === oi
                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() =>
                            setAnswers(prev => prev.map((a, i) => (i === qi ? oi : a)))
                          }
                          className="w-full text-left px-3 py-2 rounded-lg text-[13px] transition-all"
                          style={{
                            background: selected ? 'rgba(0,212,255,.08)' : 'rgba(255,255,255,.02)',
                            border: `1px solid ${selected ? 'rgba(0,212,255,.4)' : 'rgba(255,255,255,.06)'}`,
                            color: selected ? '#fff' : '#9CA3AF',
                          }}
                        >
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
              <p className="text-[13px] text-[#FBBF24] mt-4">
                Набрано {testResult.score}% — нужно минимум {lesson.test!.pass_score}%. Попробуйте ещё раз.
              </p>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={runTest}
              className="mt-5 h-11 px-6 rounded-xl text-[13px] font-bold transition-all hover:brightness-115 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
            >
              {submitting ? 'Проверяем…' : 'Проверить ответы'}
            </button>
          </motion.div>
        )}

        {testPassedNow && (
          <div
            className="flex items-center gap-2 rounded-2xl px-5 py-4 mb-8 text-[13px]"
            style={{ background: 'rgba(52,211,153,.06)', border: '1px solid rgba(52,211,153,.25)', color: '#34D399' }}
          >
            <CheckCircle2 size={16} />
            Тест пройден
            {lesson.progress?.test_score != null && ` — ${lesson.progress.test_score}%`}
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

        {/* Навигация prev/next */}
        <div className="flex items-center justify-between gap-3 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
          {lesson.prev_lesson_id ? (
            <Link
              to={`/education/lesson/${lesson.prev_lesson_id}`}
              className="inline-flex items-center gap-1.5 text-sm text-[#9CA3AF] hover:text-white transition-colors"
            >
              <ChevronLeft size={16} />
              Предыдущий урок
            </Link>
          ) : (
            <span />
          )}
          {lesson.next_lesson_id ? (
            <Link
              to={`/education/lesson/${lesson.next_lesson_id}`}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
            >
              Следующий урок
              <ArrowRight size={14} />
            </Link>
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
    </div>
  )
}
