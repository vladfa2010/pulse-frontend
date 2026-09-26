/**
 * PULSE — Админ: dashboard MP3-кэша радио (ТЗ-65).
 *
 * Самодостаточный компонент: polling /stats, /history, /top-keys,
 * clear и prewarm. Вставляется в таб «Радио» (RadioTab.tsx).
 */

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts'
import {
  Database, Trash2, RefreshCw, Flame, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { adminApi } from '@/lib/api'

// ─── Типы ────────────────────────────────────────────────────────────────────

interface CacheStats {
  entries: number
  bytes: number
  maxEntries: number
  maxBytes: number
  inflight: number
  ttlMs: number
}

interface TtsStats {
  since: string
  total: number
  ok: number
  err_502: number
  err_503: number
  cache_hit: number
  cache_miss: number
  p95_latency_ms: number | null
  avg_latency_ms: number | null
}

interface Mp3CacheStatsResponse {
  cache: CacheStats
  tts: TtsStats
  hitRate: number
}

interface CacheSnapshot {
  ts: number
  entries: number
  bytes: number
  cache_hit: number
  cache_miss: number
  hitRate: number
  inflight: number
}

interface TopKey {
  key: string
  hits: number
  bytes: number
}

interface PrewarmResponse {
  success: boolean
  ok: number
  skipped: number
  errors: number
  segments: number
  at: string
}

interface ClearResponse {
  success: boolean
  cleared: {
    entriesBefore: number
    bytesBefore: number
    at: string
  }
}

// ─── Хелперы ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

function formatTimeShort(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('ru-RU')
}

function pickProgressColor(pct: number): string {
  if (pct > 90) return '#EF4444'
  if (pct > 70) return '#F59E0B'
  return '#00D4FF'
}

// ─── Подкомпоненты ──────────────────────────────────────────────────────────

function Stat({
  label, value, sub, color,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  color?: string
}) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: '#6B7280' }}>
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1" style={{ color: color ?? '#FFFFFF' }}>
        {value}
      </div>
      {sub && <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{sub}</div>}
    </div>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#222222' }}>
      <div
        className="h-full transition-all"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pickProgressColor(pct) }}
      />
    </div>
  )
}

// ─── Главный компонент ──────────────────────────────────────────────────────

export function Mp3CacheDashboard() {
  const [stats, setStats] = useState<Mp3CacheStatsResponse | null>(null)
  const [history, setHistory] = useState<CacheSnapshot[]>([])
  const [topKeys, setTopKeys] = useState<TopKey[]>([])
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [prewarming, setPrewarming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, historyRes, topRes] = await Promise.all([
        adminApi.get('/api/admin/radio/mp3-cache/stats'),
        adminApi.get('/api/admin/radio/mp3-cache/history'),
        adminApi.get('/api/admin/radio/mp3-cache/top-keys?limit=10'),
      ])
      setStats(statsRes as Mp3CacheStatsResponse)
      setHistory(((historyRes as { snapshots: CacheSnapshot[] }).snapshots) ?? [])
      setTopKeys(((topRes as { topKeys: TopKey[] }).topKeys) ?? [])
      setError(null)
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить данные кэша')
    } finally {
      setLoading(false)
    }
  }, [])

  // Polling каждые 5 сек
  useEffect(() => {
    loadAll()
    const id = setInterval(loadAll, 5000)
    return () => clearInterval(id)
  }, [loadAll])

  const handlePrewarm = useCallback(async () => {
    if (prewarming) return
    if (!window.confirm('Прогреть кэш?\n\nБудут сгенерированы mp3 для стандартных сегментов и текущего диалога сводки (текущие голоса host/guest). Это занимает 5-30 секунд.')) return
    setPrewarming(true)
    setError(null)
    try {
      const res = (await adminApi.post('/api/admin/radio/mp3-cache/prewarm', {})) as PrewarmResponse
      setSuccess(`Прогрето: ${res.ok}, уже было: ${res.skipped}, ошибок: ${res.errors} (сегментов: ${res.segments})`)
      window.setTimeout(() => setSuccess(null), 8000)
      await loadAll()
    } catch (err: any) {
      setError(err?.message || 'Не удалось прогреть кэш')
    } finally {
      setPrewarming(false)
    }
  }, [prewarming, loadAll])

  const handleClearCache = useCallback(async () => {
    if (clearing || !stats) return
    if (!window.confirm(
      `Очистить MP3-кеш?\n\nЗаписей: ${stats.cache.entries}\nРазмер: ${formatBytes(stats.cache.bytes)}\n\nСледующие TTS-запросы пойдут в Minimax (1-3 сек первый раз).`
    )) return
    setClearing(true)
    setError(null)
    try {
      const res = (await adminApi.post('/api/admin/radio/mp3-cache/clear', {})) as ClearResponse
      setSuccess(`Кэш очищен (было: ${res.cleared.entriesBefore} записей)`)
      window.setTimeout(() => setSuccess(null), 4000)
      await loadAll()
    } catch (err: any) {
      setError(err?.message || 'Не удалось очистить кэш')
    } finally {
      setClearing(false)
    }
  }, [clearing, stats, loadAll])

  const entriesPct = stats ? (stats.cache.entries / stats.cache.maxEntries) * 100 : 0
  const bytesPct = stats ? (stats.cache.bytes / stats.cache.maxBytes) * 100 : 0

  return (
    <div
      className="rounded-xl border overflow-hidden mt-6"
      style={{ backgroundColor: '#111111', borderColor: '#222222' }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: '#222222' }}>
        <span className="text-sm font-medium flex items-center gap-2" style={{ color: '#9CA3AF' }}>
          <Database size={14} />
          MP3 Кэш (Minimax T2A)
        </span>
        <span className="text-xs" style={{ color: '#6B7280' }}>
          in-memory · TTL 6ч · LRU {stats?.cache.maxEntries ?? 256} / {stats ? formatBytes(stats.cache.maxBytes) : '80 МБ'}
        </span>
      </div>

      {success && (
        <div
          className="mx-6 mt-4 rounded-lg border p-3 flex items-center gap-2 text-sm"
          style={{ backgroundColor: 'rgba(52, 211, 153, 0.08)', borderColor: 'rgba(52, 211, 153, 0.2)', color: '#34D399' }}
        >
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      {error && (
        <div
          className="mx-6 mt-4 rounded-lg border p-3 flex items-center gap-2 text-sm"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444' }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!stats && !error && (
        <div className="p-12 text-center">
          <p className="text-sm" style={{ color: '#9CA3AF' }}>
            {loading ? 'Загрузка…' : 'Нет данных'}
          </p>
        </div>
      )}

      {stats && (
        <div className="p-6 space-y-5">

          {/* 1. Live: entries / bytes / inflight */}
          <div className="grid grid-cols-3 gap-4">
            <Stat
              label="Записей"
              value={
                <>
                  {stats.cache.entries}{' '}
                  <span className="text-sm" style={{ color: '#6B7280' }}>
                    / {stats.cache.maxEntries}
                  </span>
                </>
              }
            />
            <div>
              <Stat
                label="Размер"
                value={formatBytes(stats.cache.bytes)}
                sub={`из ${formatBytes(stats.cache.maxBytes)}`}
              />
              <ProgressBar pct={bytesPct} />
            </div>
            <Stat
              label="Inflight"
              value={stats.cache.inflight}
              color={stats.cache.inflight > 10 ? '#F59E0B' : '#FFFFFF'}
              sub="сейчас"
            />
          </div>
          <ProgressBar pct={entriesPct} />

          {/* 2. Lifetime: hit / miss / total / p95 */}
          <div className="pt-4 border-t" style={{ borderColor: '#222222' }}>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#6B7280' }}>
              За всё время (since {formatDateTime(new Date(stats.tts.since).getTime())})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat
                label="Cache hit"
                value={
                  <>
                    {stats.tts.cache_hit}{' '}
                    <span className="text-xs">({stats.hitRate}%)</span>
                  </>
                }
                color="#34D399"
              />
              <Stat label="Cache miss" value={stats.tts.cache_miss} color="#F59E0B" />
              <Stat label="Total" value={stats.tts.total} />
              <Stat
                label="p95 latency"
                value={
                  <>
                    {stats.tts.p95_latency_ms ?? '—'}{' '}
                    <span className="text-xs">мс</span>
                  </>
                }
              />
            </div>
          </div>

          {/* 3. График 24ч */}
          {history.length > 0 && (
            <div className="pt-4 border-t" style={{ borderColor: '#222222' }}>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#6B7280' }}>
                История (24ч) — {history.length} точек
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke="#222222" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="ts"
                    tickFormatter={formatTimeShort}
                    stroke="#6B7280"
                    fontSize={10}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#34D399"
                    fontSize={10}
                    domain={[0, 100]}
                    label={{ value: 'Hit rate %', angle: -90, position: 'insideLeft', fill: '#34D399', fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#00D4FF"
                    fontSize={10}
                    label={{ value: 'Записей', angle: 90, position: 'insideRight', fill: '#00D4FF', fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #222222', color: '#9CA3AF', fontSize: 12 }}
                    labelFormatter={(t) => formatDateTime(t as number)}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#9CA3AF' }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="hitRate"
                    stroke="#34D399"
                    strokeWidth={2}
                    dot={false}
                    name="Hit rate %"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="entries"
                    stroke="#00D4FF"
                    strokeWidth={2}
                    dot={false}
                    name="Записей"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="inflight"
                    stroke="#F59E0B"
                    strokeWidth={1}
                    strokeDasharray="3 2"
                    dot={false}
                    name="Inflight"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="text-xs mt-2" style={{ color: '#6B7280' }}>
                Snapshot каждую минуту · ring buffer 1440 точек (24ч)
              </div>
            </div>
          )}

          {/* 4. Top-10 ключей */}
          {topKeys.length > 0 && (
            <div className="pt-4 border-t" style={{ borderColor: '#222222' }}>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#6B7280' }}>
                Top-10 самых частых текстов
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ color: '#6B7280' }}>
                      <th className="text-left py-1.5 font-normal w-8">#</th>
                      <th className="text-left py-1.5 font-normal">Текст</th>
                      <th className="text-right font-normal">Hits</th>
                      <th className="text-right font-normal">Bytes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topKeys.map((k, i) => {
                      // key = MODEL\x00text\x00voice\x00speed\x00pitch
                      const parts = k.key.split('\x00')
                      const text = parts[1] ?? k.key
                      return (
                        <tr key={i} className="border-t" style={{ borderColor: '#222222' }}>
                          <td className="py-1.5" style={{ color: '#6B7280' }}>{i + 1}</td>
                          <td
                            className="py-1.5 truncate"
                            style={{ maxWidth: '450px' }}
                            title={text}
                          >
                            {text}
                          </td>
                          <td className="text-right" style={{ color: '#00D4FF' }}>{k.hits}</td>
                          <td className="text-right" style={{ color: '#6B7280' }}>{formatBytes(k.bytes)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-xs mt-2" style={{ color: '#6B7280' }}>
                Счётчик сбрасывается при clear cache и при recreate VDS
              </div>
            </div>
          )}

          {/* 5. Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t flex-wrap" style={{ borderColor: '#222222' }}>
            <button
              onClick={handlePrewarm}
              disabled={prewarming}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all disabled:opacity-50"
              style={{
                backgroundColor: '#0A0A0A',
                borderColor: '#222222',
                color: '#F97316',
              }}
              title="Сгенерировать mp3 для стандартных сегментов и текущего диалога сводки (голоса host/guest)"
            >
              <Flame size={14} className={prewarming ? 'animate-pulse' : ''} />
              {prewarming ? 'Прогреваю…' : 'Прогреть кэш'}
            </button>
            <button
              onClick={loadAll}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all hover:border-[#333333] disabled:opacity-50"
              style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Обновить всё
            </button>
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all hover:border-red-400 hover:text-red-400 disabled:opacity-50"
              style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#9CA3AF' }}
            >
              <Trash2 size={14} className={clearing ? 'animate-spin' : ''} />
              Очистить кэш
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Mp3CacheDashboard
