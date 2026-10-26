import { useEffect, useMemo, useState } from 'react'
import { fetchStatsOverview } from './api'
import CourseStatsView from './CourseStatsView'
import { Btn, C, StatusPill } from './ui'
import type { EduStatsOverview, EduStatsRow } from './types'

// Под-вкладка «Статистика» (ТЗ-180): сводный дешборд по всем курсам —
// воронка «записался → начал → прошёл», тесты, материалы. Один запрос
// на период (7/30/90), сортировка локальная по уже загруженным данным.
// Пороги подсветки проблем — именованные константы (ТЗ-180 Задача 2).

/** Минимум записей, при котором низкая конверсия подсвечивается (меньше — шум). */
const WARN_MIN_ENROLLED = 10
/** start_rate ниже порога при WARN_MIN_ENROLLED+ записей — проблема входа в курс. */
const WARN_START_RATE = 0.3
/** completion_rate ниже порога при WARN_MIN_ENROLLED+ записей — проблема удержания. */
const WARN_COMPLETION_RATE = 0.1

type SortKey =
  | 'title'
  | 'lessons_count'
  | 'enrolled'
  | 'started'
  | 'completion'
  | 'tests'
  | 'materials'
  | 'active'

const PERIODS = [7, 30, 90] as const

/** null рендерим «—», а не 0%: нулевая конверсия и отсутствие базы — разные смыслы. */
const fmtPct = (v: number | null): string => (v === null ? '—' : `${Math.round(v * 100)}%`)

const pluralLinks = (n: number): string => {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'ссылка'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'ссылки'
  return 'ссылок'
}

/** ТЗ-195: одна метрика сводки шеринга (значение + подпись + опциональный саб). */
function ShareStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textMuted }}>{sub}</div>}
    </div>
  )
}

export default function StatsPanel({
  onOpenCourse,
  toast,
  toastError,
}: {
  onOpenCourse: (id: string) => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
  toastError: (msg: string) => void
}) {
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<EduStatsOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('enrolled')
  const [sortAsc, setSortAsc] = useState(false)
  // ТЗ-181: дрилл-даун — детальный экран курса внутри той же табы.
  // Состояние в URL (?course=<id>): перезагрузка/шаринг сохраняют экран.
  const [courseId, setCourseId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('course'),
  )

  const setCourseInUrl = (id: string | null) => {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('course', id)
    else url.searchParams.delete('course')
    window.history.replaceState(null, '', url.toString())
  }

  const openDrill = (id: string) => {
    setCourseId(id)
    setCourseInUrl(id)
  }
  const closeDrill = () => {
    setCourseId(null)
    setCourseInUrl(null)
  }

  const load = async (d: number) => {
    setLoading(true)
    setFailed(false)
    try {
      setData(await fetchStatsOverview(d))
    } catch (err: any) {
      setFailed(true)
      toastError(err?.message || 'Не удалось загрузить статистику')
    } finally {
      setLoading(false)
    }
  }

  const changePeriod = (d: number) => {
    if (d === days && data && !failed) return
    setDays(d)
    void load(d)
  }

  // Ленивая загрузка при первом открытии вкладки (ТЗ-168/ТЗ-180):
  // панель держится смонтированной в EducationTab, сеть дёргается один раз.
  useEffect(() => {
    void load(30)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sorted = useMemo(() => {
    const rows = data?.courses ?? []
    const val = (r: EduStatsRow): string | number => {
      switch (sortKey) {
        case 'title':
          return r.title.toLowerCase()
        case 'lessons_count':
          return r.lessons_count
        case 'enrolled':
          return r.enrolled_period * 1e6 + r.enrolled_total // как сортировка по умолчанию бэка
        case 'started':
          return r.start_rate ?? -1
        case 'completion':
          return r.completion_rate ?? -1
        case 'tests':
          return r.test_attempts_period
        case 'materials':
          return r.materials_downloads_period
        case 'active':
          return r.active_learners_7d
      }
    }
    const dir = sortAsc ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb)) * dir
      }
      return (va - vb) * dir
    })
  }, [data, sortKey, sortAsc])

  const summary = useMemo(() => {
    const rows = data?.courses ?? []
    const enrolled = rows.reduce((s, r) => s + r.enrolled_period, 0)
    const started = rows.reduce((s, r) => s + r.started_period, 0)
    const downloads = rows.reduce((s, r) => s + r.materials_downloads_period, 0)
    const attempts = rows.reduce((s, r) => s + r.test_attempts_period, 0)
    return { enrolled, started, downloads, attempts }
  }, [data])

  const header = (key: SortKey, label: string) => (
    <th
      key={key}
      onClick={() => {
        if (sortKey === key) setSortAsc(v => !v)
        else {
          setSortKey(key)
          setSortAsc(key === 'title')
        }
      }}
      title="Сортировка по клику"
      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
    >
      {label}
      {sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : ''}
    </th>
  )

  return (
    <div>
      {/* ТЗ-181: дрилл-даун — детальный экран курса внутри той же табы.
          Период общий со сводной (days не сбрасывается). */}
      {courseId && (
        <CourseStatsView
          courseId={courseId}
          days={days}
          onBack={closeDrill}
          onOpenEditor={onOpenCourse}
          toastError={toastError}
        />
      )}

      {/* Период — чипы (ТЗ-180 Задача 2 п.1) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        {PERIODS.map(p => {
          const on = days === p
          return (
            <button
              key={p}
              type="button"
              onClick={() => changePeriod(p)}
              style={{
                height: 30,
                padding: '0 14px',
                borderRadius: 999,
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all .2s',
                background: on ? C.bgHover : 'transparent',
                color: on ? C.accent : C.textMuted,
                border: on ? '1px solid rgba(0,212,255,.5)' : `1px solid ${C.border}`,
              }}
            >
              {p} дней
            </button>
          )
        })}
        {data && !loading && (
          <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 'auto' }}>
            обновлено {new Date(data.generated_at).toLocaleString('ru-RU')}
          </span>
        )}
      </div>

      {loading && <div style={{ color: C.textMuted, fontSize: 13, padding: '24px 0' }}>Загрузка…</div>}

      {failed && !loading && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '16px 0' }}>
          <span style={{ color: C.warning, fontSize: 13 }}>Статистика не загрузилась.</span>
          <Btn
            onClick={() => {
              load(days)
              toast('Повторная загрузка статистики…')
            }}
          >
            Повторить
          </Btn>
        </div>
      )}

      {!loading && data && data.courses.length === 0 && !courseId && (
        <div style={{ color: C.textMuted, fontSize: 14, padding: '32px 0' }}>Курсов пока нет</div>
      )}

      {/* В дрилл-дауне сводная таблица скрыта — «← Все курсы» возвращает без перезагрузки. */}
      {!courseId && !loading && data && data.courses.length > 0 && (
        <>
          {/* Сводка-чипы по всем курсам за период */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <SummaryChip label={`Записей ${summary.enrolled}`} />
            <SummaryChip
              label={`Начали ${summary.started}${
                summary.enrolled > 0 ? ` (${Math.round((summary.started / summary.enrolled) * 100)}%)` : ''
              }`}
            />
            <SummaryChip label={`Скачиваний материалов ${summary.downloads}`} />
            <SummaryChip label={`Попыток тестов ${summary.attempts}`} />
          </div>

          {/* ТЗ-195: сводка шеринга уроков (меджик-линк ТЗ-187); источник —
              lesson_shares. Топ скрываем при нуле (малые объёмы на старте). */}
          {data.sharing && (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                Шеринг уроков
                <span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted, marginLeft: 8 }}>
                  меджик-линки · за {days} дн.
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                <ShareStat
                  label="Создано ссылок"
                  value={String(data.sharing.links_created)}
                  sub={`платных ${data.sharing.links_created_paid} · бесплатных ${data.sharing.links_created_free}`}
                />
                <ShareStat label="Открыто гостями" value={String(data.sharing.links_opened)} />
                <ShareStat label="Просрочено неоткрытых" value={String(data.sharing.links_expired)} />
                <ShareStat label="Конверсии в регистрации" value={String(data.sharing.conversions)} />
                <ShareStat label="Открытие → регистрация" value={fmtPct(data.sharing.conversion_rate)} />
              </div>
              {data.sharing.top_courses.length > 0 && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
                    Топ-{data.sharing.top_courses.length} курсов по ссылкам · клик — детальная статистика
                  </div>
                  {data.sharing.top_courses.map((c, i) => (
                    <div
                      key={c.course_id}
                      onClick={() => openDrill(c.course_id)}
                      title="Детальная статистика курса"
                      style={{ fontSize: 12, padding: '3px 0', cursor: 'pointer', color: C.textPrimary }}
                      onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                      onMouseLeave={e => (e.currentTarget.style.color = C.textPrimary)}
                    >
                      {i + 1}. «{c.title}» — {c.links_created} {pluralLinks(c.links_created)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {header('title', 'Курс')}
                  {header('lessons_count', 'Уроков')}
                  {header('enrolled', `Записей (за ${days}д / всего)`)}
                  {header('started', 'Начали %')}
                  {header('completion', 'Прошли полностью %')}
                  {header('tests', 'Тесты (попытки / pass / средний)')}
                  {header('materials', 'Скачивания')}
                  {header('active', 'Активных 7д')}
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => {
                  const warnStart =
                    r.enrolled_total >= WARN_MIN_ENROLLED &&
                    r.start_rate !== null &&
                    r.start_rate < WARN_START_RATE
                  const warnCompletion =
                    r.enrolled_total >= WARN_MIN_ENROLLED &&
                    r.completion_rate !== null &&
                    r.completion_rate < WARN_COMPLETION_RATE
                  return (
                    <tr
                      key={r.id}
                      onClick={() => openDrill(r.id)}
                      title="Детальная статистика курса"
                      style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.bgHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: C.textPrimary, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.title}
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <StatusPill status={r.status as any} />
                        </div>
                      </td>
                      <td style={tdStyle}>{r.lessons_count}</td>
                      <td style={tdStyle}>
                        {r.enrolled_period} / {r.enrolled_total}
                      </td>
                      <td style={{ ...tdStyle, color: warnStart ? C.warning : undefined, fontWeight: warnStart ? 700 : undefined }}>
                        {fmtPct(r.start_rate)}
                      </td>
                      <td style={{ ...tdStyle, color: warnCompletion ? C.warning : undefined, fontWeight: warnCompletion ? 700 : undefined }}>
                        {r.completed_total > 0 ? `${fmtPct(r.completion_rate)} (${r.completed_total})` : fmtPct(r.completion_rate)}
                      </td>
                      <td style={tdStyle}>
                        {r.test_attempts_period > 0
                          ? `${r.test_attempts_period} / ${fmtPct(r.test_pass_rate)} / ${r.avg_test_score ?? '—'}`
                          : '—'}
                      </td>
                      <td style={tdStyle}>{r.materials_downloads_period > 0 ? r.materials_downloads_period : '—'}</td>
                      <td style={tdStyle}>{r.active_learners_7d > 0 ? r.active_learners_7d : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Плашка-оговорка: события ТЗ-179 накапливаются с даты выката — честно объясняет нули. */}
          <p style={{ marginTop: 14, fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>
            Старты, тесты и скачивания считаются по событиям — накапливаются с даты выката событий
            обучения (ТЗ-179); записи и завершения — за всю историю. Карта прохождения уроков —
            во вкладке «Прогресс» редактора курса (ТЗ-177).
          </p>
        </>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: C.textMuted,
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px',
  color: C.textPrimary,
  whiteSpace: 'nowrap',
}

function SummaryChip({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 28,
        padding: '0 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: C.bgHover,
        color: C.textPrimary,
        border: `1px solid ${C.border}`,
      }}
    >
      {label}
    </span>
  )
}
