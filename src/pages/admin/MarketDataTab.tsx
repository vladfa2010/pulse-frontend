import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import { RefreshCw, Activity, Search, FlaskConical } from 'lucide-react'
import CandleChart from '@/components/CandleChart'
import InstrumentSearchInput from '@/components/admin/InstrumentSearchInput'
import FinamStatusBadge from '@/components/admin/FinamStatusBadge'

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
interface TimezoneRow {
  mic: string
  name: string
  timezone: string | null
  covered: boolean
}
interface TimezonesResponse {
  rows: TimezoneRow[]
  warnings: { mic: string; hits: number }[]
}

const MIC_TO_ALIAS: Record<string, string> = { MISX: 'MOEX', XNGS: 'NASDAQ', XNYS: 'NYSE' }

export default function MarketDataTab() {
  const [providers, setProviders] = useState<ProvidersResponse | null>(null)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // test request form
  const [ticker, setTicker] = useState('SBER')
  const [exchange, setExchange] = useState('MOEX')
  const [tf, setTf] = useState<'daily' | 'm5'>('daily')
  const [testResult, setTestResult] = useState<any>(null)
  const [testLoading, setTestLoading] = useState(false)

  // assets cache status
  const [assetsStatus, setAssetsStatus] = useState<AssetsStatus | null>(null)
  const [warming, setWarming] = useState(false)

  // exchange list for test dropdown
  const [exchanges, setExchanges] = useState<ExchangeItem[]>([])
  const [exchangesLoaded, setExchangesLoaded] = useState(false)

  // timezone coverage (TZ-3.1)
  const [timezones, setTimezones] = useState<TimezonesResponse | null>(null)
  const [timezonesOpen, setTimezonesOpen] = useState(false)

  const refreshAssetsStatus = useCallback(async () => {
    try {
      const r = await adminApi.get('/admin/market/assets/status')
      setAssetsStatus(r)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { refreshAssetsStatus() }, [refreshAssetsStatus])

  // Load exchange list once on mount: used by test dropdown
  useEffect(() => {
    adminApi.get('/admin/market/exchanges')
      .then((d) => {
        setExchanges(d.exchanges || [])
        setExchangesLoaded(true)
      })
      .catch(() => { setExchangesLoaded(true) })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [p, s, t] = await Promise.all([
        adminApi.get('/admin/market/providers'),
        adminApi.get('/admin/market/providers/status'),
        adminApi.get('/admin/market/timezones').catch(() => null),
      ])
      setProviders(p)
      setStatus(s)
      setTimezones(t)
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

  const onInstrumentPick = (m: any) => {
    setTicker(m.ticker)
    setExchange(MIC_TO_ALIAS[m.mic] ?? m.mic)
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
        {providers?.providers.map((p) => (
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
              {p.id === 'finam' && status?.finam && (
                <div className="flex items-center gap-2 text-sm">
                  <FinamStatusBadge finam={status.finam} />
                </div>
              )}
            </div>
        ))}
      </div>

      {/* ── Окно 3: таймзоны бирж (TZ-3.1) ── */}
      {timezones && (
        <div className="rounded-xl border border-[#222222] bg-[#0D0D0D] p-4 space-y-3">
          <button
            onClick={() => setTimezonesOpen((v) => !v)}
            className="flex items-center justify-between w-full text-sm font-medium text-white"
          >
            <span className="flex items-center gap-2"><Activity size={15} /> Таймзоны бирж</span>
            <span className="text-xs text-gray-500">покрыто {timezones.rows.filter((r) => r.covered).length} из {timezones.rows.length} ▾</span>
          </button>
          {timezonesOpen && (
            <>
              {timezones.warnings.length > 0 && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
                  Эти MIC встречались в запросах без настройки:{' '}
                  {timezones.warnings.map((w) => `${w.mic} (${w.hits} раз)`).join(', ')} — допишите в MIC_TIMEZONE.
                </div>
              )}
              <div className="max-h-64 overflow-y-auto border border-[#222222] rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#111111] text-gray-400 sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">MIC</th>
                      <th className="px-3 py-1.5 font-medium">Биржа</th>
                      <th className="px-3 py-1.5 font-medium">Таймзона</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timezones.rows.map((r) => (
                      <tr key={r.mic} className="border-t border-[#222222]">
                        <td className="px-3 py-1.5 text-gray-300 font-mono">{r.mic}</td>
                        <td className="px-3 py-1.5 text-gray-300">{r.name}</td>
                        <td className="px-3 py-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${r.covered ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            <span className={r.covered ? 'text-green-400' : 'text-yellow-400'}>
                              {r.timezone || 'UTC (fallback)'}
                            </span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

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
                  бирж: {exchangesLoaded ? exchanges.length : '—'},
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
          <InstrumentSearchInput
            initialQuery={ticker}
            onPick={onInstrumentPick}
            placeholder={exchangesLoaded ? "Тикер, название или ISIN" : "Загружаем справочник бирж…"}
          />
        </div>
        <div className="text-xs text-gray-500">
          Выберите вариант — он подставит тикер и биржу в форму тест-запроса.
        </div>
      </div>
    </div>
  )
}
