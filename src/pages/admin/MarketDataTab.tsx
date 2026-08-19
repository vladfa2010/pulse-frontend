import { useCallback, useEffect, useState, useRef } from 'react'
import { adminApi } from '@/lib/api'
import { RefreshCw, Activity, Search, FlaskConical, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import CandleChart from '@/components/admin/CandleChart'

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
interface AssetsStatus {
  loaded: boolean
  loadedAt: string | null
  expiresAt: string | null
  count: number
}

const MIC_TO_ALIAS: Record<string, string> = { MISX: 'MOEX', XNGS: 'NASDAQ', XNYS: 'NYSE' }

const TYPE_LABEL: Record<string, string> = {
  EQUITIES: 'акция',
  BONDS: 'облигация',
  FUTURES: 'фьючерс',
  OPTIONS: 'опцион',
  CURRENCIES: 'валюта',
  INDICES: 'индекс',
  ETF: 'ETF',
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

  // autocomplete
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // assets cache status
  const [assetsStatus, setAssetsStatus] = useState<AssetsStatus | null>(null)
  const [warming, setWarming] = useState(false)

  // exchange names map for autocomplete labels
  const [exchangeNames, setExchangeNames] = useState<Record<string, string>>({})
  const [exchangesLoaded, setExchangesLoaded] = useState(false)

  const refreshAssetsStatus = useCallback(async () => {
    try {
      const r = await adminApi.get('/admin/market/assets/status')
      setAssetsStatus(r)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { refreshAssetsStatus() }, [refreshAssetsStatus])

  // Load exchange list once on mount: used by test dropdown and autocomplete labels
  useEffect(() => {
    adminApi.get('/admin/market/exchanges')
      .then((d) => {
        const list: ExchangeItem[] = d.exchanges || []
        setExchanges(list)
        const map: Record<string, string> = {}
        for (const e of list) map[String(e.mic).toUpperCase()] = e.name
        setExchangeNames(map)
        setExchangesLoaded(true)
      })
      .catch(() => { setExchangesLoaded(true) })
  }, [])

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
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const exchangeLabel = (mic: string): string => {
    const name = exchangeNames[mic?.toUpperCase()]
    return name ? `${mic} · ${name}` : mic
  }

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

  const onQueryChange = (value: string) => {
    setQuery(value.toUpperCase())
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) { setSuggestions([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const d = await adminApi.get(`/admin/market/search?q=${encodeURIComponent(value.trim())}`)
        setSuggestions(d.matches)
        setOpen(true)
        // if cache was cold, it is now warm — refresh the status badge
        await refreshAssetsStatus()
      } catch { setSuggestions([]) }
      finally { setSearching(false) }
    }, 300)
  }

  const pick = (m: any) => {
    setTicker(m.ticker)
    setExchange(MIC_TO_ALIAS[m.mic] ?? m.mic)
    setOpen(false)
    setQuery(m.symbol)
  }

  const invalidateCache = async () => {
    setWarming(true)
    try {
      const r = await adminApi.post('/admin/market/cache/invalidate', {})
      setAssetsStatus(r.status ?? null)
      // warm cache by searching a common ticker, then refresh status
      await adminApi.get('/admin/market/search?q=SBER')
      await refreshAssetsStatus()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setWarming(false)
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
                  {testResult.chart?.times?.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs text-gray-500 mb-1">
                        {testResult.chart.times.length} свечей · {testResult.provider} · {testResult.ms} мс
                      </div>
                      <CandleChart
                        times={testResult.chart.times}
                        ohlc={testResult.chart.ohlc}
                        volumes={testResult.chart.volumes}
                      />
                    </div>
                  )}
                </>}
          </div>
        )}
      </div>

      {/* ── Окно 4: автокомплит тикера ── */}
      <div className="rounded-xl border border-[#222222] bg-[#0D0D0D] p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white"><Search size={15} /> Поиск инструмента (Finam)</div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          {assetsStatus && (
            <div className="text-xs text-gray-400 flex items-center gap-2">
              {assetsStatus.loaded ? (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  Справочник: {assetsStatus.count.toLocaleString('ru-RU')} инструментов,
                  бирж: {exchangesLoaded ? Object.keys(exchangeNames).length : '—'},
                  обновлён {new Date(assetsStatus.loadedAt!).toLocaleString('ru-RU')}
                  {' · '}автообновление до {new Date(assetsStatus.expiresAt!).toLocaleString('ru-RU')}
                </>
              ) : (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />
                  {warming
                    ? 'Справочник загружается…'
                    : 'Справочник не загружен — загрузится при первом поиске (~20 сек)'}
                </>
              )}
            </div>
          )}
          <button onClick={invalidateCache} disabled={warming}
            className="px-4 py-1.5 rounded-lg bg-[#111111] border border-[#222222] text-sm text-gray-300 hover:text-white disabled:opacity-50">
            {warming ? 'Загрузка…' : 'Обновить справочник'}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap items-start">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && suggestions.length > 0) pick(suggestions[0])
                if (e.key === 'Escape') setOpen(false)
              }}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={exchangesLoaded ? "Тикер, название или ISIN" : "Загружаем справочник бирж…"}
              disabled={!exchangesLoaded}
              className="px-3 py-1.5 rounded-lg bg-[#111111] border border-[#222222] text-sm text-white w-72 disabled:opacity-50"
            />
            {searching && <span className="absolute right-3 top-2 text-xs text-gray-500">…</span>}
            {open && suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full min-w-[420px] rounded-lg border border-[#222222] bg-[#0D0D0D] shadow-xl max-h-64 overflow-y-auto">
                {suggestions.map((m) => (
                  <button key={m.symbol} onMouseDown={() => pick(m)}
                    className="flex gap-3 items-baseline w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-[#161616] hover:text-white">
                    <span className="font-medium">{m.ticker}</span>
                    <span className="text-gray-400 truncate"> — {m.name} </span>
                    {m.isin && <span className="text-gray-600 text-xs hidden sm:inline">{m.isin}</span>}
                    <span className="text-gray-500 text-xs ml-auto whitespace-nowrap">
                      {m.type ? <span className="mr-1 px-1 rounded bg-[#1a1a1a] border border-[#262626] text-gray-400">{TYPE_LABEL[m.type] ?? m.type}</span> : null}
                      ({exchangeLabel(m.mic)})
                    </span>
                  </button>
                ))}
              </div>
            )}
            {open && !searching && query.length >= 2 && suggestions.length === 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#222222] bg-[#0D0D0D] px-3 py-2 text-xs text-gray-500">
                Не найдено. Индексы (IMOEX) в справочнике отсутствуют — это нормально.
              </div>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Выберите вариант — он подставит тикер и биржу в форму тест-запроса.
        </div>
      </div>
    </div>
  )
}
