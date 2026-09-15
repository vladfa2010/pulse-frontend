/**
 * =============================================================================
 * PULSE — Страница «Фактчекинг» (/factcheck)
 * =============================================================================
 *
 * Ad-hoc проверка текста/ссылки/картинки/файла через LLM-pipeline v4 (§3 TZ):
 *   1. Шапка — заголовок + подзаголовок.
 *   2. Композер (chat-style) — textarea, авто-распознавание URL, скрепка,
 *      заметка «Все проверки частные», подсказка под формой, кнопка «Проверить».
 *      Свитчера видимости НЕТ — в v1 все проверки частные (п.2.4 TZ).
 *   3. Одна активная проверка под формой: превью входа → ProgressPanel (SSE,
 *      fallback polling 2.5 с) → результат ResultTabs + вердикт-бейдж.
 *   4. Карусель «Мои проверки» (auth, замок на всех карточках, пульс у queued).
 *   5. Карусель «Все проверки» (всем; v1 — только проверенные новости PULSE).
 *   6. Модалка детали по клику; deeplink /factcheck?r=<id> открывает её.
 *
 * Гейтинг (§11): гость → AuthModal; Free → PremiumPromptModal; клиентская
 * проверка тарифа — isPaidFeatureAccessible (как в новостном FactCheckSection).
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, Paperclip, Lock, Send, X, FileText, Image as ImageIcon,
  ShieldAlert, ShieldOff, Loader2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { isPaidFeatureAccessible } from '@/lib/subscription'
import { useFactCheckRequestSSE } from '@/hooks/useFactCheckRequestSSE'
import { ProgressPanel } from '@/components/factCheck/ProgressPanel'
import { ResultTabs } from '@/components/factCheck/ResultTabs'
import { FactCheckRequestCard } from '@/components/factCheck/FactCheckRequestCard'
import { FactCheckDetailModal } from '@/components/factCheck/FactCheckDetailModal'
import AiConsentModal from '@/components/factCheck/AiConsentModal'
import PremiumPromptModal from '@/components/PremiumPromptModal'
import NewsCarousel from '@/components/NewsCarousel'
import type {
  FactCheckListItem, FactCheckRequestItem, FactCheckFeedItem,
} from '@/types/factCheck'
import {
  detectInputType, detectFileInputType, fileValidationError, fileToBase64,
  verdictColor, formatFactCheckDate,
} from '@/lib/factCheckInput'

const POLL_INTERVAL_MS = 2500
const TOAST_AUTO_HIDE_MS = 8000

interface Attachment {
  name: string
  mime: string
  base64: string
  kind: 'image' | 'file'
}

// ─── Нормализация ответов API в единый тип карточки ─────────────────────────

function toListItem(raw: any): FactCheckListItem {
  const kind = raw.kind === 'news' ? 'news' : 'request'
  return {
    id: raw.id,
    kind,
    input_type: raw.input_type,
    title: raw.title || 'Без названия',
    snippet: raw.snippet || (raw.extracted_text ? raw.extracted_text.slice(0, 500) : undefined),
    url: raw.url,
    extracted_text: raw.extracted_text ?? null,
    status: raw.status || 'queued',
    result: raw.result || null,
    created_at: raw.created_at || new Date().toISOString(),
  }
}

const fetchFeed = async (): Promise<FactCheckListItem[]> => {
  const data = await api.get('/fact-check/feed?limit=30&offset=0')
  return ((data.items || data.feed || []) as FactCheckFeedItem[]).map(toListItem)
}

const fetchMy = async (): Promise<FactCheckListItem[]> => {
  const data = await api.get('/fact-check/my?limit=50&offset=0')
  return ((data.items || []) as FactCheckRequestItem[]).map(toListItem)
}

const hasChecking = (items?: FactCheckListItem[]) =>
  !!items?.some(i => i.status === 'queued' || i.status === 'in_progress')

/** Дружелюбный текст для 422/400 от сервера. */
function friendlyErrorMessage(err: any): string {
  const code = err?.message || ''
  if (code === 'not_verifiable') {
    return 'Это мнение или не утверждение, которое можно проверить по независимым источникам. Попробуйте переформулировать — например, укажите конкретный факт с датой и цифрами.'
  }
  if (code === 'extraction_failed') {
    return 'Не удалось извлечь текст из источника. Попробуйте скопировать текст и вставить его в поле ввода.'
  }
  return code || 'Что-то пошло не так. Попробуйте ещё раз.'
}

// ═══════════════════════════════════════════════════════════════════════════

export default function FactCheckPage() {
  const { isLoggedIn, user } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const queryClient = useQueryClient()
  const isPremium = isLoggedIn && isPaidFeatureAccessible(user)

  // ─── Композер ─────────────────────────────────────────────────────────────
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Модалки ──────────────────────────────────────────────────────────────
  const [showPaywall, setShowPaywall] = useState(false)
  const [showConsent, setShowConsent] = useState(false)

  // ─── Активная проверка ────────────────────────────────────────────────────
  const [active, setActive] = useState<FactCheckListItem | null>(null)
  const sse = useFactCheckRequestSSE()

  // ─── Модалка детали + deeplink ?r=<id> ────────────────────────────────────
  const [detailItem, setDetailItem] = useState<FactCheckListItem | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const r = searchParams.get('r')
    if (!r) return
    setDetailItem({
      id: r, kind: 'request', title: 'Загрузка…', status: 'queued',
      created_at: new Date().toISOString(),
    })
    // Чистим deeplink, чтобы модалка не открывалась повторно при F5-логике роутера
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('r')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  // Автоскрытие дружелюбного тоста под формой
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), TOAST_AUTO_HIDE_MS)
    return () => clearTimeout(t)
  }, [toast])

  // ─── Ленты ────────────────────────────────────────────────────────────────
  const feedQuery = useQuery({
    queryKey: ['factCheckFeed'],
    queryFn: fetchFeed,
    staleTime: 30 * 1000,
    retry: 1,
  })

  const myQuery = useQuery({
    queryKey: ['factCheckMy'],
    queryFn: fetchMy,
    enabled: isLoggedIn,
    staleTime: 10 * 1000,
    retry: 1,
    // Пульс «Проверяется»: пока есть активные проверки — обновляем список
    refetchInterval: (query) => (hasChecking(query.state.data) ? 5000 : false),
  })

  // ─── Отправка проверки ────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (submitting) return
    if (!isLoggedIn) {
      openAuthModal('login')
      return
    }
    if (!isPremium) {
      setShowPaywall(true)
      return
    }
    const trimmed = text.trim()
    if (!attachment && !trimmed) return

    setSubmitting(true)
    setToast(null)
    try {
      const body = attachment
        ? {
            input_type: attachment.kind,
            file_base64: attachment.base64,
            file_name: attachment.name,
            mime: attachment.mime,
          }
        : detectInputType(trimmed) === 'url'
          ? { input_type: 'url', url: trimmed }
          : { input_type: 'text', text: trimmed }

      const data = await api.post('/fact-check', body)
      const item = toListItem({ ...data, kind: 'request', extracted_text: data.extracted_text })
      setActive(item)
      setText('')
      setAttachment(null)
      queryClient.invalidateQueries({ queryKey: ['factCheckMy'] })

      if (!data.result && (data.status === 'queued' || data.status === 'in_progress')) {
        sse.start(data.id)
      }
    } catch (err: any) {
      if (err?.status === 403 && err?.message === 'consent_required') {
        setShowConsent(true)
      } else if (err?.status === 403) {
        setShowPaywall(true)
      } else {
        setToast(friendlyErrorMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }, [submitting, isLoggedIn, isPremium, attachment, text, openAuthModal, sse, queryClient])

  // Enter — отправка, Shift+Enter — перенос строки
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // ─── Скрепка и файлы ──────────────────────────────────────────────────────

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleAttachClick = useCallback(() => {
    if (!isLoggedIn) {
      openAuthModal('login')
      return
    }
    if (!isPremium) {
      setShowPaywall(true)
      return
    }
    if (!user?.ai_file_consent) {
      // После подтверждения согласия — сразу открываем выбор файла
      setShowConsent(true)
      return
    }
    openFilePicker()
  }, [isLoggedIn, isPremium, user?.ai_file_consent, openAuthModal, openFilePicker])

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // повторный выбор того же файла должен снова триггерить onChange
    if (!file) return

    const err = fileValidationError(file.name, file.size, file.type || '')
    if (err) {
      setToast(err)
      return
    }
    const kind = detectFileInputType(file.name, file.type || '')
    if (!kind) {
      setToast('Поддерживаются картинки (JPEG, PNG, WebP, GIF) и файлы (PDF, DOC, DOCX, TXT, MD).')
      return
    }
    try {
      const base64 = await fileToBase64(file)
      setAttachment({ name: file.name, mime: file.type || 'application/octet-stream', base64, kind })
      setToast(null)
    } catch {
      setToast('Не удалось прочитать файл. Попробуйте другой.')
    }
  }, [])

  // ─── Прогресс активной проверки: SSE complete/error + fallback polling ────

  const activePending =
    !!active && !active.result && (active.status === 'queued' || active.status === 'in_progress')

  useEffect(() => {
    if (sse.isComplete) {
      // Стрим завершён — дотягиваем результат одним запросом
      api
        .get(`/fact-check/${active?.id}`)
        .then((data) => {
          if (data?.result) {
            setActive((prev) => (prev ? { ...prev, ...toListItem({ ...data, kind: 'request' }) } : prev))
            queryClient.invalidateQueries({ queryKey: ['factCheckMy'] })
          }
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sse.isComplete])

  useEffect(() => {
    if (sse.error) {
      setToast(sse.error)
    }
  }, [sse.error])

  useEffect(() => {
    if (!activePending || !active) return
    let cancelled = false

    const tick = async () => {
      try {
        const data = await api.get(`/fact-check/${active.id}`)
        if (cancelled || !data) return
        if (data.status === 'checked' && data.result) {
          setActive((prev) => (prev ? { ...prev, ...toListItem({ ...data, kind: 'request' }) } : prev))
          queryClient.invalidateQueries({ queryKey: ['factCheckMy'] })
        } else if (data.status === 'failed') {
          setActive((prev) => (prev ? { ...prev, status: 'failed' } : prev))
          setToast(data.error_message || 'Проверка не удалась. Попробуйте ещё раз.')
        } else if (data.status) {
          setActive((prev) => (prev && prev.status !== data.status ? { ...prev, status: data.status } : prev))
        }
      } catch {
        // polling молчит об ошибках — следующий тик
      }
    }

    tick()
    const interval = setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePending ? active?.id : null])

  // ─── Рендер ───────────────────────────────────────────────────────────────

  const feedItems = feedQuery.data || []
  const myItems = myQuery.data || []
  const activeLabel = active?.result?.assessment?.credibility_label
  const activeScore = active?.result?.assessment?.credibility_score
  const activeColor = verdictColor(activeLabel, activeScore)
  const ActiveVerdictIcon =
    activeLabel === 'Высокая' ? ShieldCheck : activeLabel === 'Критическая' ? ShieldOff : ShieldAlert

  return (
    <div
      className="min-h-screen w-full mx-auto px-4 md:px-8 pb-16"
      style={{ maxWidth: 1200, backgroundColor: '#060606', paddingTop: 96 }}
    >
      {/* ═══ Шапка ═══ */}
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck size={28} style={{ color: '#34D399' }} />
        <h1 className="text-3xl font-bold" style={{ color: '#FFFFFF' }}>
          Фактчекинг
        </h1>
      </div>
      <p className="text-sm mb-8 max-w-[640px] leading-relaxed" style={{ color: '#9CA3AF' }}>
        Вставьте текст, ссылку на статью, картинку или документ — мы проверим достоверность
        по независимым источникам и покажем разбор.
      </p>

      {/* ═══ Композер ═══ */}
      <div
        className="rounded-2xl p-4 mb-3"
        style={{
          background: 'linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {attachment && (
          <div
            className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl text-xs w-fit max-w-full"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#D1D5DB' }}
          >
            {attachment.kind === 'image' ? <ImageIcon size={14} /> : <FileText size={14} />}
            <span className="truncate">{attachment.name}</span>
            <button
              onClick={() => setAttachment(null)}
              className="flex transition-colors hover:text-white"
              style={{ color: '#6B7280' }}
              aria-label="Убрать файл"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <textarea
          rows={3}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Вставьте текст или ссылку на статью…"
          className="w-full bg-transparent outline-none resize-none border-none text-[15px] leading-relaxed"
          style={{ color: '#FFFFFF' }}
        />

        <div
          className="flex items-center justify-between mt-2 pt-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={handleAttachClick}
              title="Прикрепить картинку или файл"
              className="p-2 rounded-full flex items-center justify-center transition-colors"
              style={{ color: '#6B7280', background: 'rgba(255,255,255,0.05)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
            >
              <Paperclip size={16} />
            </button>
            <span
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: '#6B7280' }}
              title="Публикация в общую ленту появится в следующих версиях"
            >
              <Lock size={12} />
              Все проверки частные
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || (!attachment && !text.trim())}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:brightness-115 disabled:opacity-50"
            style={{
              background: 'linear-gradient(90deg, #00D4FF, #0099CC)',
              color: '#001018',
            }}
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Проверить
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.txt,.md"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>

      {/* Подсказка под композером */}
      <p className="flex items-center gap-1.5 text-xs mb-6" style={{ color: '#6B7280' }}>
        <Lock size={12} />
        Результаты видны только вам. Публикация проверок в общую ленту появится в следующих версиях.
      </p>

      {/* Дружелюбный тост (400/422, ошибки файла) */}
      {toast && (
        <div
          className="flex items-start gap-2 px-4 py-3 mb-6 rounded-xl text-sm leading-relaxed"
          style={{
            background: 'rgba(66,32,6,0.2)',
            border: '1px solid rgba(113,63,18,0.3)',
            color: '#FACC15',
          }}
        >
          <span className="flex-1">{toast}</span>
          <button
            onClick={() => setToast(null)}
            className="flex shrink-0 transition-colors hover:text-white"
            aria-label="Закрыть"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ═══ Активная проверка ═══ */}
      {active && (
        <div
          className="rounded-2xl p-5 mb-10"
          style={{
            background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2
              className="text-sm font-semibold flex-1 truncate"
              style={{ color: '#FFFFFF' }}
            >
              {active.title}
            </h2>
            <button
              onClick={() => {
                setActive(null)
                sse.stop()
              }}
              className="flex p-0.5 transition-colors shrink-0"
              style={{ color: '#6B7280' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
          </div>

          {active.extracted_text && (
            <p
              className="text-xs mb-4 leading-relaxed"
              style={{
                color: '#6B7280',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {active.extracted_text}
            </p>
          )}

          {activePending ? (
            <ProgressPanel stages={sse.stages} />
          ) : active.result?.assessment ? (
            <>
              {/* Вердикт-бейдж */}
              <div
                className="flex items-center gap-3 rounded-xl p-3 mb-1"
                style={{ background: '#0A0A0A', border: `1px solid ${activeColor}30` }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${activeColor}15` }}
                >
                  <ActiveVerdictIcon size={18} style={{ color: activeColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: activeColor }}>
                    {activeLabel} достоверность · {activeScore}/100
                  </p>
                  <p className="text-[10px] truncate" style={{ color: '#6B7280' }}>
                    {active.result.assessment.verdict || 'Проверка завершена'}
                  </p>
                </div>
                {active.result.checked_at && (
                  <p className="text-[10px] text-right shrink-0" style={{ color: '#6B7280' }}>
                    {formatFactCheckDate(active.result.checked_at)}
                  </p>
                )}
              </div>
              <ResultTabs result={active.result} />
            </>
          ) : (
            <p className="text-sm py-2" style={{ color: '#6B7280' }}>
              {active.status === 'failed'
                ? 'Проверка не удалась. Попробуйте ещё раз.'
                : 'Ждём результат проверки…'}
            </p>
          )}
        </div>
      )}

      {/* ═══ Мои проверки (только авторизованным) ═══ */}
      {isLoggedIn && (
        myQuery.isLoading ? (
          <NewsCarousel title="Мои проверки" accentColor="#34D399">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="w-[280px] h-[140px] rounded-2xl bg-[#161616] animate-pulse flex-shrink-0" />
            ))}
          </NewsCarousel>
        ) : myItems.length > 0 ? (
          <NewsCarousel title="Мои проверки" accentColor="#34D399" count={myItems.length}>
            {myItems.map(item => (
              <FactCheckRequestCard
                key={`${item.kind}-${item.id}`}
                item={item}
                showLock
                onClick={() => setDetailItem(item)}
              />
            ))}
          </NewsCarousel>
        ) : null
      )}

      {/* ═══ Все проверки (всем; v1 — проверенные новости PULSE) ═══ */}
      {feedQuery.isLoading ? (
        <NewsCarousel title="Все проверки" accentColor="#00D4FF" subtitle="Проверенные новости PULSE">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="w-[280px] h-[140px] rounded-2xl bg-[#161616] animate-pulse flex-shrink-0" />
          ))}
        </NewsCarousel>
      ) : feedItems.length > 0 ? (
        <NewsCarousel
          title="Все проверки"
          accentColor="#00D4FF"
          subtitle="Проверенные новости PULSE"
          count={feedItems.length}
        >
          {feedItems.map(item => (
            <FactCheckRequestCard
              key={`${item.kind}-${item.id}`}
              item={item}
              onClick={() => setDetailItem(item)}
            />
          ))}
        </NewsCarousel>
      ) : null}

      {/* ═══ Модалки ═══ */}
      <FactCheckDetailModal item={detailItem} onClose={() => setDetailItem(null)} />

      <AiConsentModal
        isOpen={showConsent}
        onClose={() => setShowConsent(false)}
        onConfirmed={openFilePicker}
      />

      <PremiumPromptModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Фактчекинг — на Premium"
        description="Проверяйте любые тексты, ссылки, картинки и файлы через AI + веб-поиск. Доступно на тарифах Premium, Club и Pro."
        cta="Оформить Premium"
        to="/pricing"
      />
    </div>
  )
}
