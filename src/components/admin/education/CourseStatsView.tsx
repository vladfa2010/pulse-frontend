import { useEffect, useMemo, useState } from 'react'
import { fetchCourseStats, fetchEnrollments } from './api'
import { Btn, C, SourcePill, StatusPill } from './ui'
import type { CourseStats, CourseStatsTimelineDay, Enrollment } from './types'

// Детальный экран статистики курса (ТЗ-181): дрилл-даун из сводной табы
// (ТЗ-180). Два запроса: GET /courses/:id/stats + существующий
// /courses/:id/enrollments («кто записан» здесь не дублируется — бэкенд ТЗ-181).
// Стили — константы C, карточки как MatchSettingsBlock, SVG руками.

const SERIES: { key: keyof Omit<CourseStatsTimelineDay, 'day'>; label: string; color: string }[] = [
  { key: 'lesson_started', label: 'Старт урока', color: C.accent },
  { key: 'lesson_completed', label: 'Завершение', color: C.success },
  { key: 'test_attempt', label: 'Тест', color: C.violet },
  { key: 'material_downloaded', label: 'Материал', color: C.amber },
]

const fmtPct = (v: number | null): string => (v === null ? '—' : `${Math.round(v * 100)}%`)

const fmtAgo = (iso: string): string => {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const min = Math.max(0, Math.floor((Date.now() - t) / 60000))
  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} д назад`
}

/** Полная ось дней периода: бэк отдаёт только ненулевые дни (ТЗ-181 Задача 4). */
function buildTimeline(rows: CourseStatsTimelineDay[], days: number): CourseStatsTimelineDay[] {
  const byDay = new Map(rows.map((r) => [r.day, r]))
  const out: CourseStatsTimelineDay[] = []
  const start = new Date(Date.now() - (days - 1) * 86400000)
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10)
    out.push(byDay.get(d) ?? { day: d, lesson_started: 0, test_attempt: 0, material_downloaded: 0, lesson_completed: 0 })
  }
  return out
}

const card: React.CSSProperties = {
  background: '#0a0a0a',
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: '14px 16px',
  marginBottom: 12,
}

const h3: React.CSSProperties = { margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: C.textPrimary }

export default function CourseStatsView({
  courseId,
  days,
  onBack,
  onOpenEditor,
  toastError,
}: {
  courseId: string
  days: number
  onBack: () => void
  onOpenEditor: (id: string) => void
  toastError: (msg: string) => void
}) {
  const [data, setData] = useState<CourseStats | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setFailed(false)
    Promise.all([fetchCourseStats(courseId, days), fetchEnrollments(courseId)])
      .then(([stats, enr]) => {
        if (!alive) return
        setData(stats)
        setEnrollments(enr)
      })
      .catch((err: any) => {
        if (!alive) return
        setFailed(true)
        toastError(err?.message || 'Не удалось загрузить статистику курса')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, days])

  const timeline = useMemo(
    () => buildTimeline(data?.activity_timeline ?? [], data?.period_days ?? days),
    [data, days],
  )
  const maxDay = useMemo(() => Math.max(1, ...timeline.map((r) =>
    SERIES.reduce((s, x) => s + (r[x.key] as number), 0),
  )), [timeline])

  const filteredEnrollments = useMemo(() => {
    const list = enrollments ?? []
    const needle = q.trim().toLowerCase()
    if (!needle) return list
    return list.filter(
      (e) => (e.username || '').toLowerCase().includes(needle) || (e.email || '').toLowerCase().includes(needle),
    )
  }, [enrollments, q])

  const worstQuestions = useMemo(() => {
    const flat = (data?.lessons ?? []).flatMap((l) =>
      l.per_question.map((p) => ({ lesson: l.title, ...p })),
    )
    return flat.sort((a, b) => (b.wrong_rate ?? 0) - (a.wrong_rate ?? 0)).slice(0, 3)
  }, [data])

  if (loading) return <div style={{ color: C.textMuted, fontSize: 13, padding: '24px 0' }}>Загрузка…</div>
  if (failed || !data) {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '16px 0' }}>
        <span style={{ color: C.warning, fontSize: 13 }}>Статистика курса не загрузилась.</span>
        <Btn onClick={() => { setLoading(true); setFailed(false); void fetchCourseStats(courseId, days).then(setData).catch((e: any) => toastError(e?.message)) }}>
          Повторить
        </Btn>
        <Btn onClick={onBack}>← Все курсы</Btn>
      </div>
    )
  }

  const { funnel, sources, course } = data
  const halfwayNeed = course.lessons_count > 0 ? Math.ceil(course.lessons_count / 2) : 0
  const funnelSteps = [
    { label: 'Записались', value: funnel.enrolled },
    { label: 'Начали', value: funnel.started },
    { label: `Середина (≥${halfwayNeed} ур.)`, value: funnel.halfway },
    { label: 'Прошли полностью', value: funnel.completed },
  ]
  const sourcesTotal = Object.values(sources).reduce((s, v) => s + v, 0)

  // SVG-размеры таймлайна
  const W = 760
  const H = 170
  const padL = 26
  const padB = 22
  const padT = 6
  const chartW = W - padL - 6
  const chartH = H - padT - padB
  const slot = chartW / Math.max(1, timeline.length)
  const barW = Math.max(1, Math.min(14, slot * 0.72))

  return (
    <div>
      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <Btn sm onClick={onBack}>← Все курсы</Btn>
        <h2 style={{ margin: 0, fontSize: 16, color: C.textPrimary }}>Статистика: {course.title}</h2>
        <StatusPill status={course.status} />
        <span style={{ fontSize: 12, color: C.textMuted }}>{course.lessons_count} уроков</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => onOpenEditor(courseId)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: 12, color: C.accent, textDecoration: 'underline', fontFamily: 'inherit',
            }}
          >
            Карта прохождения (вкладка «Прогресс»)
          </button>
          <Btn sm variant="accent" onClick={() => onOpenEditor(courseId)}>Открыть редактор</Btn>
        </div>
      </div>

      {/* Воронка */}
      <div style={card}>
        <h3 style={h3}>Воронка (за всю историю)</h3>
        {funnel.enrolled === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>Записей пока нет — воронка появится после первых записей.</div>
        ) : (
          funnelSteps.map((s, i) => {
            const share = funnel.enrolled > 0 ? s.value / funnel.enrolled : 0
            const prevValue = i > 0 ? funnelSteps[i - 1].value : null
            const stepConv = prevValue !== null && prevValue > 0 ? s.value / prevValue : null
            return (
              <div key={s.label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: C.textPrimary }}>{s.label}</span>
                  <span style={{ color: C.textMuted }}>
                    {s.value} из {funnel.enrolled} · {Math.round(share * 100)}%
                    {stepConv !== null && ` · шаг ${Math.round(stepConv * 100)}%`}
                  </span>
                </div>
                <div style={{ height: 14, background: C.bgHover, borderRadius: 7, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(1.5, share * 100)}%`, height: '100%', background: C.accent, borderRadius: 7 }} />
                </div>
              </div>
            )
          })
        )}
        <p style={{ margin: '8px 0 0', fontSize: 11, color: C.textMuted }}>
          «Начали» — по событиям ТЗ-179, накапливаются с даты выката; записи и завершения — за всю историю.
        </p>
      </div>

      {/* Активность по дням */}
      <div style={card}>
        <h3 style={h3}>Активность по дням (период {data.period_days} дн.)</h3>
        <div style={{ display: 'flex', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
          {SERIES.map((s) => (
            <span key={s.key} style={{ fontSize: 11, color: C.textMuted, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />
              {s.label}
            </span>
          ))}
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Активность по дням">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={padL} x2={W - 6} y1={padT + chartH * (1 - f)} y2={padT + chartH * (1 - f)} stroke={C.border} strokeWidth={1} />
              <text x={padL - 4} y={padT + chartH * (1 - f) + 3} fontSize={8} fill={C.textMuted} textAnchor="end">
                {Math.round(maxDay * f)}
              </text>
            </g>
          ))}
          {timeline.map((r, i) => {
            const x = padL + i * slot + (slot - barW) / 2
            let y = padT + chartH
            const parts = SERIES.map((s) => {
              const h = (r[s.key] / maxDay) * chartH
              y -= h
              return h > 0 ? (
                <rect key={s.key} x={x} y={y} width={barW} height={h} fill={s.color}>
                  <title>{`${r.day}\n${SERIES.map((x2) => `${x2.label}: ${r[x2.key]}`).join('\n')}`}</title>
                </rect>
              ) : null
            })
            return <g key={r.day} data-day={r.day}>{parts}</g>
          })}
          {timeline.map((r, i) =>
            i % Math.ceil(timeline.length / 8) === 0 ? (
              <text key={r.day} x={padL + i * slot + slot / 2} y={H - 6} fontSize={8} fill={C.textMuted} textAnchor="middle">
                {r.day.slice(5)}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      {/* Кто записан | Активные за 7 дней */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ ...card, marginBottom: 0, maxHeight: 380, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <h3 style={h3}>
            Кто записан ({enrollments?.length ?? 0})
            {sourcesTotal > 0 && (
              <span style={{ fontWeight: 400, fontSize: 11, color: C.textMuted }}>
                {' '}· free {sources.free ?? 0} / purchase {sources.purchase ?? 0} / подписка {sources.subscription ?? 0} / админ {sources.admin_grant ?? 0}
              </span>
            )}
          </h3>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по имени или email…"
            style={{
              marginBottom: 8, padding: '6px 10px', fontSize: 12, borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.bgSurface, color: C.textPrimary, outline: 'none',
            }}
          />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {enrollments === null ? (
              <div style={{ color: C.textMuted, fontSize: 12 }}>Загрузка…</div>
            ) : filteredEnrollments.length === 0 ? (
              <div style={{ color: C.textMuted, fontSize: 13 }}>
                {q ? 'Никого не найдено по запросу.' : 'Записей пока нет.'}
              </div>
            ) : (
              filteredEnrollments.map((e) => (
                <div key={e.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: `1px solid ${C.borderRow}`, fontSize: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.username || e.email || e.user_id}
                    </div>
                    <div style={{ color: C.textMuted, fontSize: 10 }}>{e.email}</div>
                  </div>
                  <SourcePill source={e.source} />
                  <span style={{ color: C.textMuted, fontSize: 10, whiteSpace: 'nowrap' }}>
                    {e.progress.completed_lessons}/{e.progress.total_lessons}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ ...card, marginBottom: 0, maxHeight: 380, overflowY: 'auto' }}>
          <h3 style={h3}>Активные за 7 дней ({data.active_7d.length})</h3>
          {data.active_7d.length === 0 ? (
            <div style={{ color: C.textMuted, fontSize: 13 }}>
              Активности за последние 7 дней нет — события накапливаются с даты выката ТЗ-179.
            </div>
          ) : (
            data.active_7d.map((a) => (
              <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: `1px solid ${C.borderRow}`, fontSize: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.username || a.email || a.user_id}
                  </div>
                  <div style={{ color: C.textMuted, fontSize: 10 }}>последнее событие: {fmtAgo(a.last_event_at)}</div>
                </div>
                <span style={{ color: C.textMuted, fontSize: 10, whiteSpace: 'nowrap' }}>{a.events_7d} соб.</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Уроки */}
      <div style={{ ...card, overflowX: 'auto' }}>
        <h3 style={h3}>Уроки и стопперы</h3>
        {data.lessons.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>Уроков пока нет.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Урок', 'Завершили', 'Медианный день', 'Drop vs prev', 'Тесты (попытки / pass / балл)'].map((hLabel) => (
                  <th key={hLabel} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: C.textMuted, whiteSpace: 'nowrap' }}>
                    {hLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.lessons.map((l) => (
                <tr key={l.id} style={{ borderTop: `1px solid ${C.borderRow}` }}>
                  <td style={{ padding: '7px 8px', color: C.textPrimary, whiteSpace: 'nowrap' }}>
                    {l.position}. {l.title}
                  </td>
                  <td style={{ padding: '7px 8px', color: C.textPrimary, whiteSpace: 'nowrap' }}>
                    {l.completed} ({fmtPct(l.pct_of_enrolled)})
                  </td>
                  <td style={{ padding: '7px 8px', color: C.textMuted, whiteSpace: 'nowrap' }}>
                    {l.median_day === null ? '—' : `день ${l.median_day}`}
                  </td>
                  <td
                    style={{
                      padding: '7px 8px',
                      whiteSpace: 'nowrap',
                      color: l.drop_vs_prev === null ? C.textMuted : l.drop_vs_prev < 0 ? C.warning : C.success,
                      fontWeight: l.drop_vs_prev !== null && l.drop_vs_prev < 0 ? 700 : undefined,
                    }}
                  >
                    {l.drop_vs_prev === null ? '—' : `${l.drop_vs_prev > 0 ? '+' : ''}${Math.round(l.drop_vs_prev * 100)} п.п.`}
                  </td>
                  <td style={{ padding: '7px 8px', color: C.textPrimary, whiteSpace: 'nowrap' }}>
                    {l.test_attempts > 0
                      ? `${l.test_attempts} / ${fmtPct(l.test_pass_rate)} / ${l.avg_score ?? '—'}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Завальные вопросы */}
      <div style={card}>
        <h3 style={h3}>Завальные вопросы (топ-3)</h3>
        {worstQuestions.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>
            Данных по ответам пока нет: вопросный разрез накапливается с попытками, где сохранены ответы (ТЗ-181.2).
          </div>
        ) : (
          worstQuestions.map((w, i) => (
            <div key={`${w.lesson}-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '6px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.borderRow}`, fontSize: 12 }}>
              <span style={{ color: C.error, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtPct(w.wrong_rate)} ошибок</span>
              <span style={{ color: C.textPrimary, flex: 1 }}>{w.q}</span>
              <span style={{ color: C.textMuted, fontSize: 10, whiteSpace: 'nowrap' }}>
                {w.lesson} · {w.attempts} попыток
              </span>
            </div>
          ))
        )}
      </div>

      {/* Материалы */}
      <div style={card}>
        <h3 style={h3}>Материалы (скачивания за период)</h3>
        {data.materials.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>Материалов нет.</div>
        ) : (
          data.materials.map((m) => (
            <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '5px 0', borderTop: `1px solid ${C.borderRow}`, fontSize: 12 }}>
              <span style={{ color: C.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
              <span style={{ color: C.textMuted, fontSize: 10 }}>{m.kind}</span>
              <span style={{ color: m.downloads > 0 ? C.textPrimary : C.textMuted, whiteSpace: 'nowrap' }}>
                {m.downloads > 0 ? `${m.downloads} скач.` : '0 — не скачивали'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
