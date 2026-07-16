import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useFactCheckSSE } from '@/hooks/useFactCheckSSE'
import PremiumPromptModal from './PremiumPromptModal'
import NotificationSwitches from './NotificationSwitches'
import { ProgressPanel } from './factCheck/ProgressPanel'
import { ResultTabs } from './factCheck/ResultTabs'
import type { FactCheckResultV4 } from '@/types/factCheck'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Lock,
  Loader2,
  RefreshCw,
} from 'lucide-react'

export interface FactCheckArticle {
  id: string
  fact_check_status?: 'not_checked' | 'in_progress' | 'checked'
  fact_check_result?: FactCheckResultV4 | null
}

interface Props {
  article: FactCheckArticle
  onUpdate?: (patch: Partial<FactCheckArticle>) => void
}

const POLL_INTERVAL_MS = 2000
const PREMIUM_PLANS = new Set(['premium', 'club', 'pro'])

const LABEL_META: Record<string, { icon: typeof ShieldCheck; color: string }> = {
  'Высокая': { icon: ShieldCheck, color: '#34D399' },
  'Средняя': { icon: ShieldAlert, color: '#FBBF24' },
  'Низкая': { icon: ShieldAlert, color: '#F97316' },
  'Критическая': { icon: ShieldOff, color: '#EF4444' },
}

function isV4Result(result: FactCheckResultV4 | null | undefined): result is FactCheckResultV4 {
  return !!result && result.version === 4
}

export default function FactCheckSection({ article, onUpdate }: Props) {
  const { isLoggedIn, user } = useAuth()
  const isPremium = isLoggedIn && PREMIUM_PLANS.has(user?.subscription?.plan || '')

  const [status, setStatus] = useState(article.fact_check_status || 'not_checked')
  const [result, setResult] = useState<FactCheckResultV4 | null>(article.fact_check_result || null)
  const [error, setError] = useState<string | null>(null)
  const [showPaywall, setShowPaywall] = useState(false)
  const [limit, setLimit] = useState<{ per_hour: number; remaining: number; reset_in_minutes: number } | null>(null)

  const {
    stages,
    isLoading,
    error: sseError,
    isComplete,
    start: sseStart,
    stop: sseStop,
  } = useFactCheckSSE()

  useEffect(() => {
    setStatus(article.fact_check_status || 'not_checked')
    const next = article.fact_check_result || null
    setResult(isV4Result(next) ? next : null)
  }, [article.fact_check_status, article.fact_check_result])

  useEffect(() => {
    if (article.fact_check_status === 'checked') {
      refreshStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshStatus = useCallback(async () => {
    try {
      const data = await api.get(`/news/${article.id}/fact-check`)
      if (data.status === 'checked') {
        const nextResult: FactCheckResultV4 | null = data.result || null
        const validResult = isV4Result(nextResult) ? nextResult : null
        setStatus('checked')
        setResult(validResult)
        if (data.limit) setLimit(data.limit)
        onUpdate?.({
          fact_check_status: 'checked',
          fact_check_result: validResult,
        })
        return true
      }
      if (data.status === 'in_progress') {
        setStatus('in_progress')
        return false
      }
      return false
    } catch (err: any) {
      if (err.status === 404) {
        setStatus('not_checked')
        return true
      }
      console.error('[FactCheckSection] poll error:', err.message)
      return false
    }
  }, [article.id, onUpdate])

  useEffect(() => {
    if (status !== 'in_progress') return
    let mounted = true
    const tick = async () => {
      if (!mounted) return
      const done = await refreshStatus()
      if (done && mounted) {
        clearInterval(interval)
      }
    }
    tick()
    const interval = setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [status, refreshStatus])

  const startCheck = async () => {
    setError(null)
    setResult(null)
    setStatus('in_progress')
    sseStart(article.id)
  }

  useEffect(() => {
    if (isComplete) {
      refreshStatus()
    }
  }, [isComplete, refreshStatus])

  useEffect(() => {
    if (sseError) {
      setError(sseError)
    }
  }, [sseError])

  useEffect(() => {
    return () => sseStop()
  }, [sseStop])

  const renderLockedButton = () => (
    <button
      onClick={() => setShowPaywall(true)}
      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90"
      style={{ backgroundColor: '#1a1a1a', color: '#9CA3AF', border: '1px solid #222' }}
    >
      <Lock size={14} /> Проверка фактов — только Premium
    </button>
  )

  const renderStartButton = () => (
    <button
      onClick={startCheck}
      disabled={isLoading}
      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-60"
      style={{ backgroundColor: '#00D4FF22', color: '#00D4FF', border: '1px solid #00D4FF40' }}
    >
      {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
      Проверить факты
    </button>
  )

  const renderProgress = () => (
    <div className="space-y-3">
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
        style={{ backgroundColor: '#0A0A0A', border: '1px solid #1a1a1a', color: '#D1D5DB' }}
      >
        <Loader2 size={16} className="animate-spin" style={{ color: '#00D4FF' }} />
        <span>Факт-чекинг выполняется…</span>
      </div>
      <ProgressPanel stages={stages} />
    </div>
  )

  const renderResult = () => {
    if (!result) return null
    const label = result.assessment?.credibility_label || 'Средняя'
    const meta = LABEL_META[label] || LABEL_META['Средняя']
    const Icon = meta.icon

    return (
      <div className="space-y-3">
        <div
          className="flex items-center gap-3 rounded-xl p-3"
          style={{ backgroundColor: '#0A0A0A', border: `1px solid ${meta.color}30` }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${meta.color}15` }}
          >
            <Icon size={18} style={{ color: meta.color }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: meta.color }}>
              {label} достоверность
            </p>
            <p className="text-[10px]" style={{ color: '#6B7280' }}>
              {result.assessment?.verdict || 'Проверка завершена'}
            </p>
          </div>
          {result.checked_at && (
            <p className="text-[10px] text-right" style={{ color: '#6B7280' }}>
              {new Date(result.checked_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
          )}
        </div>

        <ResultTabs result={result} />

        {/* Retry — только Premium */}
        {isPremium && (
          <button
            onClick={startCheck}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#1a1a1a', color: '#D1D5DB', border: '1px solid #222' }}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Проверить снова
          </button>
        )}
        {!isPremium && (
          <div
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs"
            style={{ backgroundColor: '#1a1a1a', color: '#9CA3AF', border: '1px solid #222' }}
          >
            <Lock size={12} /> Проверить снова — Premium
          </div>
        )}
      </div>
    )
  }

  const effectiveStatus = status === 'checked' && !result ? 'not_checked' : status

  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-wider flex items-center gap-1" style={{ color: '#6B7280' }}>
        <Shield size={10} /> Факт-чекинг
      </p>

      {isLoggedIn && isPremium && effectiveStatus === 'not_checked' && renderStartButton()}
      {isLoggedIn && isPremium && effectiveStatus === 'not_checked' && (
        <p className="text-[10px] text-center mt-1" style={{ color: '#6B7280' }}>
          {limit
            ? `Осталось проверок: ${limit.remaining}/${limit.per_hour} (сброс через ${limit.reset_in_minutes} мин)`
            : `До ${user?.subscription?.plan === 'premium' ? 100 : 300} проверок в час`}
        </p>
      )}
      {isLoggedIn && isPremium && effectiveStatus === 'in_progress' && renderProgress()}

      {effectiveStatus === 'checked' && renderResult()}

      {isLoggedIn && isPremium && effectiveStatus !== 'in_progress' && (
        <NotificationSwitches compact />
      )}

      {(effectiveStatus === 'not_checked' || effectiveStatus === 'in_progress') && !isPremium && renderLockedButton()}

      {error && (
        <p className="text-xs" style={{ color: '#EF4444' }}>
          {error}
        </p>
      )}

      <PremiumPromptModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Факт-чекинг — Premium"
        description="Проверяйте новости через AI + веб-поиск. Доступно на тарифах Premium, Club и Pro."
        cta="Оформить Premium"
        to="/pricing"
      />
    </div>
  )
}
