import { useState, useEffect, useCallback } from 'react'
import { api, adminApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import DeleteFactCheckConfirmModal from './admin/DeleteFactCheckConfirmModal'
import { useFactCheckSSE } from '@/hooks/useFactCheckSSE'
import PremiumPromptModal from './PremiumPromptModal'
import NotificationSwitches from './NotificationSwitches'
import { ProgressPanel } from './factCheck/ProgressPanel'
import { ResultTabs } from './factCheck/ResultTabs'
import type { FactCheckResultV4 } from '@/types/factCheck'
import { isFeatureAccessible } from '@/lib/subscription'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Lock,
  Loader2,
  RefreshCw,
  Share2,
  Trash2,
  X,
  Copy,
  Check,
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
  const isPremium = isLoggedIn && isFeatureAccessible(user, 'factcheck')
  const isAdmin = user?.isAdmin === true
  const { toast, toastError } = useToast()

  // ТЗ-210: админ-удаление результата фактчека
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [status, setStatus] = useState(article.fact_check_status || 'not_checked')
  const [result, setResult] = useState<FactCheckResultV4 | null>(article.fact_check_result || null)
  const [error, setError] = useState<string | null>(null)
  const [showPaywall, setShowPaywall] = useState(false)
  // ТЗ-209: шеринг результата — многоразовая ссылка для гостей
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const handleShare = async () => {
    setShareLoading(true)
    setShareError(null)
    try {
      const res = await api.post(`/news/${article.id}/fact-check/share`, {})
      setShareUrl(res.url)
    } catch (err: any) {
      setShareError(err?.message || 'Не удалось создать ссылку')
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyShare = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // clipboard может быть недоступен — юзер скопирует из поля вручную
    }
  }

  // ТЗ-210: полный сброс результата — новость возвращается в «не проверена»
  const applyResetState = useCallback(() => {
    setResult(null)
    setStatus('not_checked')
    setShareUrl(null)
    onUpdate?.({ fact_check_status: 'not_checked', fact_check_result: null })
  }, [onUpdate])

  const handleDeleteFactCheck = async () => {
    setDeleteLoading(true)
    try {
      await adminApi.delete(`/api/admin/news/${article.id}/fact-check`)
      applyResetState()
      setShowDeleteConfirm(false)
      toast('Фактчек удалён')
    } catch (err: any) {
      if (err.status === 404) {
        // Состояние уже сброшено — приводим UI в соответствие
        applyResetState()
        setShowDeleteConfirm(false)
        toast('У новости нет фактчека')
      } else {
        toastError(err?.message || 'Не удалось удалить фактчек')
      }
    } finally {
      setDeleteLoading(false)
    }
  }

  const {
    stages,
    isLoading,
    error: sseError,
    isComplete,
    retryInfo,
    start: sseStart,
    stop: sseStop,
  } = useFactCheckSSE()

  // ТЗ-206: polling-ветка (SSE убит) — тот же честный статус ретрая
  // из полей attempts/next_retry_at GET-статуса
  const [pollRetry, setPollRetry] = useState<{ attempt: number; delaySec: number } | null>(null)

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
        setPollRetry(null)
        onUpdate?.({
          fact_check_status: 'checked',
          fact_check_result: validResult,
        })
        return true
      }
      if (data.status === 'in_progress') {
        setStatus('in_progress')
        if (data.attempts > 0 && data.next_retry_at) {
          const delayMs = new Date(data.next_retry_at).getTime() - Date.now()
          if (delayMs > 0) {
            setPollRetry({ attempt: data.attempts, delaySec: Math.ceil(delayMs / 1000) })
          } else {
            setPollRetry(null)
          }
        } else {
          setPollRetry(null)
        }
        return false
      }
      setPollRetry(null)
      return false
    } catch (err: any) {
      if (err.status === 404) {
        setStatus('not_checked')
        setPollRetry(null)
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
    setPollRetry(null)
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

  const renderProgress = () => {
    const activeRetry = retryInfo || pollRetry
    return (
      <div className="space-y-3">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: '#0A0A0A', border: '1px solid #1a1a1a', color: '#D1D5DB' }}
        >
          <Loader2 size={16} className="animate-spin" style={{ color: '#00D4FF' }} />
          <span>Факт-чекинг выполняется…</span>
        </div>
        {activeRetry && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
            style={{ backgroundColor: '#FBBF2410', border: '1px solid #FBBF2440', color: '#FBBF24' }}
          >
            <RefreshCw size={14} />
            <span>
              Попытка {activeRetry.attempt} не удалась — повтор через {activeRetry.delaySec} сек.
              Проверка продолжается.
            </span>
          </div>
        )}
        <ProgressPanel stages={stages} />
      </div>
    )
  }

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

        {/* ТЗ-209: шеринг результата — видна любому авторизованному (включая Free) */}
        {isLoggedIn && !result.error && (
          <button
            onClick={handleShare}
            disabled={shareLoading}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#1a1a1a', color: '#D1D5DB', border: '1px solid #222' }}
          >
            {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
            Поделиться результатом
          </button>
        )}
        {shareError && (
          <p className="text-xs text-center" style={{ color: '#EF4444' }}>
            {shareError}
          </p>
        )}

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

        {/* ТЗ-210: удаление результата — только админ, внизу карточки результата */}
        {isAdmin && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: 'transparent', color: '#EF4444', border: '1px solid #EF444450' }}
            >
              <Trash2 size={13} />
              Удалить фактчек
            </button>
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

      {/* ТЗ-209: модалка с шеринговой ссылкой */}
      {shareUrl && (        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShareUrl(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 space-y-4"
            style={{ backgroundColor: '#111111', border: '1px solid #222' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-100">Ссылка на результат</p>
              <button onClick={() => setShareUrl(null)} style={{ color: '#6B7280' }}>
                <X size={16} />
              </button>
            </div>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              Гость увидит результат проверки без регистрации. Ссылка многоразовая и живёт 7 дней.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 px-3 py-2 rounded-lg text-xs bg-[#0A0A0A] border border-[#222] text-gray-300"
              />
              <button
                onClick={handleCopyShare}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                style={
                  shareCopied
                    ? { backgroundColor: '#34D39920', color: '#34D399', border: '1px solid #34D39940' }
                    : { backgroundColor: '#00D4FF', color: '#050505' }
                }
              >
                {shareCopied ? <Check size={12} /> : <Copy size={12} />}
                {shareCopied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ТЗ-210: подтверждение удаления результата фактчека */}
      {showDeleteConfirm && (
        <DeleteFactCheckConfirmModal
          onConfirm={handleDeleteFactCheck}
          onCancel={() => setShowDeleteConfirm(false)}
          isLoading={deleteLoading}
          error={null}
        />
      )}
    </div>
  )
}
