import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import { RefreshCw, Activity, Search, FlaskConical, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

interface Provider {
  id: string
  name: string
  role: 'primary' | 'disabled'
  exchanges: string[]
  auth: { type: string; configured: boolean }
  maintenance: boolean
}
interface ProvidersResponse {
  providers: Provider[]
  supportedExchanges: string[]
}
interface StatusResponse {
  checkedAt: string
  finam: { ok: boolean; ms: number; error?: string }
}
interface ExchangeItem {
  mic: string
  name: string
}

export default function MarketDataTab() {
  const [providers, setProviders] = useState<ProvidersResponse | null>(null)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [exchanges, setExchanges] = useState<ExchangeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // test request form
  const [ticker, setTicker] = useState('SBER')
  const [exchange, setExchange] = useState('MOEX')
  const [tf, setTf] = useState<'daily' | 'm5'>('daily')
  const [testResult, setTestResult] = useState<any>(null)
  const [testLoading, setTestLoading] = useState(false)

  // resolver form
  const [resolveTicker, setResolveTicker] = useState('')
  const [resolveResult, setResolveResult] = useState<any>(null)
  const [resolveLoading, setResolveLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [p, s] = await Promise.all([
        adminApi.get('/admin/market/providers'),
        adminApi.get('/admin/market/providers/status'),
      ])
      setProviders(p)
      setStatus(s)
      adminApi.get('/admin/market/exchanges')
        .then((d) => setExchanges(d.exchanges || []))
        .catch(() => {})
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const runTest = async () => {
    setTestLoading(true)
    setTestResult(null)
    try {
      setTestResult(await adminApi.get(`/admin/market/test?ticker=${encodeURIComponent(ticker)}&exchange=${encodeURIComponent(exchange)}&tf=${tf}`))
    } catch (e: any) {
      setTestResult({ error: e.message })
    } finally {
      setTestLoading(false)
    }
  }

  const runResolve = async () => {
    if (!resolveTicker.trim()) return
    setResolveLoading(true)
    setResolveResult(null)
    try {
      setResolveResult(await adminApi.get(`/admin/market/resolve?ticker=${encodeURIComponent(resolveTicker.trim())}`))
    } catch (e: any) {
      setResolveResult({ error: e.message })
    } finally {
      setResolveLoading(false)
    }
  }

  const invalidateCache = async () => {
    try {
      await adminApi.post('/admin/market/cache/invalidate', {})
      await runResolve()
    } catch (e: any) {
      setResolveResult({ error: e.message })
    }
  }

  const statusOf = (id: string) => (id === 'finam' ? status?.finam : undefined)

  return (
    <div className="space-y-6">
      {/* ── Окно 1+2: реестр провайдеров со статусами ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Источники рыночных данных</h2>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111111] text-sm text-gray-300 hover:text-white">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Обновить
        </button>
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers?.providers.map((p) => {
          const st = statusOf(p.id)
          return (
            <div key={p.id} className="rounded-xl border border-[#222222] bg-[#0D0D0D] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-gray-400" />
                  <span className="font-medium text-white">{p.name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.role === 'primary' ? 'bg-blue-500/15 text-blue-400' : 'bg-gray-500/15 text-gray-500'}`}>
                  {p.role === 'primary' ? 'первичный' : 'отключён (код сохранён)'}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                Биржи: <span className="text-gray-200">{p.exchanges.join(', ')}</span>
              </div>
              <div className="text-sm text-gray-400">
                Авторизация: <span className="text-gray-200">{p.auth.type === 'anonymous' ? 'не требуется' : 'сервисный ключ (env)'}</span>
                {' '}· {p.auth.configured
                  ? <span className="text-green-400">настроена</span>
                  : <span className="text-red-400">КЛЮЧ НЕ ЗАДАН</span>}
              </div>
              {st && (
                <div className="flex items-center gap-2 text-sm">
                  {st.ok && !st.error && <><CheckCircle2 size={15} className="text-green-400" /><span className="text-green-400">OK · {st.ms} мс</span></>}
                  {st.ok && st.error && <><AlertTriangle size={15} className="text-yellow-400" /><span className="text-yellow-400">{st.error}</span></>}
                  {!st.ok && <><XCircle size={15} className="text-red-400" /><span className="text-red-400">{st.error} · {st.ms} мс</span></>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Окно 3: тест-запрос ── */}
      <div className="rounded-xl border border-[#222222] bg-[#0D0D0D] p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white"><FlaskConical size={15} /> Тест-запрос свечей</div>
        <div className="flex flex-wrap gap-2">
          <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="Тикер"
            className="px-3 py-1.5 rounded-lg bg-[#111111] border border-[#222222] text-sm text-white w-28" />
          <select value={exchange} onChange={(e) => setExchange(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#111111] border border-[#222222] text-sm text-white max-w-[320px]">
            <option value="MOEX">MOEX (Мосбиржа)</option>
            <option value="NASDAQ">NASDAQ</option>
            <option value="NYSE">NYSE</option>
            <option disabled>──────────</option>
            {exchanges.map((e) => (
              <option key={e.mic} value={e.mic}>{e.mic} — {e.name}</option>
            ))}
          </select>
          <select value={tf} onChange={(e) => setTf(e.target.value as 'daily' | 'm5')}
            className="px-3 py-1.5 rounded-lg bg-[#111111] border border-[#222222] text-sm text-white">
            <option value="daily">Дневки</option>
            <option value="m5">5 минут</option>
          </select>
          <button onClick={runTest} disabled={testLoading}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
            {testLoading ? 'Запрос…' : 'Выполнить'}
          </button>
        </div>
        {testResult && (
          <div className="text-sm space-y-1">
            {testResult.error
              ? <div className="text-red-400">{testResult.error}</div>
              : <>
                  <div className="text-gray-300">
                    Провайдер: <b className="text-white">{testResult.provider}</b> · Свечей: <b className="text-white">{testResult.candles}</b> · {testResult.ms} мс
                    {testResult.date && <> · дата: {testResult.date}</>}
                  </div>
                  {testResult.hint && <div className="text-yellow-400 text-xs">{testResult.hint}</div>}
                  {testResult.last && (
                    <pre className="text-xs text-gray-500 bg-[#111111] rounded-lg p-2 overflow-x-auto">{JSON.stringify(testResult.last, null, 2)}</pre>
                  )}
                </>}
          </div>
        )}
      </div>

      {/* ── Окно 4: резолвер тикера ── */}
      <div className="rounded-xl border border-[#222222] bg-[#0D0D0D] p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white"><Search size={15} /> Резолвер тикера (Finam)</div>
        <div className="flex gap-2 flex-wrap">
          <input value={resolveTicker} onChange={(e) => setResolveTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && runResolve()} placeholder="Например, MDLN"
            className="px-3 py-1.5 rounded-lg bg-[#111111] border border-[#222222] text-sm text-white w-40" />
          <button onClick={runResolve} disabled={resolveLoading}
            className="px-4 py-1.5 rounded-lg bg-[#111111] border border-[#222222] text-sm text-gray-300 hover:text-white disabled:opacity-50">
            {resolveLoading ? 'Поиск…' : 'Найти'}
          </button>
          <button onClick={invalidateCache} disabled={resolveLoading}
            className="px-4 py-1.5 rounded-lg bg-[#111111] border border-[#222222] text-sm text-gray-300 hover:text-white disabled:opacity-50">
            Обновить справочник
          </button>
        </div>
        {resolveResult && (
          <div className="text-sm">
            {resolveResult.error && <div className="text-red-400">{resolveResult.error}</div>}
            {resolveResult.matches && resolveResult.matches.length === 0 &&
              <div className="text-gray-400">Не найдено. Индексы (IMOEX) в /v1/assets отсутствуют — это нормально.</div>}
            {resolveResult.matches?.map((m: any) => {
              const ourAlias = Object.entries({ MOEX: 'MISX', NASDAQ: 'XNGS', NYSE: 'XNYS' } as Record<string, string>)
                .find(([, mic]) => mic === m.mic)?.[0]
              return (
                <button key={m.symbol}
                  onClick={() => { setTicker(m.symbol.split('@')[0]); setExchange(ourAlias ?? m.mic); }}
                  title="Подставить в тест-запрос"
                  className="flex gap-3 text-gray-300 py-0.5 hover:text-white text-left w-full">
                  <span className="text-white font-mono">{m.symbol}</span>
                  <span>{m.name}</span>
                  <span className="text-gray-500">{m.type}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
