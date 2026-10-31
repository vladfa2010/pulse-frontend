/**
 * Админ-таба «Фактчекинг» — учёт токенов и стоимости проверок (ТЗ-207).
 *
 * Источники (adminMiddleware):
 *   GET /api/admin/fact-checking/stats?days=N   — сводка, дневные ряды, топ пользователей, ошибки
 *   GET /api/admin/fact-checking/list           — история сессий (фильтры, пагинация, CSV)
 *   GET /api/admin/fact-checking/:sessionId     — деталь одной проверки (модалка)
 */
import { useCallback, useEffect, useState } from 'react'
import { Download, Trash2, X } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import DeleteFactCheckConfirmModal from '@/components/admin/DeleteFactCheckConfirmModal'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

const C = {
  bg: '#111111',
  border: '#222222',
  text: '#E5E7EB',
  muted: '#6B7280',
  accent: '#00D4FF',
  green: '#34D399',
  red: '#EF4444',
  amber: '#FBBF24',
}

interface StatsTotals {
  checks: number
  completed: number
  failed: number
  cached: number
  success_rate: number
  cache_rate: number
  tokens_input: number
  tokens_output: number
  cost_llm_usd: number
  cost_total_usd: number
  avg_tokens_input: number
  avg_tokens_output: number
  avg_duration_sec: number
  retried_share: number
}
interface DailyRow { day: string; checks: number; completed: number; tokens_in: number; tokens_out: number }
interface TopUser { email: string; username: string | null; checks: number; tokens_in: number; tokens_out: number; cost_usd: number }
interface ErrorRow { error_message: string; count: number }
interface Stats {
  period_days: number
  totals: StatsTotals
  stage_avgs: Record<string, number | null>
  daily: DailyRow[]
  top_users: TopUser[]
  errors: ErrorRow[]
}
interface ListRow {
  session_id: string
  started_at: string
  status: string
  user_email: string
  user_username: string | null
  news_title: string
  news_id: string
  news_url: string
  cached: boolean
  tokens_input: number
  tokens_output: number
  error_message: string | null
  attempts: number | null
  duration_sec: number | null
  cost_usd: number
}
interface ListResp { rows: ListRow[]; total: number; page: number; page_size: number }
interface Detail extends ListRow {
  completed_at: string
  model: string | null
  sources_count: number | null
  final_verdict: string | null
  final_confidence: number | null
  final_reasoning: string | null
  error_message: string | null
  tokens_breakdown: Record<string, { in: number; out: number }> | null
  sources: Array<{ site?: string; title?: string; url?: string }>
}

const STAGES = [
  { key: 'search', label: 'Поиск' },
  { key: 'analysis', label: 'Анализ' },
  { key: 'sources', label: 'Источники' },
  { key: 'assessment', label: 'Оценка' },
]
const LEGACY_STATUSES = new Set(['queries', 'fetch', 'claims', 'verdict', 'search', 'analysis'])
const fmtInt = (n: number) => Math.round(n).toLocaleString('ru-RU')
const fmtUsd = (n: number) => `$${n.toFixed(2)}`
const fmtSec = (s: number | null) => (s == null ? '—' : s >= 60 ? `${Math.floor(s / 60)} мин ${s % 60} с` : `${s} с`)
const dayLabel = (day: string) => String(day).slice(5, 10).split('-').reverse().join('.')
const dateTime = (ts: string) => new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const daysAgoIso = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

function StatusBadge({ status }: { status: string }) {
  if (LEGACY_STATUSES.has(status)) {
    return <span className="px-2 py-0.5 rounded text-[11px]" style={{ backgroundColor: '#6B728022', color: C.muted }}>наследие</span>
  }
  const ok = status === 'completed'
  return (
    <span className="px-2 py-0.5 rounded text-[11px]" style={{ backgroundColor: ok ? '#34D39918' : '#EF444418', color: ok ? C.green : C.red }}>
      {ok ? 'готово' : 'ошибка'}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>{children}</p>
}

export default function FactCheckingTab() {
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsErr, setStatsErr] = useState<string | null>(null)

  const [from, setFrom] = useState(daysAgoIso(30))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<ListResp | null>(null)
  const [listErr, setListErr] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  // ТЗ-210: удаление фактчека из строки истории
  const [deleteTarget, setDeleteTarget] = useState<ListRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const { toast, toastError } = useToast()

  // Перезапрос сводки за выбранный период (KPI/графики зависят от истории)
  const reloadStats = useCallback(() => {
    setStats(null)
    setStatsErr(null)
    adminApi.get(`/api/admin/fact-checking/stats?days=${days}`)
      .then(setStats)
      .catch((err) => setStatsErr(err.message))
  }, [days])

  useEffect(() => {
    reloadStats()
  }, [reloadStats])

  const loadList = useCallback((p: number) => {
    setListErr(null)
    const qs = new URLSearchParams({ from, to, page: String(p), page_size: '50' })
    if (status) qs.set('status', status)
    if (userQuery) qs.set('user_query', userQuery)
    return adminApi.get(`/api/admin/fact-checking/list?${qs}`).then((data: ListResp) => {
      setList(data)
      setPage(data.page)
    }).catch((err) => setListErr(err.message))
  }, [from, to, status, userQuery])

  useEffect(() => { setPage(1); loadList(1) }, [loadList])

  const openDetail = (sessionId: string) => {
    adminApi.get(`/api/admin/fact-checking/${sessionId}`).then(setDetail).catch((err) => setListErr(err.message))
  }

  // ТЗ-210: сброс результата фактчека новости — строка исчезает, агрегаты пересчитываются
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await adminApi.delete(`/api/admin/news/${deleteTarget.news_id}/fact-check`)
      toast('Фактчек удалён')
      loadList(page)
      reloadStats()
    } catch (err: any) {
      if (err.status === 404) {
        // Состояние уже сброшено — строка неактуальна, убираем и пересчитываем
        toast('У новости нет фактчека')
        loadList(page)
        reloadStats()
      } else {
        toastError(err?.message || 'Не удалось удалить фактчек')
      }
    } finally {
      setDeleteLoading(false)
      setDeleteTarget(null)
    }
  }

  const exportCsv = async () => {
    const qs = new URLSearchParams({ from, to, page: '1', page_size: '200' })
    if (status) qs.set('status', status)
    if (userQuery) qs.set('user_query', userQuery)
    const data: ListResp = await adminApi.get(`/api/admin/fact-checking/list?${qs}`)
    const head = ['Дата', 'Пользователь', 'Новость', 'Статус', 'Кэш', 'Токены in', 'Токены out', '$', 'Длительность, с', 'Попытки', 'Ошибка']
    const lines = data.rows.map((r) => [
      r.started_at, r.user_email, `"${(r.news_title || '').replace(/"/g, '""')}"`, r.status,
      r.cached ? 'да' : 'нет', r.tokens_input, r.tokens_output, r.cost_usd.toFixed(4),
      r.duration_sec ?? '', r.attempts ?? '', `"${(r.error_message || '').replace(/"/g, '""')}"`,
    ].join(','))
    const blob = new Blob([`﻿${head.join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `factchecking-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const t = stats?.totals
  const stageData = STAGES.map((s) => ({
    name: s.label,
    in: Math.round(Number(stats?.stage_avgs?.[`${s.key}_in`] ?? 0)),
    out: Math.round(Number(stats?.stage_avgs?.[`${s.key}_out`] ?? 0)),
  }))
  const pagesTotal = list ? Math.max(1, Math.ceil(list.total / list.page_size)) : 1

  return (
    <div className="space-y-6">
      {/* ─── Статистика ─── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionTitle>Статистика</SectionTitle>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className="px-3 py-1 rounded text-xs"
              style={{ backgroundColor: days === d ? '#1F2937' : 'transparent', color: days === d ? C.text : C.muted, border: `1px solid ${days === d ? '#374151' : C.border}` }}>
              {d} дн
            </button>
          ))}
        </div>
      </div>

      {statsErr && <p className="text-xs" style={{ color: C.red }}>{statsErr}</p>}
      {!stats && !statsErr && <p className="text-sm" style={{ color: C.muted }}>Загрузка…</p>}

      {stats && t && (
        <>
          <div className="flex flex-wrap gap-3">
            <Card label="Проверок" value={fmtInt(t.checks)} sub={`успешность ${(t.success_rate * 100).toFixed(0)}%`} />
            <Card label="Токены in" value={fmtInt(t.tokens_input)} sub={`средне ${fmtInt(t.avg_tokens_input)} / пров.`} />
            <Card label="Токены out" value={fmtInt(t.tokens_output)} sub={`средне ${fmtInt(t.avg_tokens_output)} / пров.`} />
            <Card label="Расход" value={fmtUsd(t.cost_total_usd)} sub={`LLM ${fmtUsd(t.cost_llm_usd)} + $web_search`} accent={C.amber} />
            <Card label="Средняя длительность" value={fmtSec(Math.round(t.avg_duration_sec))} sub={`из кэша ${(t.cache_rate * 100).toFixed(0)}%`} />
            <Card label="С ретраями" value={`${(t.retried_share * 100).toFixed(0)}%`} sub={`failed: ${t.failed}`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartBox title="Токены по дням (in/out)">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.daily}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={dayLabel} tick={{ fill: C.muted, fontSize: 10 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.border}` }} />
                  <Legend />
                  <Bar dataKey="tokens_in" name="in" stackId="a" fill={C.accent} />
                  <Bar dataKey="tokens_out" name="out" stackId="a" fill={C.green} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
            <ChartBox title="Проверки и успешность по дням">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.daily.map((d) => ({ ...d, rate: d.checks ? d.completed / d.checks : 0 }))}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={dayLabel} tick={{ fill: C.muted, fontSize: 10 }} />
                  <YAxis yAxisId="l" tick={{ fill: C.muted, fontSize: 10 }} />
                  <YAxis yAxisId="r" orientation="right" domain={[0, 1]} tick={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.border}` }} />
                  <Legend />
                  <Line yAxisId="l" dataKey="checks" name="проверок" stroke={C.accent} dot={false} />
                  <Line yAxisId="r" dataKey="rate" name="успешность" stroke={C.green} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
            <ChartBox title="Средние токены по этапам">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stageData}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 10 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.border}` }} />
                  <Legend />
                  <Bar dataKey="in" name="in" stackId="a" fill={C.accent} />
                  <Bar dataKey="out" name="out" stackId="a" fill={C.green} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
            <ChartBox title="Топ пользователей по расходу">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.top_users.map((u) => ({ ...u, name: u.username || u.email }))} layout="vertical">
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fill: C.muted, fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.border}` }} />
                  <Bar dataKey="cost_usd" name="$ (LLM)" fill={C.amber} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>

          {stats.errors.length > 0 && (
            <ChartBox title="Ошибки по типам">
              <div className="space-y-1">
                {stats.errors.map((e) => (
                  <div key={e.error_message} className="flex items-start justify-between gap-3 text-xs">
                    <span style={{ color: C.text }}>{e.error_message.slice(0, 120)}</span>
                    <span className="shrink-0" style={{ color: C.red }}>{e.count}</span>
                  </div>
                ))}
              </div>
            </ChartBox>
          )}
        </>
      )}

      {/* ─── История ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <SectionTitle>История</SectionTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-[#111111] border rounded px-2 py-1 text-xs" style={{ borderColor: C.border, color: C.text }} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-[#111111] border rounded px-2 py-1 text-xs" style={{ borderColor: C.border, color: C.text }} />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-[#111111] border rounded px-2 py-1 text-xs" style={{ borderColor: C.border, color: C.text }}>
              <option value="">Все статусы</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
            </select>
            <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Пользователь…"
              className="bg-[#111111] border rounded px-2 py-1 text-xs w-40" style={{ borderColor: C.border, color: C.text }} />
            <button onClick={exportCsv} className="flex items-center gap-1 px-3 py-1 rounded text-xs border"
              style={{ borderColor: C.border, color: C.muted }}>
              <Download size={12} /> CSV
            </button>
          </div>
        </div>

        {listErr && <p className="text-xs" style={{ color: C.red }}>{listErr}</p>}
        {!list && !listErr && <p className="text-sm" style={{ color: C.muted }}>Загрузка…</p>}

        {list && (
          <>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: C.border }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: C.muted, borderBottom: `1px solid ${C.border}` }}>
                    <th className="text-left p-2 font-medium">Когда</th>
                    <th className="text-left p-2 font-medium">Пользователь</th>
                    <th className="text-left p-2 font-medium">Новость</th>
                    <th className="text-left p-2 font-medium">Статус</th>
                    <th className="text-right p-2 font-medium">Токены in/out</th>
                    <th className="text-right p-2 font-medium">$</th>
                    <th className="text-right p-2 font-medium">Длит.</th>
                    <th className="text-right p-2 font-medium">Поп.</th>
                    <th className="p-2 font-medium w-8" />
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((r) => (
                    <tr key={r.session_id} onClick={() => openDetail(r.session_id)}
                      className="cursor-pointer hover:bg-[#1a1a1a]" style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td className="p-2 whitespace-nowrap" style={{ color: C.text }}>{dateTime(r.started_at)}</td>
                      <td className="p-2" style={{ color: C.text }}>{r.user_email}</td>
                      <td className="p-2 max-w-[220px] truncate" style={{ color: C.muted }}>
                        <a href={`/news/${r.news_id}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                          className="hover:underline">{r.news_title || r.news_id}</a>
                      </td>
                      <td className="p-2">
                        <StatusBadge status={r.status} />
                        {r.cached && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: '#60A5FA18', color: '#60A5FA' }}>кэш</span>}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap" style={{ color: C.text }}>{fmtInt(r.tokens_input)} / {fmtInt(r.tokens_output)}</td>
                      <td className="p-2 text-right" style={{ color: C.amber }}>{fmtUsd(r.cost_usd)}</td>
                      <td className="p-2 text-right whitespace-nowrap" style={{ color: C.muted }}>{fmtSec(r.duration_sec)}</td>
                      <td className="p-2 text-right" style={{ color: C.muted }}>{r.attempts ?? '—'}</td>
                      <td className="p-2 text-center">
                        {/* ТЗ-210: удалять нечего у failed/pending — endpoint вернул бы 404 */}
                        {r.status === 'completed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(r) }}
                            title="Удалить фактчек новости"
                            style={{ color: C.muted }}
                            className="hover:opacity-80 transition-opacity"
                            onMouseEnter={(e) => { e.currentTarget.style.color = C.red }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = C.muted }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {list.rows.length === 0 && (
                    <tr><td colSpan={9} className="p-4 text-center" style={{ color: C.muted }}>За выбранный период проверок нет</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-xs" style={{ color: C.muted }}>
              <span>Всего: {list.total}</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => loadList(page - 1)}
                  className="px-3 py-1 rounded border disabled:opacity-40" style={{ borderColor: C.border }}>Назад</button>
                <span>{page} / {pagesTotal}</span>
                <button disabled={page >= pagesTotal} onClick={() => loadList(page + 1)}
                  className="px-3 py-1 rounded border disabled:opacity-40" style={{ borderColor: C.border }}>Далее</button>
              </div>
            </div>
          </>
        )}
      </div>

      {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} />}

      {/* ТЗ-210: подтверждение удаления фактчека из строки истории */}
      {deleteTarget && (
        <DeleteFactCheckConfirmModal
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteLoading}
          error={null}
        />
      )}
    </div>
  )
}

function Card({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-lg border p-4 flex-1 min-w-[150px]" style={{ backgroundColor: C.bg, borderColor: C.border }}>
      <div className="text-xs mb-1" style={{ color: C.muted }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: accent || C.text }}>{value}</div>
      {sub && <div className="text-[11px] mt-1" style={{ color: C.muted }}>{sub}</div>}
    </div>
  )
}

function ChartBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4" style={{ backgroundColor: C.bg, borderColor: C.border }}>
      <p className="text-xs mb-3" style={{ color: C.muted }}>{title}</p>
      {children}
    </div>
  )
}

function DetailModal({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const totalIn = Object.values(detail.tokens_breakdown || {}).reduce((s, v) => s + (v.in || 0), 0)
  const totalOut = Object.values(detail.tokens_breakdown || {}).reduce((s, v) => s + (v.out || 0), 0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: '#000000aa' }} onClick={onClose}>
      <div className="rounded-xl border max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4"
        style={{ backgroundColor: '#0A0A0A', borderColor: C.border }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: C.text }}>Проверка {dateTime(detail.started_at)}</p>
            <p className="text-xs mt-1" style={{ color: C.muted }}>
              {detail.user_email} · <StatusBadge status={detail.status} />
              {detail.cached && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: '#60A5FA18', color: '#60A5FA' }}>кэш</span>}
            </p>
          </div>
          <button onClick={onClose} style={{ color: C.muted }}><X size={18} /></button>
        </div>

        <p className="text-xs" style={{ color: C.muted }}>
          <a href={`/news/${detail.news_id}`} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: C.accent }}>
            {detail.news_title || detail.news_id}
          </a>
        </p>

        <div className="flex flex-wrap gap-2 text-xs">
          <Chip label="Токены in" value={fmtInt(detail.tokens_input)} />
          <Chip label="Токены out" value={fmtInt(detail.tokens_output)} />
          <Chip label="Стоимость" value={fmtUsd(detail.cost_usd)} />
          <Chip label="Длительность" value={fmtSec(detail.duration_sec)} />
          <Chip label="Попыток" value={String(detail.attempts ?? '—')} />
          {detail.model && <Chip label="Модель" value={detail.model} />}
        </div>

        {detail.tokens_breakdown && (
          <div>
            <SectionTitle>Разбивка по этапам</SectionTitle>
            <table className="w-full text-xs mt-2">
              <thead>
                <tr style={{ color: C.muted, borderBottom: `1px solid ${C.border}` }}>
                  <th className="text-left p-1 font-medium">Этап</th>
                  <th className="text-right p-1 font-medium">in</th>
                  <th className="text-right p-1 font-medium">out</th>
                  <th className="text-right p-1 font-medium">Доля in</th>
                </tr>
              </thead>
              <tbody>
                {STAGES.map((s) => {
                  const v = detail.tokens_breakdown?.[s.key]
                  return (
                    <tr key={s.key} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td className="p-1" style={{ color: C.text }}>{s.label}</td>
                      <td className="p-1 text-right" style={{ color: C.text }}>{fmtInt(v?.in || 0)}</td>
                      <td className="p-1 text-right" style={{ color: C.text }}>{fmtInt(v?.out || 0)}</td>
                      <td className="p-1 text-right" style={{ color: C.muted }}>{totalIn ? `${(((v?.in || 0) / totalIn) * 100).toFixed(0)}%` : '—'}</td>
                    </tr>
                  )
                })}
                <tr>
                  <td className="p-1 font-medium" style={{ color: C.text }}>Σ</td>
                  <td className="p-1 text-right font-medium" style={{ color: C.text }}>{fmtInt(totalIn)}</td>
                  <td className="p-1 text-right font-medium" style={{ color: C.text }}>{fmtInt(totalOut)}</td>
                  <td className="p-1" />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {detail.error_message && (
          <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#EF444410', border: `1px solid #EF444430`, color: C.red }}>
            {detail.error_message}
          </div>
        )}

        {detail.final_reasoning && (
          <div>
            <SectionTitle>Вердикт</SectionTitle>
            <p className="text-xs mt-1" style={{ color: C.text }}>{detail.final_reasoning}</p>
          </div>
        )}

        {detail.sources.length > 0 && (
          <div>
            <SectionTitle>Источники ({detail.sources_count ?? detail.sources.length})</SectionTitle>
            <div className="space-y-1 mt-2">
              {detail.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block text-xs hover:underline truncate" style={{ color: C.accent }}>
                  {s.title || s.site || s.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: C.border }}>
      <div className="text-[10px]" style={{ color: C.muted }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: C.text }}>{value}</div>
    </div>
  )
}
