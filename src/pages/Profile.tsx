import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import {
  User, Shield, Calendar, Newspaper, LogOut, ArrowLeft, Trash2,
  CreditCard, Zap, Crown, Clock, Bell, MessageCircle, Link2,
  Unlink, Moon, Mail, Check, Sparkles, Tag,
} from 'lucide-react'

/* =============================================================================
   PULSE — Profile Page (Liquid Glass Design)
   ============================================================================= */

interface PaymentItem {
  id: string
  amount: number
  base_amount: number
  discount: number
  status: string
  paid_at: string
  created_at: string
}

type TabType = 'profile' | 'notifications' | 'tariff' | 'payments'

interface TelegramStatus {
  connected: boolean
  chatId?: string
  digestEnabled: boolean
  frequency: string
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
}

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

/* ─── Liquid Glass Card ─── */
function GlassCard({
  children,
  className = '',
  accentColor,
}: {
  children: React.ReactNode
  className?: string
  accentColor?: string
}) {
  return (
    <div
      className={`rounded-2xl p-6 md:p-8 relative overflow-hidden ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        border: `1px solid ${accentColor ? accentColor + '20' : 'rgba(255, 255, 255, 0.06)'}`,
      }}
    >
      {accentColor && (
        <div
          className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-15 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${accentColor}30, transparent)` }}
        />
      )}
      {children}
    </div>
  )
}

/* ─── Toggle Switch ─── */
function Toggle({
  enabled,
  onChange,
  activeColor = '#00D4FF',
}: {
  enabled: boolean
  onChange: () => void
  activeColor?: string
}) {
  return (
    <button
      onClick={onChange}
      className="w-11 h-6 rounded-full transition-colors relative shrink-0"
      style={{ backgroundColor: enabled ? activeColor : '#333' }}
    >
      <div
        className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-sm"
        style={{ left: enabled ? '24px' : '2px' }}
      />
    </button>
  )
}

/* ─── Main Component ─── */
export default function Profile() {
  const { user, isLoggedIn, logout, portfolio, removeTag } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [tgStatus, setTgStatus] = useState<TelegramStatus | null>(null)
  const [loadingTg, setLoadingTg] = useState(false)
  const [tgLink, setTgLink] = useState<string | null>(null)
  const [emailDigest, setEmailDigest] = useState<{ email: string; enabled: boolean }>({
    email: '', enabled: false,
  })
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [emailSaved, setEmailSaved] = useState(false)

  // Load Telegram status
  useEffect(() => {
    if (activeTab === 'notifications' && isLoggedIn) {
      setLoadingTg(true)
      api.get('/user/telegram-status')
        .then(data => setTgStatus(data))
        .catch(() => setTgStatus({
          connected: false, digestEnabled: false, frequency: '3h',
          quietHoursEnabled: false, quietHoursStart: '23:00', quietHoursEnd: '07:00',
        }))
        .finally(() => setLoadingTg(false))
    }
  }, [activeTab, isLoggedIn])

  // Load Email digest settings
  useEffect(() => {
    if (activeTab === 'notifications' && isLoggedIn) {
      setLoadingEmail(true)
      api.get('/user/email-settings')
        .then(data => setEmailDigest({ email: data.email || '', enabled: data.enabled || false }))
        .catch(() => setEmailDigest({ email: '', enabled: false }))
        .finally(() => setLoadingEmail(false))
    }
  }, [activeTab, isLoggedIn])

  const saveEmailDigest = async () => {
    setLoadingEmail(true)
    try {
      await api.post('/user/email-settings', { email: emailDigest.email, enabled: emailDigest.enabled })
      setEmailSaved(true)
      setTimeout(() => setEmailSaved(false), 3000)
    } catch {
      alert('Ошибка сохранения email')
    } finally {
      setLoadingEmail(false)
    }
  }

  const generateTgLink = async () => {
    setLoadingTg(true)
    try {
      const data = await api.get('/telegram/link')
      if (data.deepLink) setTgLink(data.deepLink)
      else if (data.error) alert('Ошибка: ' + data.error)
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes('403') || msg.includes('Premium')) alert('Требуется подписка Premium')
      else alert('Ошибка: ' + msg)
    } finally {
      setLoadingTg(false)
    }
  }

  const disconnectTg = async () => {
    if (!confirm('Отключить Telegram-уведомления?')) return
    try {
      await api.post('/user/telegram-disconnect', {})
      setTgStatus(prev => prev ? { ...prev, connected: false } : null)
      setTgLink(null)
    } catch {
      alert('Ошибка отключения')
    }
  }

  const saveSettings = async (settings: Partial<TelegramStatus>) => {
    try {
      await api.post('/user/notification-settings', settings)
      setTgStatus(prev => prev ? { ...prev, ...settings } : null)
    } catch {
      alert('Ошибка сохранения')
    }
  }

  useEffect(() => {
    if (activeTab === 'payments') {
      setLoadingPayments(true)
      api.get('/payment/history')
        .then(data => setPayments(data.payments || []))
        .catch(() => {})
        .finally(() => setLoadingPayments(false))
    }
  }, [activeTab])

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0a' }}>
        <GlassCard className="text-center max-w-sm">
          <User className="w-12 h-12 text-[#6B7280] mx-auto mb-4" />
          <p className="mb-4 text-[#9CA3AF]">Войдите, чтобы увидеть профиль</p>
          <Link to="/" className="text-[#00D4FF] hover:underline text-sm">На главную</Link>
        </GlassCard>
      </div>
    )
  }

  const isPremium = user?.subscription?.active ?? false
  const expiresAt = user?.subscription?.expiresAt
  const daysLeft = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86400000)) : 0

  const tabs: { id: TabType; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Профиль', icon: User },
    { id: 'notifications', label: 'Уведомления', icon: Bell },
    { id: 'tariff', label: 'Тариф', icon: Crown },
    { id: 'payments', label: 'Платежи', icon: CreditCard },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      {/* ═══════ HERO HEADER ═══════ */}
      <div
        className="pt-24 pb-10 px-6 md:px-12"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 212, 255, 0.06), transparent)',
        }}
      >
        <div className="max-w-[900px] mx-auto">
          {/* Back link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-white transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              <span>На главную</span>
            </Link>
          </motion.div>

          {/* User header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutExpo }}
            className="flex items-center gap-5"
          >
            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(52, 211, 153, 0.1))',
                border: '1px solid rgba(0, 212, 255, 0.2)',
              }}
            >
              <User size={36} style={{ color: '#00D4FF' }} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold tracking-tight text-white">
                  {user?.username || 'Пользователь'}
                </h1>
                {isPremium && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(0, 153, 204, 0.1))',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      color: '#00D4FF',
                    }}
                  >
                    <Zap size={12} />
                    Premium
                  </span>
                )}
              </div>
              <p className="text-[#9CA3AF] text-sm mb-2">{user?.email}</p>
              <div className="flex flex-wrap gap-3">
                {user?.isAdmin && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-purple-400">
                    <Shield size={12} />
                    Администратор
                  </span>
                )}
                {expiresAt && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
                    <Calendar size={12} />
                    {daysLeft > 0 ? `Осталось ${daysLeft} дн.` : 'Подписка истекла'}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══════ TABS ═══════ */}
      <div className="max-w-[900px] mx-auto px-6 md:px-12 mb-8">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  backgroundColor: isActive ? 'rgba(0, 212, 255, 0.08)' : 'transparent',
                  color: isActive ? '#00D4FF' : '#6B7280',
                  border: isActive ? '1px solid rgba(0, 212, 255, 0.15)' : '1px solid transparent',
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══════ CONTENT ═══════ */}
      <div className="max-w-[900px] mx-auto px-6 md:px-12 pb-20">
        <AnimatePresence mode="wait">
          {/* ====== TAB: PROFILE ====== */}
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: easeOutExpo }}
              className="space-y-6"
            >
              {/* Tags Card */}
              <GlassCard accentColor="#00D4FF">
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.15)' }}
                  >
                    <Tag size={18} style={{ color: '#00D4FF' }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Мои теги</h2>
                    <p className="text-xs text-[#6B7280]">{portfolio.length} {portfolio.length === 1 ? 'тег' : portfolio.length < 5 ? 'тега' : 'тегов'}</p>
                  </div>
                </div>

                {portfolio.length === 0 ? (
                  <p className="text-[#6B7280] text-sm">Нет отслеживаемых тегов. Добавьте на главной странице.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {portfolio.map(tag => (
                      <div
                        key={tag.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
                        style={{
                          background: 'rgba(0, 212, 255, 0.06)',
                          border: '1px solid rgba(0, 212, 255, 0.12)',
                          color: '#00D4FF',
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#00D4FF' }} />
                        <span>{tag.tag_name}</span>
                        <button
                          onClick={() => removeTag(tag.tag_id)}
                          className="ml-1 text-[#6B7280] hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              {/* Logout */}
              <GlassCard>
                <button
                  onClick={logout}
                  className="flex items-center gap-3 text-red-400 hover:text-red-300 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)' }}
                  >
                    <LogOut size={16} />
                  </div>
                  <span className="text-sm font-medium">Выйти из аккаунта</span>
                </button>
              </GlassCard>
            </motion.div>
          )}

          {/* ====== TAB: TARIFF ====== */}
          {activeTab === 'tariff' && (
            <motion.div
              key="tariff"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: easeOutExpo }}
              className="space-y-6"
            >
              {/* Current Tariff */}
              <GlassCard accentColor={isPremium ? '#00D4FF' : '#6B7280'}>
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{
                      background: isPremium
                        ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(0, 153, 204, 0.1))'
                        : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isPremium ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)'}`,
                    }}
                  >
                    {isPremium ? <Zap size={28} style={{ color: '#00D4FF' }} /> : <Shield size={28} className="text-[#6B7280]" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{isPremium ? 'Premium' : 'Free'}</h2>
                    <p className="text-sm text-[#6B7280]">{isPremium ? 'Активная подписка' : 'Базовый тариф'}</p>
                  </div>
                </div>

                {isPremium ? (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <Clock size={15} style={{ color: '#00D4FF' }} />
                      <span className="text-sm text-[#D1D5DB]">
                        Осталось: <strong className="text-white">{daysLeft} дней</strong>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden mb-4" style={{ backgroundColor: '#222' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (daysLeft / 30) * 100)}%`,
                          background: 'linear-gradient(90deg, #00D4FF, #0099CC)',
                        }}
                      />
                    </div>
                    {expiresAt && (
                      <p className="text-xs text-[#6B7280]">
                        Действует до: {new Date(expiresAt).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-[#9CA3AF]">1 тег, лента новостей на сайте</p>
                    <Link
                      to="/pricing"
                      className="inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold transition-all hover:brightness-115"
                      style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                    >
                      Перейти на Premium
                    </Link>
                  </div>
                )}
              </GlassCard>

              {/* Features */}
              {isPremium && (
                <GlassCard accentColor="#34D399">
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.15)' }}
                    >
                      <Sparkles size={18} style={{ color: '#34D399' }} />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Включено в Premium</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      'До 10 тегов',
                      'AI Daily Summary (дайджест)',
                      'Telegram + Email уведомления',
                      'Sentiment-алерты',
                      'Приоритетная поддержка',
                    ].map(f => (
                      <div key={f} className="flex items-center gap-3 text-sm text-[#9CA3AF]">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(52, 211, 153, 0.1)' }}>
                          <Check size={12} style={{ color: '#34D399' }} />
                        </div>
                        {f}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
            </motion.div>
          )}

          {/* ====== TAB: NOTIFICATIONS ====== */}
          {activeTab === 'notifications' && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: easeOutExpo }}
              className="space-y-6"
            >
              {/* Telegram */}
              <GlassCard accentColor="#0088CC">
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0, 136, 204, 0.1)', border: '1px solid rgba(0, 136, 204, 0.2)' }}
                  >
                    <MessageCircle size={18} style={{ color: '#0088CC' }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Telegram</h3>
                    <p className="text-xs text-[#6B7280]">@Insidepulse_bot</p>
                  </div>
                </div>

                {loadingTg ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-6 h-6 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : !isPremium ? (
                  <div className="text-center py-4">
                    <p className="text-[#9CA3AF] text-sm mb-3">Доступно только на Premium</p>
                    <Link to="/pricing" className="text-[#00D4FF] text-sm hover:underline">Оформить Premium</Link>
                  </div>
                ) : tgStatus?.connected ? (
                  <div className="space-y-5">
                    {/* Status */}
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Подключено</span>
                    </div>

                    {/* Frequency */}
                    <div className="pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <label className="text-[#9CA3AF] text-sm mb-2 block">Частота дайджеста</label>
                      <select
                        value={tgStatus.frequency}
                        onChange={e => saveSettings({ frequency: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00D4FF]"
                        style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
                      >
                        <option value="1h">Каждый час</option>
                        <option value="3h">Каждые 3 часа</option>
                        <option value="6h">Каждые 6 часов</option>
                        <option value="12h">Каждые 12 часов</option>
                        <option value="24h">Раз в сутки</option>
                      </select>
                    </div>

                    {/* Quiet hours */}
                    <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div className="flex items-center gap-2 text-sm text-[#D1D5DB]">
                        <Moon size={14} className="text-[#6B7280]" />
                        <span>Тихие часы</span>
                      </div>
                      <Toggle
                        enabled={tgStatus.quietHoursEnabled}
                        onChange={() => saveSettings({ quietHoursEnabled: !tgStatus.quietHoursEnabled })}
                      />
                    </div>
                    {tgStatus.quietHoursEnabled && (
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-[#6B7280] text-xs mb-1 block">С</label>
                          <input
                            type="time"
                            value={tgStatus.quietHoursStart}
                            onChange={e => saveSettings({ quietHoursStart: e.target.value })}
                            className="w-full rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                            style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[#6B7280] text-xs mb-1 block">До</label>
                          <input
                            type="time"
                            value={tgStatus.quietHoursEnd}
                            onChange={e => saveSettings({ quietHoursEnd: e.target.value })}
                            className="w-full rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                            style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Disconnect */}
                    <button
                      onClick={disconnectTg}
                      className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors pt-3"
                      style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
                    >
                      <Unlink size={14} />
                      <span>Отключить Telegram</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-[#9CA3AF] text-sm">Подключите Telegram для дайджестов и алертов.</p>
                    {!tgLink ? (
                      <button
                        onClick={generateTgLink}
                        disabled={loadingTg}
                        className="flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold transition-all hover:brightness-115 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #0088CC, #0055AA)', color: '#fff' }}
                      >
                        <Link2 size={16} />
                        Получить ссылку
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <a
                          href={tgLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block break-all text-[#0088CC] text-sm hover:underline text-center rounded-xl px-4 py-3"
                          style={{ background: 'rgba(0, 136, 204, 0.05)', border: '1px solid rgba(0, 136, 204, 0.15)' }}
                        >
                          Открыть @Insidepulse_bot
                        </a>
                        {(() => {
                          const startParam = tgLink.match(/\?start=(.+)/)?.[1]
                          if (!startParam) return null
                          const cmd = `/start ${decodeURIComponent(startParam)}`
                          return (
                            <div className="space-y-2">
                              <p className="text-[#6B7280] text-xs">На компьютере скопируйте и отправьте боту:</p>
                              <div className="flex gap-2">
                                <code className="flex-1 rounded-xl px-3 py-2 text-sm text-[#9CA3AF] font-mono break-all" style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                  {cmd}
                                </code>
                                <button
                                  onClick={() => navigator.clipboard.writeText(cmd).then(() => alert('Скопировано!')).catch(() => {})}
                                  className="h-10 px-3 rounded-xl text-xs text-[#9CA3AF] hover:text-white transition-colors shrink-0"
                                  style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
                                >
                                  Копировать
                                </button>
                              </div>
                            </div>
                          )
                        })()}
                        <p className="text-[#6B7280] text-xs">Ссылка действительна 24 часа.</p>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>

              {/* Email Digest */}
              <GlassCard accentColor="#F59E0B">
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
                  >
                    <Mail size={18} style={{ color: '#F59E0B' }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Email-дайджест</h3>
                    <p className="text-xs text-[#6B7280]">HTML-письма с новостями</p>
                  </div>
                </div>

                {loadingEmail ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : !isPremium ? (
                  <div className="text-center py-4">
                    <p className="text-[#9CA3AF] text-sm mb-3">Доступно только на Premium</p>
                    <Link to="/pricing" className="text-[#F59E0B] text-sm hover:underline">Оформить Premium</Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[#9CA3AF] text-sm mb-2 block">Email для дайджеста</label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={emailDigest.email}
                          onChange={e => setEmailDigest(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="your@email.com"
                          className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#F59E0B]"
                          style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
                        />
                        <button
                          onClick={saveEmailDigest}
                          disabled={loadingEmail}
                          className="h-11 px-5 rounded-xl text-sm font-medium transition-all hover:brightness-115 disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#060606' }}
                        >
                          {emailSaved ? (
                            <span className="flex items-center gap-1">
                              <Check size={14} /> Сохранено
                            </span>
                          ) : (
                            'Сохранить'
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-[#D1D5DB]">Отправлять дайджест</span>
                      <Toggle
                        enabled={emailDigest.enabled}
                        onChange={() => setEmailDigest(prev => ({ ...prev, enabled: !prev.enabled }))}
                        activeColor="#F59E0B"
                      />
                    </div>

                    <div className="text-[#4B5563] text-xs space-y-1 pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <p>• Дайджест с той же частотой, что и Telegram</p>
                      <p>• Тихие часы учитываются</p>
                      <p>• Формат: HTML с ссылками</p>
                    </div>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}

          {/* ====== TAB: PAYMENTS ====== */}
          {activeTab === 'payments' && (
            <motion.div
              key="payments"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: easeOutExpo }}
              className="space-y-6"
            >
              <GlassCard accentColor="#00D4FF">
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.15)' }}
                  >
                    <CreditCard size={18} style={{ color: '#00D4FF' }} />
                  </div>
                  <h3 className="text-lg font-semibold text-white">История платежей</h3>
                </div>

                {loadingPayments ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCard size={32} className="mx-auto mb-3 text-[#4B5563]" />
                    <p className="text-[#6B7280] text-sm">Платежей пока нет</p>
                    {!isPremium && (
                      <Link to="/pricing" className="text-[#00D4FF] text-sm hover:underline mt-2 inline-block">
                        Оформить Premium
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-4 py-3 rounded-xl"
                        style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{p.amount} ₽</p>
                          <p className="text-xs text-[#6B7280]">
                            {p.paid_at ? new Date(p.paid_at).toLocaleDateString('ru-RU') : new Date(p.created_at).toLocaleDateString('ru-RU')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {p.discount > 0 && (
                            <span className="text-xs text-emerald-400">-{p.discount}%</span>
                          )}
                          <span
                            className="text-xs px-2.5 py-1 rounded-full"
                            style={{
                              backgroundColor: p.status === 'completed' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: p.status === 'completed' ? '#34D399' : '#F59E0B',
                            }}
                          >
                            {p.status === 'completed' ? 'Оплачен' : 'В обработке'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
