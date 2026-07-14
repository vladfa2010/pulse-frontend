import { useState, useEffect, useCallback, useMemo, type ElementType } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useFactCheckSSE } from '@/hooks/useFactCheckSSE'
import PremiumPromptModal from './PremiumPromptModal'
import { FactCheckProgress } from './FactCheckProgress'
import type { FactCheckResult } from '@/types/factCheck'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  ShieldQuestion,
  Lock,
  Loader2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

export interface FactCheckArticle {
  id: string
  fact_check_status?: 'not_checked' | 'in_progress' | 'checked'
  fact_check_result?: FactCheckResult | null
}

interface Props {
  article: FactCheckArticle
  onUpdate?: (patch: Partial<FactCheckArticle>) => void
}

const POLL_INTERVAL_MS = 2000
const PREMIUM_PLANS = new Set(['premium', 'club', 'pro'])

const verdictMeta: Record<
  string,
  { icon: ElementType; color: string; label: string; description: string }
> = {
  reliable: {
    icon: ShieldCheck,
    color: '#34D399',
    label: 'Факты подтверждены',
    description: 'Проверяемые утверждения найдены и подтверждены независимыми источниками.',
  },
  partly_reliable: {
    icon: ShieldAlert,
    color: '#FBBF24',
    label: 'Частично достоверно',
    description: 'Некоторые утверждения подтверждены, другие нуждаются в уточнении.',
  },
  unreliable: {
    icon: ShieldOff,
    color: '#EF4444',
    label: 'Выявлены неточности',
    description: 'Найдены факты, противоречащие содержанию новости.',
  },
  unverified: {
    icon: ShieldQuestion,
    color: '#9CA3AF',
    label: 'Нет проверяемых утверждений',
    description: 'В тексте не удалось выделить конкретные проверяемые факты.',
  },
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getVerdictKey(result: FactCheckResult | null | undefined): string {
  if (!result) return 'unverified'
  if (result.error) return 'error'
  return result.verdict || 'unverified'
}

// Бэкенд возвращает confidence 0-100, но может быть и 0-1
function normalizeConfidence(value: number | undefined): number {
  if (value === undefined || value === null) return 0
  if (value > 1) return value / 100
  return value
}

export default function FactCheckSection({ article, onUpdate }: Props) {
  const { isLoggedIn, user } = useAuth()
  const isPremium = isLoggedIn && PREMIUM_PLANS.has(user?.subscription?.plan || '')

  const [status, setStatus] = useState(article.fact_check_status || 'not_checked')
  const [result, setResult] = useState(article.fact_check_result || null)
  const [error, setError] = useState<string | null>(null)
  const [showPaywall, setShowPaywall] = useState(false)
  const [expandedClaims, setExpandedClaims] = useState<Set<number>>(new Set())

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
    setResult(article.fact_check_result || null)
  }, [article.fact_check_status, article.fact_check_result])

  const refreshStatus = useCallback(async () => {
    try {
      const data = await api.get(`/news/${article.id}/fact-check`)
      console.log('[FactCheckSection] Poll response:', data)
      if (data.status === 'checked') {
        setStatus('checked')
        setResult(data.result || null)
        onUpdate?.({
          fact_check_status: 'checked',
          fact_check_result: data.result || null,
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

  const toggleClaim = (id: number) => {
    setExpandedClaims((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const verdictKey = getVerdictKey(result)
  const meta = verdictMeta[verdictKey === 'error' ? 'unverified' : verdictKey] || verdictMeta.unverified
  const Icon = meta.icon

  const confidenceRatio = useMemo(() => normalizeConfidence(result?.confidence), [result])

  const confidenceLabel = useMemo(() => {
    if (result?.confidence === undefined || result?.confidence === null) return null
    if (confidenceRatio >= 0.8) return 'Высокая уверенность'
    if (confidenceRatio >= 0.5) return 'Средняя уверенность'
    return 'Низкая уверенность'
  }, [result, confidenceRatio])

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
      <FactCheckProgress stages={stages} />
    </div>
  )

  const renderResult = () => (
    <div className="space-y-4">
      {/* Verdict card */}
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ backgroundColor: '#0A0A0A', border: `1px solid ${meta.color}30` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${meta.color}15` }}
          >
            <Icon size={20} style={{ color: meta.color }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: meta.color }}>
              {verdictKey === 'error' ? 'Ошибка проверки' : meta.label}
            </p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              {verdictKey === 'error' && result?.error
                ? result.error
                : meta.description}
            </p>
          </div>
        </div>

        {result?.confidence !== undefined && result.confidence !== null && (
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: '#9CA3AF' }}>
              <span>{confidenceLabel}</span>
              <span>{Math.round(confidenceRatio * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#222' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(confidenceRatio * 100)}%`,
                  backgroundColor: meta.color,
                }}
              />
            </div>
          </div>
        )}

        {result?.checked_at && (
          <p className="text-[10px]" style={{ color: '#6B7280' }}>
            Проверено {formatDate(result.checked_at)}
            {result.model && ` · ${result.model}`}
          </p>
        )}
      </div>

      {/* Claims */}
      {result?.claims && result.claims.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>
            Проверенные утверждения
          </p>
          {result.claims.map((claim) => {
            const expanded = expandedClaims.has(claim.id)
            const claimColor =
              claim.verdict === 'confirmed'
                ? '#34D399'
                : claim.verdict === 'partly_true'
                ? '#FBBF24'
                : claim.verdict === 'false'
                ? '#EF4444'
                : '#9CA3AF'
            const claimLabel =
              claim.verdict === 'confirmed'
                ? 'Подтверждено'
                : claim.verdict === 'partly_true'
                ? 'Частично'
                : claim.verdict === 'false'
                ? 'Опровергнуто'
                : 'Не подтверждено'

            return (
              <div
                key={claim.id}
                className="rounded-xl p-3 space-y-2"
                style={{ backgroundColor: '#0A0A0A', border: '1px solid #1a1a1a' }}
              >
                <button
                  onClick={() => toggleClaim(claim.id)}
                  className="flex items-start justify-between gap-2 w-full text-left"
                >
                  <p className="text-sm" style={{ color: '#D1D5DB' }}>
                    {claim.text}
                  </p>
                  {expanded ? <ChevronUp size={14} style={{ color: '#6B7280' }} /> : <ChevronDown size={14} style={{ color: '#6B7280' }} />}
                </button>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${claimColor}15`, color: claimColor }}
                  >
                    {claimLabel}
                  </span>
                  {claim.confidence !== undefined && (
                    <span className="text-[10px]" style={{ color: '#6B7280' }}>
                      {Math.round(normalizeConfidence(claim.confidence) * 100)}%
                    </span>
                  )}
                </div>
                {expanded && (
                  <div className="space-y-2 pt-1">
                    {claim.explanation && (
                      <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>
                        {claim.explanation}
                      </p>
                    )}
                    {(claim.sources?.length ? claim.sources : claim.source ? [{ name: claim.source, url: '' }] : []).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px]" style={{ color: '#6B7280' }}>Источники:</p>
                        {(claim.sources?.length ? claim.sources : [{ name: claim.source, url: '' }]).map((s, i) => (
                          <div key={i} className="flex items-center gap-1 text-xs" style={{ color: '#60A5FA' }}>
                            <ExternalLink size={10} />
                            {s.url ? (
                              <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                                {s.name || s.url}
                              </a>
                            ) : (
                              <span className="truncate">{s.name}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Aggregated sources */}
      {result?.sources && result.sources.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>
            Источники
          </p>
          <div className="flex flex-wrap gap-2">
            {result.sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-90"
                style={{ backgroundColor: '#1a1a1a', color: '#60A5FA', border: '1px solid #222' }}
              >
                <ExternalLink size={10} /> {s.name || s.url}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Retry button for error / unreliable / partly */}
      {(verdictKey === 'error' || verdictKey === 'unreliable' || verdictKey === 'partly_reliable') && (
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
    </div>
  )

  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-wider flex items-center gap-1" style={{ color: '#6B7280' }}>
        <Shield size={10} /> Факт-чекинг
      </p>

      {!isLoggedIn && renderLockedButton()}
      {isLoggedIn && !isPremium && renderLockedButton()}
      {isLoggedIn && isPremium && status === 'not_checked' && renderStartButton()}
      {isLoggedIn && isPremium && status === 'in_progress' && renderProgress()}
      {isLoggedIn && isPremium && status === 'checked' && !isLoading && renderResult()}

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
