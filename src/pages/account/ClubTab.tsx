// TZ-197-club Задача 7: вкладка «Клуб» в личном кабинете.
// Закрытый Telegram-канал по тарифу с фичей club_access (или ручной выдаче
// админа). Пять обязательных состояний: апсейл без тарифа / TG не привязан
// (существующий флоу /api/telegram/link + поллинг /user/telegram-status) /
// получение персональной одноразовой ссылки / «Вы в канале» + выход / скелетон
// и toast-ошибки. Рефетч статуса по фокусу вкладки (возврат из Telegram).
import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import GlassCard from '@/components/GlassCard'
import {
  Star, Check, Copy, ExternalLink, LogOut, MessageCircle, Loader2, Users,
} from 'lucide-react'

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

const TG_POLL_INTERVAL_MS = 5000
const TG_POLL_TIMEOUT_MS = 2 * 60 * 1000 // 2 минуты — паттерн Profile.tsx:317-341

interface ClubStatus {
  eligible: boolean
  eligibleReason: 'tariff' | 'manual'
  telegramConnected: boolean
  membership: 'none' | 'invited' | 'member' | 'kicked'
  joinedAt: string | null
  channelUrl: string | null
}

interface ClubPlan {
  id: string
  name: string
  price: number
  billingFrequency: string
  features: Record<string, unknown>
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function periodLabel(freq: string): string {
  if (freq === 'yearly') return '/год'
  if (freq === 'quarterly') return '/кв'
  if (freq === 'weekly') return '/нед'
  return '/мес'
}

export default function ClubTab() {
  const { toast, toastError } = useToast()

  const [status, setStatus] = useState<ClubStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Апсейл: план с club_access из /api/plans (без хардкода цены — ТЗ §7.1)
  const [clubPlan, setClubPlan] = useState<ClubPlan | null>(null)

  // Состояние 2: привязка Telegram
  const [tgBusy, setTgBusy] = useState(false)
  const [tgPolling, setTgPolling] = useState(false)
  const [tgError, setTgError] = useState<string | null>(null)
  const tgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tgTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Состояние 3: приглашение
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Состояние 4: выход из канала
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.get('/club/status')
      setStatus(data)
      setLoadError(null)
      return data as ClubStatus
    } catch (err: any) {
      setLoadError(err?.message || 'Не удалось загрузить статус клуба')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    loadStatus()
    // Цена для апсейла — из того же /api/plans, что на странице тарифов (ТЗ-197 §7.1)
    api.get('/plans')
      .then(data => {
        const plans: ClubPlan[] = data?.plans || data || []
        const plan = plans.find(p => p?.features?.club_access === true) || plans.find(p => p?.id === 'club')
        setClubPlan(plan || null)
      })
      .catch(() => setClubPlan(null))
  }, [loadStatus])

  // Рефетч по фокусу вкладки: пользователь вернулся из Telegram после вступления
  // (webhook chat_member уже записал membership='member' в БД).
  useEffect(() => {
    const onFocus = () => { loadStatus() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadStatus])

  // ── Привязка Telegram (существующий флоу: /api/telegram/link + поллинг) ──
  const stopTgPolling = useCallback(() => {
    if (tgIntervalRef.current) clearInterval(tgIntervalRef.current)
    if (tgTimeoutRef.current) clearTimeout(tgTimeoutRef.current)
    tgIntervalRef.current = null
    tgTimeoutRef.current = null
    setTgPolling(false)
    setTgBusy(false)
  }, [])

  useEffect(() => () => stopTgPolling(), [stopTgPolling])

  const pollTgStatus = useCallback(() => {
    setTgPolling(true)
    const check = async () => {
      try {
        const data = await api.get('/user/telegram-status')
        if (data?.connected) {
          stopTgPolling()
          toast('Telegram подключён')
          // Подтянуть свежий статус клуба (telegramConnected должен стать true)
          loadStatus()
        }
      } catch {
        // silent fail — polling should not spam errors (паттерн Profile.tsx)
      }
    }
    check()
    tgIntervalRef.current = setInterval(check, TG_POLL_INTERVAL_MS)
    tgTimeoutRef.current = setTimeout(() => {
      stopTgPolling()
      setTgError('Таймаут подключения. Попробуйте снова.')
    }, TG_POLL_TIMEOUT_MS)
  }, [loadStatus, stopTgPolling, toast])

  const handleConnectTg = async () => {
    setTgBusy(true)
    setTgError(null)
    try {
      const data = await api.get('/telegram/link')
      if (data?.deepLink) {
        window.open(data.deepLink, '_blank', 'noopener')
        pollTgStatus()
      } else if (data?.error) {
        setTgError(data.error)
        setTgBusy(false)
      }
    } catch (err: any) {
      setTgError(err?.message || 'Не удалось получить ссылку. Попробуйте позже.')
      setTgBusy(false)
    }
  }

  // ── Приглашение в канал ──
  const handleInvite = async () => {
    setInviting(true)
    try {
      const data = await api.post('/club/invite', {})
      setInviteLink(data?.inviteLink || null)
      if (!data?.inviteLink) toastError('Не удалось получить ссылку')
    } catch (err: any) {
      const code = err?.data?.error
      if (code === 'telegram_not_connected') {
        // ТЗ §7.5: расшифровка → состояние 2 (ре-фетч покажет «TG не привязан»)
        toastError('Telegram не привязан к аккаунту. Подключите его заново.')
        setInviteLink(null)
        loadStatus()
      } else if (code === 'club_access_required') {
        toastError('Доступ в клуб недоступен по текущему тарифу')
        loadStatus()
      } else if (code === 'club_not_configured') {
        toastError('Канал клуба пока настраивается. Попробуйте позже.')
      } else {
        toastError(err?.message || 'Не удалось получить ссылку')
      }
    } finally {
      setInviting(false)
    }
  }

  const copyInvite = () => {
    if (!inviteLink || !navigator.clipboard?.writeText) return
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        setCopied(true)
        toast('Ссылка скопирована')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  // ── Выход из канала ──
  const handleLeave = async () => {
    setLeaving(true)
    try {
      await api.post('/club/leave', {})
      toast('Вы вышли из канала клуба')
      setConfirmLeave(false)
      setInviteLink(null)
      await loadStatus()
    } catch (err: any) {
      toastError(err?.message || 'Не удалось выйти из канала')
    } finally {
      setLeaving(false)
    }
  }

  // ═══ РЕНДЕР ═══

  // Состояние 5: загрузка — скелетон
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse" data-testid="club-skeleton">
        <div className="h-40 rounded-2xl bg-white/5" />
        <div className="h-28 rounded-2xl bg-white/5" />
      </div>
    )
  }

  if (loadError && !status) {
    return (
      <GlassCard className="text-center py-10">
        <p className="text-[#9CA3AF] text-sm mb-4">{loadError}</p>
        <button
          onClick={() => { setLoading(true); loadStatus() }}
          className="h-10 px-5 rounded-xl text-[13px] font-bold text-[#060606] transition-all hover:brightness-115"
          style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)' }}
        >
          Повторить
        </button>
      </GlassCard>
    )
  }

  // Состояние 1: нет тарифа клуба — апсейл
  if (status && !status.eligible) {
    return (
      <motion.div
        key="club"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3, ease: easeOutExpo }}
        className="space-y-6"
      >
        <GlassCard accentColor="#F59E0B">
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)' }}
            >
              <Star size={18} style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Закрытый Telegram-канал Клуба</h3>
              <p className="text-xs text-[#6B7280]">Доступ по тарифу «Клуб»</p>
            </div>
          </div>

          <div className="space-y-2 text-[13px] text-[#9CA3AF] mb-5">
            <p>• Закрытый канал с разбором рынка и инсайтами команды</p>
            <p>• Прямое общение с аналитиками и другими участниками клуба</p>
            <p>• Материалы и сигналы, которые не попадают в общую ленту</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
            >
              <Star size={16} />
              Смотреть тариф
            </Link>
            {clubPlan && clubPlan.price > 0 && (
              <span className="text-sm text-[#6B7280]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {clubPlan.name}: {Math.round(clubPlan.price).toLocaleString('ru-RU')} ₽{periodLabel(clubPlan.billingFrequency)}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#6B7280] mt-3">
            Доступ сохраняется, пока активен тариф (с учётом grace-периода).
          </p>
        </GlassCard>
      </motion.div>
    )
  }

  const connected = status?.telegramConnected ?? false
  const isMember = status?.membership === 'member'

  return (
    <motion.div
      key="club"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: easeOutExpo }}
      className="space-y-6"
    >
      {status?.eligibleReason === 'manual' && (
        <div
          className="rounded-xl p-4 flex items-start gap-3 text-[12px] leading-relaxed"
          style={{ background: 'rgba(167, 139, 250, 0.05)', border: '1px solid rgba(167, 139, 250, 0.2)', color: '#9CA3AF' }}
        >
          <Users size={16} className="shrink-0 mt-0.5" style={{ color: '#A78BFA' }} />
          <span>Доступ в клуб выдан администратором — он не привязан к тарифу и не снимается автоматически.</span>
        </div>
      )}

      <GlassCard accentColor="#00D4FF">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.15)' }}
          >
            <Star size={18} style={{ color: '#00D4FF' }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Закрытый Telegram-канал Клуба</h3>
            <p className="text-xs text-[#6B7280]">Персональное приглашение — только для вашего аккаунта</p>
          </div>
        </div>

        {/* Состояние 2: тариф есть, Telegram не привязан */}
        {!connected && !isMember && (
          <div>
            <p className="text-[13px] font-semibold text-white mb-1">Шаг 1 из 2 — подключите Telegram</p>
            <p className="text-[12px] text-[#9CA3AF] mb-4">
              Привяжите Telegram-аккаунт, чтобы получить персональную ссылку в закрытый канал.
            </p>
            <button
              onClick={handleConnectTg}
              disabled={tgBusy || tgPolling}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold transition-all hover:brightness-115 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #0088CC, #0055AA)', color: '#fff' }}
            >
              {tgBusy ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
              {tgPolling ? 'Ожидаем подтверждения...' : 'Подключить Telegram'}
            </button>
            {tgPolling && (
              <p className="text-[11px] text-[#6B7280] mt-3 flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-[#0088CC] border-t-transparent rounded-full animate-spin inline-block" />
                Подтвердите запуск бота в Telegram — статус обновится автоматически (до 2 минут).
              </p>
            )}
            {tgError && <p className="text-[12px] text-red-400 mt-3">{tgError}</p>}
          </div>
        )}

        {/* Состояние 3: Telegram привязан, не в канале — получение ссылки */}
        {connected && !isMember && (
          <div>
            <p className="text-[13px] font-semibold text-white mb-1">Шаг 2 из 2 — получите ссылку в канал</p>
            <p className="text-[12px] text-[#9CA3AF] mb-4">
              Ссылка одноразовая и только для вашего аккаунта. Если вы уже вступали ранее — запросите новую.
            </p>

            {!inviteLink ? (
              <button
                onClick={handleInvite}
                disabled={inviting}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold transition-all hover:brightness-115 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
              >
                {inviting && <Loader2 size={16} className="animate-spin" />}
                {inviting ? 'Получаем ссылку...' : 'Получить ссылку'}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <code
                    className="flex-1 min-w-[220px] rounded-xl px-3 py-2.5 text-[12px] text-[#9CA3AF] font-mono break-all"
                    style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
                  >
                    {inviteLink}
                  </code>
                  <button
                    onClick={copyInvite}
                    className="h-10 px-3 rounded-xl text-xs text-[#9CA3AF] hover:text-white transition-colors inline-flex items-center gap-1.5 self-start"
                    style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={inviteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
                    style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                  >
                    <ExternalLink size={16} />
                    Открыть канал
                  </a>
                  <button
                    onClick={handleInvite}
                    disabled={inviting}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-medium text-[#9CA3AF] border border-[#222] hover:bg-[#222] transition-colors disabled:opacity-50"
                  >
                    {inviting && <Loader2 size={14} className="animate-spin" />}
                    Обновить ссылку
                  </button>
                </div>
                <p className="text-[11px] text-[#6B7280]">
                  После вступления статус «Вы в канале» появится автоматически — вернитесь на эту вкладку.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Состояние 4: в канале */}
        {isMember && (
          <div>
            <p className="text-[15px] font-semibold text-[#34D399] mb-1">Вы в канале ✅</p>
            <p className="text-[12px] text-[#9CA3AF] mb-4">
              Вступили {fmtDate(status?.joinedAt)}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {status?.channelUrl && (
                <a
                  href={status.channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
                  style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                >
                  <ExternalLink size={16} />
                  Открыть канал
                </a>
              )}
              {!confirmLeave ? (
                <button
                  onClick={() => setConfirmLeave(true)}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-medium text-[#9CA3AF] border border-[#222] hover:text-[#EF4444] hover:border-[rgba(239,68,68,0.4)] hover:bg-[rgba(239,68,68,0.15)] transition-colors"
                >
                  <LogOut size={14} />
                  Выйти из канала
                </button>
              ) : (
                <div
                  className="flex items-center flex-wrap gap-3 px-3 py-2.5 rounded-[10px] text-[12px] w-full sm:w-auto"
                  style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#FCA5A5' }}
                >
                  <span className="flex-1 min-w-[180px]">Выйти из канала? Повторное вступление потребует новой ссылки.</span>
                  <button
                    onClick={handleLeave}
                    disabled={leaving}
                    className="h-7 px-3 rounded-lg text-[11px] font-bold text-white bg-[#EF4444] hover:bg-[#f87171] transition-colors disabled:opacity-50"
                  >
                    {leaving ? 'Выходим...' : 'Выйти'}
                  </button>
                  <button
                    onClick={() => setConfirmLeave(false)}
                    className="h-7 px-3 rounded-lg text-[11px] font-bold text-[#9CA3AF] bg-[#222] hover:bg-[#333] transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}
