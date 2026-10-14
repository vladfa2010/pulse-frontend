import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { fetchGraph } from '@/lib/educationApi'
import type { GraphCourseNode, GraphLessonState, KnowledgeGraph } from '@/lib/educationApi'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'

// «Карта знаний» (ТЗ-107 v3, §4.1; мокап education.html .kmap v15): все курсы
// и уроки в едином смысловом графе. Рендерится ручным SVG (без библиотек),
// layout детерминирован от FNV-1a(id) — без Math.random(), чтобы картинка
// была одинаковой при каждом заходе. graph: null или 404 (фичефлаг
// EDUCATION_GRAPH_ENABLED выкл) — секция не рендерится вообще.

const W = 1200
const H = 560

// FNV-1a: одинаковый id → одинаковые координаты на любом клиенте/сервере.
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function pluralLessons(n: number): string {
  const m = n % 10
  const h = n % 100
  if (m === 1 && h !== 11) return 'урок'
  if (m >= 2 && m <= 4 && (h < 10 || h >= 20)) return 'урока'
  return 'уроков'
}

// Толщина/прозрачность рёбер — формула из ТЗ §4.1/§4.2 (и мокапов).
const edgeWidth = (sim: number) => 0.8 + sim * 2.2
const edgeOpacity = (sim: number) => 0.35 + sim * 0.6

// Дуга через квадратичную кривую со смещением середины вверх (−26px, ТЗ).
function arcPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2 - 26
  return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`
}

interface Tip {
  x: number
  y: number
  body: React.ReactNode
}

interface LessonPt {
  id: string
  title: string
  courseId: string
  state?: GraphLessonState
  x: number
  y: number
}

interface CoursePt {
  course: GraphCourseNode
  x: number
  y: number
  r: number
  mine: boolean
  percent: number | null
}

const LESSON_TIP_STATE: Record<GraphLessonState, string> = {
  done: 'Пройден',
  current: 'Вы здесь',
  locked: 'Откроется позже',
  open: 'Доступен',
}

export default function KnowledgeMap() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const lastTapRef = useRef<string | null>(null)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isLoggedIn } = useAuth()

  useEffect(() => {
    let cancelled = false
    fetchGraph()
      .then(data => { if (!cancelled) setGraph(data?.graph ?? null) })
      // 404 (флаг выкл) и прочие ошибки — секция молча скрыта.
      .catch(() => { if (!cancelled) setGraph(null) })
    return () => { cancelled = true }
    // isLoggedIn в deps: my_progress/my_courses приезжают только авторизованным.
  }, [isLoggedIn])

  const layout = useMemo(() => {
    if (!graph || graph.nodes.courses.length === 0) return null
    const progress = graph.my_progress ?? {}
    const myCourses = new Set(graph.my_courses ?? [])
    const lessonsByCourse = new Map<string, { id: string; title: string }[]>()
    graph.nodes.lessons.forEach(l => {
      const arr = lessonsByCourse.get(l.course_id)
      if (arr) arr.push(l)
      else lessonsByCourse.set(l.course_id, [l])
    })

    const coursePts: CoursePt[] = []
    const lessonPts: LessonPt[] = []
    const lessonPos = new Map<string, { x: number; y: number }>()

    graph.nodes.courses.forEach(c => {
      const lessons = lessonsByCourse.get(c.id) ?? []
      const h = fnv1a(c.id)
      // Радиус узла-курса — от числа уроков (формула мокапа).
      const r = 15 + Math.min(lessons.length, 20) * 1.2
      const x = 90 + (h % 1000)
      const y = Math.max(r + 12, Math.min(70 + ((h >>> 12) % 400), H - r - 46))
      // Орбита уроков вокруг курса; стартовый угол — от хэша (mockup .off).
      const orbit = r + 24 + Math.min(lessons.length, 14) * 3
      const off = ((h >>> 22) % 628) / 100
      const n = lessons.length
      lessons.forEach((l, j) => {
        const a = off + j * ((2 * Math.PI) / Math.max(n, 1)) - Math.PI / 2
        const px = Math.round(x + orbit * Math.cos(a))
        const py = Math.round(y + orbit * Math.sin(a))
        lessonPts.push({ id: l.id, title: l.title, courseId: c.id, state: progress[l.id], x: px, y: py })
        lessonPos.set(l.id, { x: px, y: py })
      })
      const mine = myCourses.has(c.id)
      const done = lessons.filter(l => progress[l.id] === 'done').length
      coursePts.push({
        course: c, x, y, r, mine,
        percent: mine && n > 0 ? Math.round((done / n) * 100) : null,
      })
    })

    const coursePos = new Map(coursePts.map(p => [p.course.id, p]))
    const courseEdges = graph.edges.courses
      .filter(e => coursePos.has(e.a) && coursePos.has(e.b))
      .map(e => ({ e, a: coursePos.get(e.a)!, b: coursePos.get(e.b)! }))
    const lessonEdges = graph.edges.lessons
      .filter(e => lessonPos.has(e.a) && lessonPos.has(e.b))
      .map(e => ({ e, a: lessonPos.get(e.a)!, b: lessonPos.get(e.b)! }))

    return { coursePts, lessonPts, courseEdges, lessonEdges }
  }, [graph])

  if (!layout) return null

  const showTip = (e: React.MouseEvent, body: React.ReactNode) => {
    setTip({
      x: Math.min(e.clientX + 14, window.innerWidth - 300),
      y: e.clientY + 14,
      body,
    })
  }

  // На тач-устройствах первый тап — тултип, второй по тому же узлу — переход.
  const isTouch = () => window.matchMedia?.('(hover: none)').matches

  const onCourseClick = (e: React.MouseEvent, p: CoursePt) => {
    if (isTouch() && lastTapRef.current !== `c:${p.course.id}`) {
      lastTapRef.current = `c:${p.course.id}`
      showTip(e, courseTipBody(p))
      return
    }
    navigate(`/education/${p.course.slug}`)
  }

  const onLessonClick = (e: React.MouseEvent, l: LessonPt) => {
    if (isTouch() && lastTapRef.current !== `l:${l.id}`) {
      lastTapRef.current = `l:${l.id}`
      showTip(e, lessonTipBody(l, graph!))
      return
    }
    if (l.state === 'locked') {
      toast('Урок ещё закрыт — сначала пройдите предыдущие')
      return
    }
    navigate(`/education/lesson/${l.id}`)
  }

  const courseTipBody = (p: CoursePt): React.ReactNode => {
    const c = p.course
    return (
      <>
        <b style={{ display: 'block', fontSize: 12.5, marginBottom: 3, color: '#fff' }}>{c.title}</b>
        <span style={{ display: 'block', fontSize: 11, color: '#6B7280' }}>
          {c.lessons_count} {pluralLessons(c.lessons_count)} · {c.students} слушателей
        </span>
        {p.percent !== null && (
          <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: '#A78BFA' }}>
            Вы проходите: {p.percent}%
          </span>
        )}
        {c.included_tariffs.length > 0 && (
          <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: '#A78BFA' }}>
            Включён в тариф {c.included_tariffs[0]}
          </span>
        )}
        {c.situational && (
          <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: '#A78BFA' }}>
            Ситуационный курс — живёт, пока жив инфоповод
          </span>
        )}
      </>
    )
  }

  const lessonTipBody = (l: LessonPt, g: KnowledgeGraph): React.ReactNode => {
    const course = g.nodes.courses.find(c => c.id === l.courseId)
    return (
      <>
        <b style={{ display: 'block', fontSize: 12.5, marginBottom: 3, color: '#fff' }}>{l.title}</b>
        <span style={{ display: 'block', fontSize: 11, color: '#6B7280' }}>
          урок курса «{course?.title ?? ''}»
        </span>
        {l.state && (
          <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: '#A78BFA' }}>
            {LESSON_TIP_STATE[l.state]}
          </span>
        )}
      </>
    )
  }

  const lessonFill = (state?: GraphLessonState): string =>
    state === 'done' ? '#34D399' : state === 'current' ? '#00D4FF' : '#3a3f46'

  return (
    <section className="max-w-[1200px] mx-auto px-6 md:px-12 mb-12 w-full">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-2 h-2 rounded-full flex-none" style={{ background: '#00D4FF' }} />
        <h2 className="text-lg font-semibold text-white">Карта знаний</h2>
      </div>
      <p className="text-[12px] text-[#6B7280] pl-[18px] mb-5">
        Все курсы и уроки связаны по смыслу: ближние курсы усиливают друг друга — клик по курсу открывает его
      </p>

      <div
        className="relative overflow-hidden"
        style={{ border: '1px solid #222', borderRadius: '1rem', background: 'rgba(255,255,255,.02)', padding: '18px 18px 12px' }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Карта знаний">
          {/* Рёбра курс↔курс — смысловая близость (violet, пунктир). */}
          {layout.courseEdges.map(({ e, a, b }) => (
            <path
              key={`ce-${e.a}-${e.b}`}
              d={arcPath(a.x, a.y, b.x, b.y)}
              fill="none"
              stroke="rgba(167,139,250,.35)"
              strokeDasharray="5 5"
              strokeWidth={edgeWidth(e.sim)}
              opacity={edgeOpacity(e.sim)}
            />
          ))}
          {/* Линии курс→урок (орбита). */}
          {layout.lessonPts.map(l => {
            const c = layout.coursePts.find(p => p.course.id === l.courseId)!
            return (
              <line
                key={`cl-${l.id}`}
                x1={c.x}
                y1={c.y}
                x2={l.x}
                y2={l.y}
                stroke="rgba(255,255,255,.14)"
                strokeWidth={1}
              />
            )
          })}
          {/* Рёбра урок↔урок cross-course (cyan, пунктир). */}
          {layout.lessonEdges.map(({ e, a, b }) => (
            <path
              key={`le-${e.a}-${e.b}`}
              d={arcPath(a.x, a.y, b.x, b.y)}
              fill="none"
              stroke="rgba(0,212,255,.30)"
              strokeDasharray="3 4"
              strokeWidth={edgeWidth(e.sim)}
              opacity={edgeOpacity(e.sim)}
            />
          ))}
          {/* Уроки — точки на орбитах. */}
          {layout.lessonPts.map(l => {
            const mineCourse = layout.coursePts.some(p => p.course.id === l.courseId && p.mine)
            return (
              <g
                key={l.id}
                style={{ cursor: 'pointer' }}
                onMouseMove={e => showTip(e, lessonTipBody(l, graph!))}
                onMouseLeave={() => setTip(null)}
                onClick={e => onLessonClick(e, l)}
              >
                <circle
                  className="km-lesson-dot"
                  cx={l.x}
                  cy={l.y}
                  r={5}
                  fill={lessonFill(l.state)}
                  stroke="rgba(255,255,255,.1)"
                  strokeWidth={3}
                />
                {/* Подписи уроков — только на курсах юзера; на <640px скрываем (CSS). */}
                {mineCourse && (
                  <text className="km-lesson-lbl" x={l.x} y={l.y + 18}>
                    {l.title}
                  </text>
                )}
              </g>
            )
          })}
          {/* Узлы-курсы. */}
          {layout.coursePts.map(p => {
            const c = p.course
            const stroke = p.mine
              ? 'rgba(0,212,255,.5)'
              : c.situational
                ? 'rgba(251,191,36,.55)'
                : 'rgba(255,255,255,.16)'
            const meta = [
              `${c.lessons_count} ${pluralLessons(c.lessons_count)}`,
              p.percent !== null ? `${p.percent}%` : null,
              p.percent === null && c.situational ? 'по инфоповоду' : null,
              p.percent === null && !c.situational && c.included_tariffs.length > 0
                ? `тариф ${c.included_tariffs[0]}`
                : null,
            ].filter(Boolean).join(' · ')
            return (
              <g
                key={c.id}
                style={{ cursor: 'pointer' }}
                onMouseMove={e => showTip(e, courseTipBody(p))}
                onMouseLeave={() => setTip(null)}
                onClick={e => onCourseClick(e, p)}
              >
                <circle cx={p.x} cy={p.y} r={p.r} fill="#17171d" stroke={stroke} strokeWidth={1.5} />
                {/* Кольцо прогресса пройденных уроков (только на курсах юзера). */}
                {p.percent !== null && (
                  <circle
                    className="km-ring"
                    cx={p.x}
                    cy={p.y}
                    r={p.r + 5}
                    pathLength={100}
                    strokeDasharray={`${p.percent} ${100 - p.percent}`}
                  />
                )}
                <text
                  x={p.x}
                  y={p.y + p.r + 18}
                  textAnchor="middle"
                  pointerEvents="none"
                  style={{ fontSize: 12, fontWeight: 600, fill: '#fff' }}
                >
                  {c.title}
                </text>
                <text
                  x={p.x}
                  y={p.y + p.r + 32}
                  textAnchor="middle"
                  pointerEvents="none"
                  style={{ fontSize: 10, fill: '#6B7280' }}
                >
                  {meta}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Легенда (мокап .km-legend). */}
        <div className="flex flex-wrap gap-[18px]" style={{ padding: '10px 4px 2px', fontSize: 11.5, color: '#9CA3AF' }}>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block rounded-full" style={{ width: 10, height: 10, background: '#17171d', border: '1px solid rgba(255,255,255,.3)' }} />
            Курс (размер — число уроков)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block rounded-full" style={{ width: 10, height: 10, border: '2px solid rgba(251,191,36,.7)' }} />
            Ситуационный (по инфоповоду)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block rounded-full" style={{ width: 10, height: 10, background: '#3a3f46' }} />
            Урок
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block rounded-full" style={{ width: 10, height: 10, background: '#34D399' }} />
            Пройден
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block rounded-full" style={{ width: 10, height: 10, background: '#00D4FF' }} />
            Вы здесь
          </span>
          <span className="inline-flex items-center gap-1.5" style={{ color: '#6B7280' }}>
            <span style={{ color: '#A78BFA' }}>- -</span>
            смысловая близость: курсов и отдельных уроков
          </span>
        </div>
      </div>

      {/* Тултип (мокап .km-tip): fixed, следует за курсором. */}
      {tip && (
        <div
          className="fixed z-[60] pointer-events-none"
          style={{
            left: tip.x,
            top: tip.y,
            maxWidth: 280,
            background: '#141419',
            border: '1px solid #00D4FF',
            borderRadius: '.625rem',
            padding: '10px 12px',
            fontSize: 12,
            lineHeight: 1.45,
            boxShadow: '0 8px 30px rgba(0,0,0,.5)',
          }}
        >
          {tip.body}
        </div>
      )}
    </section>
  )
}
