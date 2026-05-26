import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { User, Shield, Calendar, Newspaper, LogOut, ArrowLeft, Trash2, CreditCard, Zap, Crown, Clock } from 'lucide-react'

interface PaymentItem {
  id: string
  amount: number
  base_amount: number
  discount: number
  status: string
  paid_at: string
  created_at: string
}

type TabType = 'profile' | 'tariff' | 'payments'

export default function Profile() {
  const { user, isLoggedIn, logout, portfolio, removeTag } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)

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
      <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center">
        <div className="text-center">
          <User className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="mb-4 text-text-secondary">Войдите, чтобы увидеть профиль</p>
          <Link to="/" className="text-[#00D4FF] hover:underline">На главную</Link>
        </div>
      </div>
    )
  }

  const isPremium = user?.subscription?.active ?? false
  const expiresAt = user?.subscription?.expiresAt
  const daysLeft = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86400000)) : 0

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Профиль', icon: <User size={16} /> },
    { id: 'tariff', label: 'Тариф', icon: <Crown size={16} /> },
    { id: 'payments', label: 'Платежи', icon: <CreditCard size={16} /> },
  ]

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} />
            <span>Назад</span>
          </Link>
          <h1 className="text-2xl font-bold">Профиль</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 p-1 rounded-xl bg-[#161616] border border-[#222222]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                backgroundColor: activeTab === tab.id ? '#222222' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#6B7280',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ====== TAB: PROFILE ====== */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* User Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-[#00D4FF]/10 flex items-center justify-center flex-shrink-0">
                  <User className="text-[#00D4FF]" size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold mb-1">{user?.username || 'Пользователь'}</h2>
                  <p className="text-text-secondary text-sm mb-3">{user?.email}</p>
                  <div className="flex flex-wrap gap-3">
                    {user?.subscription?.expiresAt && (
                      <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <Calendar size={14} />
                        <span>С нами с {new Date(user.subscription.expiresAt).toLocaleDateString('ru-RU')}</span>
                      </div>
                    )}
                    {user?.isAdmin && (
                      <div className="flex items-center gap-1.5 text-xs text-purple-400">
                        <Shield size={14} />
                        <span>Администратор</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Newspaper size={18} className="text-[#00D4FF]" />
                Мои теги ({portfolio.length})
              </h3>
              {portfolio.length === 0 ? (
                <p className="text-text-muted text-sm">Нет отслеживаемых тегов. Добавьте на главной странице.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {portfolio.map(tag => (
                    <div key={tag.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#161616] border border-[#222] text-sm">
                      <span className="w-2 h-2 rounded-full bg-[#00D4FF]" />
                      <span>{tag.tag_name}</span>
                      <button onClick={() => removeTag(tag.tag_id)} className="ml-1 text-text-muted hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Logout */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <button onClick={logout} className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors">
                <LogOut size={18} />
                <span>Выйти</span>
              </button>
            </div>
          </div>
        )}

        {/* ====== TAB: TARIFF ====== */}
        {activeTab === 'tariff' && (
          <div className="space-y-6">
            {/* Current Tariff Card */}
            <div
              className="rounded-2xl p-6 border"
              style={{
                borderColor: isPremium ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255,255,255,0.08)',
                background: isPremium
                  ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.06) 0%, rgba(0, 153, 204, 0.03) 100%)'
                  : 'rgba(255,255,255,0.02)',
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: isPremium ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255,255,255,0.05)' }}
                >
                  {isPremium ? <Zap size={24} className="text-[#00D4FF]" /> : <Shield size={24} className="text-text-muted" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{isPremium ? 'Premium' : 'Free'}</h2>
                  <p className="text-sm text-text-muted">{isPremium ? 'Активная подписка' : 'Базовый тариф'}</p>
                </div>
              </div>

              {isPremium ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={16} className="text-[#00D4FF]" />
                    <span className="text-sm">
                      Осталось: <strong className="text-white">{daysLeft} дней</strong>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#222222] overflow-hidden mb-4">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (daysLeft / 30) * 100)}%`,
                        background: 'linear-gradient(90deg, #00D4FF, #0099CC)',
                      }}
                    />
                  </div>
                  {user?.subscription?.expiresAt && (
                    <p className="text-xs text-text-muted">
                      Действует до: {new Date(user.subscription.expiresAt).toLocaleDateString('ru-RU')}
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-text-secondary">3 тега, лента новостей на сайте</p>
                  <Link
                    to="/pricing"
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-pill text-sm font-semibold transition-all hover:brightness-115"
                    style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                  >
                    Перейти на Premium
                  </Link>
                </div>
              )}
            </div>

            {/* Features */}
            {isPremium && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="font-semibold mb-4">Включено в Premium</h3>
                <div className="space-y-3">
                  {[
                    'До 10 тегов',
                    'Еженедельный репорт (Telegram + Email)',
                    'Sentiment-алерты в реальном времени',
                    '11 настроек уведомлений',
                    'Приоритетная поддержка',
                  ].map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                      <Zap size={14} className="text-[#00D4FF] flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====== TAB: PAYMENTS ====== */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <CreditCard size={18} className="text-[#00D4FF]" />
                История платежей
              </h3>

              {loadingPayments ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard size={32} className="mx-auto mb-3 text-text-muted opacity-40" />
                  <p className="text-text-muted text-sm">Платежей пока нет</p>
                  {!isPremium && (
                    <Link to="/pricing" className="text-[#00D4FF] text-sm hover:underline mt-2 inline-block">
                      Оформить Premium
                    </Link>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-text-muted text-left">
                        <th className="px-3 py-3">Дата</th>
                        <th className="px-3 py-3">Сумма</th>
                        <th className="px-3 py-3">Скидка</th>
                        <th className="px-3 py-3">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-3 text-text-secondary">
                            {p.paid_at ? new Date(p.paid_at).toLocaleDateString('ru-RU') : new Date(p.created_at).toLocaleDateString('ru-RU')}
                          </td>
                          <td className="px-3 py-3 font-medium">{p.amount} ₽</td>
                          <td className="px-3 py-3">
                            {p.discount > 0 ? (
                              <span className="text-emerald-400">-{p.discount}%</span>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className="text-xs px-2 py-1 rounded-full"
                              style={{
                                backgroundColor: p.status === 'completed' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                color: p.status === 'completed' ? '#34D399' : '#F59E0B',
                              }}
                            >
                              {p.status === 'completed' ? 'Оплачен' : 'В обработке'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
