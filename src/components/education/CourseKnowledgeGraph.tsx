import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import { fetchCourseGraph } from '@/lib/educationApi'
import type { CourseGraphLesson, CourseKnowledgeGraph, GraphLessonState } from '@/lib/educationApi'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'

// «Граф знаний» курса (ТЗ-107 v3, §4.2; мокап course.html .kgraph v14): уроки
// курса с состояниями (done/current/open/locked), структурные рёбра
// (следующий урок), смысловые (эмбеддинги) и рекомендации из других курсов.
// Ручной SVG, layout детерминирован (position / FNV-1a(id)), без Math.random().
// 404 или graph: null (фичефлаг EDUCATION_GRAPH_ENABLED выкл) — секции нет.

const W = 1200
const H = 480

const edgeWidth = (sim: number) => 0.8 + sim * 2.2
const edgeOpacity = (sim: number) => 0.35 + sim * 0.6

function arcPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2 - 26
  return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`
}

// Визуал состояний узлов — ТЗ §4.2 (done/current/locked/rec); 'open' (записан,
// доступен, но не текущий) в мокапе нет — даём ему акцентный ободок «открыт».
const NODE_STYLE: Record<GraphLessonState | 'rec', { fill: string; stroke: string; sw: number }> = {
  done: { fill: 'rgba(52,211,153,.9)', stroke: 'rgba(52,211,153,.5)', sw: 5 },
  current: { fill: '#00D4FF', stroke: 'rgba(0,212,255,.35)', sw: 6 },
  open: { fill: '#3a3f46', stroke: 'rgba(0,212,255,.4)', sw: 5 },
  locked: { fill: '#3a3f46', stroke: 'rgba(255,255,255,.08)', sw: 5 },
  rec: { fill: '#A78BFA', stroke: 'rgba(167,139,250,.35)', sw: 5 },
}

const STATE_PILL: Record<GraphLessonState | 'rec', string> = {
  done: 'Пройден',
  current: 'Вы здесь — продолжить',
  open: 'Доступен — можно открыть',
  locked: 'Откроется позже по курсу',
  rec: 'Рекомендация: усилит тему',
}

interface Tip {
  x: number
  y: number
  body: React.ReactNode
}

interface NodePt {
  id: string
  title: string
  state: GraphLessonState | 'rec'
  x: number
  y: number
  courseSlug?: string
  courseTitle?: string
  sim?: number
  sharedTags?: string[]
}

export default function CourseKnowledgeGraph({ slug }: { slug: string }) {
  const [graph, setGraph] = useState<CourseKnowledgeGraph | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const lastTapRef = useRef<string | null>(null)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isLoggedIn } = useAuth()

  useEffect(() => {
    let cancelled = false
    fetchCourseGraph(slug)
      .then(data => { if (!cancelled) setGraph(data?.graph ?? null) })
      // 404 (флаг выкл / курс не published) и прочие ошибки — секция скрыта.
      .catch(() => { if (!cancelled) setGraph(null) })
    return () => { cancelled = true }
    // isLoggedIn в deps: state уроков считается бэком для текущего юзера.
  }, [slug, isLoggedIn])

  const layout = useMemo(() => {
    if (!graph || graph.lessons.length === 0) return null
    const lessons = [...graph.lessons].sort((a, b) => a.position - b.position)
    const recs = graph.recommendations ?? []

    // Узлы курса — цепочка/зигзаг по position (детерминировано от position).
    const step = lessons.length > 1 ? Math.min(84, Math.floor(940 / (lessons.length - 1))) : 0
    const byId = new Map<string, { lesson: CourseGraphLesson; x: number; y: number }>()
    const nodes: NodePt[] = lessons.map((l, i) => {
      const x = lessons.length > 1 ? 100 + i * step : 500
      const y = 140 + (i % 2) * 130
      byId.set(l.id, { lesson: l, x, y })
      return { id: l.id, title: l.title, state: l.state, x, y }
    })

    // Rec-узлы — дугой справа, детерминированно от id. Рендерим те, на которые
    // есть смысловое ребро (контракт бэка — рёбра внутри курса, но если бэк
    // положит сюда id чужих уроков — покажем их как узлы-рекомендации).
    const recByLessonId = new Map(recs.map(r => [r.lesson_id, r]))
    const externalIds = new Set<string>()
    graph.edges_semantic.forEach(e => {
      if (!byId.has(e.a)) externalIds.add(e.a)
      if (!byId.has(e.b)) externalIds.add(e.b)
    })
    const extList = Array.from(externalIds).sort()
    const extById = new Map<string, NodePt>()
    extList.forEach((id, j) => {
      const rec = recByLessonId.get(id)
      const n = Math.max(extList.length - 1, 1)
      const a = -Math.PI / 2 + (j * Math.PI) / n // дуга справа
      const x = Math.round(950 + 170 * Math.cos(a))
      const y = Math.round(240 + 165 * Math.sin(a))
      const node: NodePt = {
        id,
        title: rec?.title ?? 'Урок из другого курса',
        state: 'rec',
        x,
        y,
        courseSlug: rec?.course.slug,
        courseTitle: rec?.course.title,
        sim: rec?.sim,
        sharedTags: rec?.shared_tags,
      }
      extById.set(id, node)
      nodes.push(node)
    })

    const posOf = (id: string) => byId.get(id) ?? extById.get(id)

    const structuralEdges: { a: { x: number; y: number }; b: { x: number; y: number } }[] = []
    graph.edges_structural.forEach(pair => {
      const a = byId.get(String(pair[0]))
      const b = byId.get(String(pair[1]))
      if (a && b) structuralEdges.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } })
    })
    const semanticEdges: { e: { a: string; b: string; sim: number }; a: { x: number; y: number }; b: { x: number; y: number } }[] = []
    graph.edges_semantic.forEach(e => {
      const a = posOf(e.a)
      const b = posOf(e.b)
      if (a && b) semanticEdges.push({ e, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } })
    })

    return { nodes, structuralEdges, semanticEdges, recs }
  }, [graph])

  if (!layout) return null

  const showTip = (e: React.MouseEvent, body: React.ReactNode) => {
    setTip({
      x: Math.min(e.clientX + 14, window.innerWidth - 300),
      y: e.clientY + 14,
      body,
    })
  }

  const isTouch = () => window.matchMedia?.('(hover: none)').matches

  const nodeTipBody = (n: NodePt): React.ReactNode => (
    <>
      <b style={{ display: 'block', fontSize: 12.5, marginBottom: 3, color: '#fff' }}>{n.title}</b>
      {n.courseTitle && (
        <span style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
          {n.courseTitle}
        </span>
      )}
      {n.sim != null && (
        <span style={{ fontSize: 11, color: '#A78BFA' }}>
          Смысловая близость {n.sim.toFixed(2)}
          {n.sharedTags && n.sharedTags.length > 0 && ` — «${n.sharedTags.join(', ')}»`}
        </span>
      )}
      <span
        style={{
          display: 'inline-block',
          marginTop: 5,
          fontSize: 10.5,
          padding: '2px 8px',
          borderRadius: 999,
          border: '1px solid #222',
          color: '#9CA3AF',
        }}
      >
        {STATE_PILL[n.state]}
      </span>
    </>
  )

  const onNodeClick = (e: React.MouseEvent, n: NodePt) => {
    if (isTouch() && lastTapRef.current !== `n:${n.id}`) {
      lastTapRef.current = `n:${n.id}`
      showTip(e, nodeTipBody(n))
      return
    }
    if (n.state === 'locked') {
      toast('Урок ещё закрыт — сначала пройдите предыдущие')
      return
    }
    if (n.state === 'rec') {
      // Переход в чужой курс (на конкретный урок — когда бэк даёт lesson_id,
      // страница урока сама проверит доступ; иначе — на карточку курса).
      if (n.courseSlug) navigate(`/education/${n.courseSlug}`)
      return
    }
    navigate(`/education/lesson/${n.id}`)
  }

  return (
    <section className="max-w-[1000px] mx-auto px-6 md:px-12 mb-12">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-2 h-2 rounded-full flex-none" style={{ background: '#00D4FF' }} />
        <h2 className="text-lg font-semibold text-white">Граф знаний</h2>
      </div>
      <p className="text-[12px] text-[#6B7280] pl-[18px] mb-5">
        Уроки связаны по смыслу: видно, что пройдено и что логично пройти дальше, чтобы усилить тему
      </p>

      <div
        className="relative overflow-hidden"
        style={{ border: '1px solid #222', borderRadius: '1rem', background: 'rgba(255,255,255,.02)', padding: '18px 18px 12px' }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Граф знаний">
          {/* Структурные рёбра — следующий урок по курсу (cyan, сплошные). */}
          {layout.structuralEdges.map(({ a, b }, i) => (
            <path
              key={`se-${i}`}
              d={arcPath(a.x, a.y, b.x, b.y)}
              fill="none"
              stroke="rgba(0,212,255,.18)"
              strokeWidth={1.5}
            />
          ))}
          {/* Смысловые рёбра — близость эмбеддингов (violet, пунктир). */}
          {layout.semanticEdges.map(({ e, a, b }) => (
            <path
              key={`ge-${e.a}-${e.b}`}
              d={arcPath(a.x, a.y, b.x, b.y)}
              fill="none"
              stroke="rgba(167,139,250,.35)"
              strokeDasharray="5 5"
              strokeWidth={edgeWidth(e.sim)}
              opacity={edgeOpacity(e.sim)}
            />
          ))}
          {/* Узлы-уроки. */}
          {layout.nodes.map(n => {
            const st = NODE_STYLE[n.state]
            const r = n.state === 'current' ? 13 : 11
            return (
              <g
                key={n.id}
                style={{ cursor: 'pointer' }}
                onMouseMove={e => showTip(e, nodeTipBody(n))}
                onMouseLeave={() => setTip(null)}
                onClick={e => onNodeClick(e, n)}
              >
                {n.state === 'current' && (
                  <circle className="kg-pulse-ring" cx={n.x} cy={n.y} r={16} />
                )}
                <circle
                  className="kg-node-core"
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  fill={st.fill}
                  stroke={st.stroke}
                  strokeWidth={st.sw}
                />
                {n.state === 'done' && (
                  <text
                    x={n.x}
                    y={n.y + 4}
                    textAnchor="middle"
                    pointerEvents="none"
                    style={{ fontSize: 11, fill: '#060606' }}
                  >
                    ✓
                  </text>
                )}
                <text
                  x={n.x}
                  y={n.y + 30}
                  textAnchor="middle"
                  pointerEvents="none"
                  style={{ fontSize: 11, fill: '#9CA3AF' }}
                >
                  {n.title}
                </text>
                {n.state === 'rec' && (
                  <text
                    x={n.x}
                    y={n.y + 43}
                    textAnchor="middle"
                    pointerEvents="none"
                    style={{ fontSize: 9, fill: '#6B7280' }}
                  >
                    {n.courseTitle ?? ''}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Легенда (мокап .kg-legend). */}
        <div className="flex flex-wrap gap-[18px]" style={{ padding: '10px 4px 2px', fontSize: 11.5, color: '#9CA3AF' }}>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block rounded-full" style={{ width: 10, height: 10, background: '#34D399' }} />
            Пройдено
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block rounded-full" style={{ width: 10, height: 10, background: '#00D4FF' }} />
            Вы здесь
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block rounded-full" style={{ width: 10, height: 10, background: '#3a3f46' }} />
            Дальше по курсу
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block rounded-full" style={{ width: 10, height: 10, background: '#A78BFA' }} />
            Из других курсов — усилит тему
          </span>
          <span className="inline-flex items-center gap-1.5" style={{ color: '#6B7280' }}>
            — связь внутри курса · <span style={{ color: '#A78BFA' }}>- -</span> смысловая близость
          </span>
        </div>
      </div>

      {/* Рекомендации из других курсов: карточки урок → курс. */}
      {layout.recs.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {layout.recs.map(r => (
            <Link
              key={r.lesson_id}
              to={`/education/${r.course.slug}`}
              className="block px-4 py-3 rounded-xl transition-colors hover:bg-[rgba(255,255,255,.04)]"
              style={{ background: 'rgba(167,139,250,.04)', border: '1px solid rgba(167,139,250,.18)' }}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white line-clamp-2 mb-1">{r.title}</div>
                  <div className="text-[11px] text-[#6B7280] truncate">
                    курс «{r.course.title}»
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: '#A78BFA' }}>
                    Смысловая близость {r.sim.toFixed(2)}
                    {r.shared_tags && r.shared_tags.length > 0 && ` — «${r.shared_tags.join(', ')}»`}
                  </div>
                </div>
                <ArrowUpRight size={15} className="flex-none text-[#6B7280]" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Тултип (мокап .kg-tip): fixed, следует за курсором. */}
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
