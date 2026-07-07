/**
 * =============================================================================
 * PULSE — Страница тарифов (Pricing) v2
 * =============================================================================
 *
 * 4+1 тариф: Free / Base / Premium / Club / Pro.
 * Club/Pro отображаются как «Скоро».
 * Для авторизованного пользователя:
 *   - текущий тариф
 *   - апгрейд с prorated-доплатой
 *   - даунгрейд с предупреждением о заморозке тегов
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { api } from '@/lib/api'
import { logAnalyticsEvent } from '@/lib/analytics'
import { Check, X, ArrowLeft, Zap, Shield, Crown, Rocket, Loader2, Sparkles } from 'lucide-react'

interface Plan {
  id: string
  name: string
  priceMonthly: number
  priceYearly: number
  yearlyDiscount: number
  tagLimit: number
  features: Record<string, boolean | string>
  isActive: boolean
  display_order: number
  comingSoonLabel?: string
  isPopular?: boolean
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Shield size={20} className="text-text-secondary" />,
  base: <Zap size={20} className="text-emerald-400" />,
  premium: <Sparkles size={20} className="text-[#00D4FF]" />,
  club: <Crown size={20} className="text-amber-400" />,
  pro: <Rocket size={20} className="text-purple-400" />,
}

function formatPrice(n: number): string {
  return n.toLocaleString('ru-RU')
}

export default function Pricing() {
  const { isLoggedIn, user } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const navigate = useNavigate()

  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [payingPlan, setPayingPlan] = useState<string | null>(null)

  useEffect(() => {
    api.get('/plans')
      .then((data) => {
        setPlans((data.plans || []).sort((a: Plan, b: Plan) => a.display_order - b.display_order))
      })
      .catch(() => setPlans([]))
      .finally(() => setLoading(false))
  }, [])

  const currentPlanId = user?.subscription?.plan || 'free'
  const currentIsActive = user?.subscription?.active ?? false
  const daysLeft = user?.subscription?.daysLeft ?? 0

  const handleAction = async (plan: Plan) => {
    if (!isLoggedIn) {
      openAuthModal()
      return
    }

    if (plan.id === currentPlanId) return

    // Downgrade → schedule
    const planLevels: Record<string, number> = { free: 0, base: 1, premium: 2, club: 3, pro: 4 }
    if (planLevels[plan.id] < planLevels[currentPlanId]) {
      const confirmed = window.confirm(
        `Текущий тариф продолжит работать до окончания оплаченного периода. ` +
        `После этого тариф снизится до ${plan.name}, а теги сверх лимита будут заморожены. Продолжить?`
      )
      if (!confirmed) return
      try {
        await api.post('/user/downgrade', { targetPlan: plan.id })
        window.location.reload()
      } catch {
        alert('Ошибка при планировании понижения тарифа')
      }
      return
    }

    // Upgrade / purchase
    setPayingPlan(plan.id)
    try {
      const isUpgrade = currentPlanId !== 'free' && currentIsActive
      const payment = await api.post('/payment/create', {
        planId: plan.id,
        billingCycle: billing,
        isUpgrade,
      })

      if (payment.activated) {
        navigate('/profile')
        return
      }

      if (payment.confirmation_url) {
        logAnalyticsEvent('begin_checkout', {
          currency: 'RUB',
          value: payment.payment?.amount || 0,
          subscription: billing,
        })
        window.location.href = payment.confirmation_url
      } else {
        throw new Error('No confirmation URL')
      }
    } catch {
      alert('Ошибка создания платежа. Попробуйте позже.')
      setPayingPlan(null)
    }
  }

  const yearlyPrice = (plan: Plan) => (billing === 'monthly' ? plan.priceMonthly : plan.priceYearly)

  const buttonState = (plan: Plan): { text: string; disabled: boolean; isUpgrade?: boolean; topUp?: number } => {
    if (plan.comingSoonLabel) return { text: plan.comingSoonLabel, disabled: true }
    if (plan.id === currentPlanId) return { text: 'Текущий тариф', disabled: true }

    const levels: Record<string, number> = { free: 0, base: 1, premium: 2, club: 3, pro: 4 }
    if (levels[plan.id] < levels[currentPlanId]) {
      return { text: `Снизить до ${plan.name}`, disabled: false }
    }

    // Upgrade
    if (currentPlanId !== 'free' && currentIsActive && daysLeft > 0) {
      // top-up will be shown after fetch; here just generic label
      return { text: `Перейти на ${plan.name}`, disabled: false, isUpgrade: true }
    }

    return { text: `Перейти на ${plan.name} — ${formatPrice(yearlyPrice(plan))} ₽`, disabled: false }
  }

  const featuresList = useMemo(() => {
    return [
      { key: 'telegram', label: 'Telegram-дайджест', requires: true },
      { key: 'push', label: 'Push-уведомления', requires: true },
      { key: 'ai_summary', label: 'AI-саммари по портфелю', requires: true },
      { key: 'alerts', label: 'Sentiment-алерты', requires: true },
      { key: 'priority', label: 'Приоритетная доставка', requires: 'max' },
    ]
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#00D4FF]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} />
            <span>Назад</span>
          </Link>
          <h1 className="text-2xl font-bold">Тарифы</h1>
        </div>

        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-xl bg-[#161616] border border-[#222222] p-1">
            <button
              onClick={() => setBilling('monthly')}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: billing === 'monthly' ? '#222222' : 'transparent',
                color: billing === 'monthly' ? '#fff' : '#6B7280',
              }}
            >
              Ежемесячно
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: billing === 'yearly' ? '#222222' : 'transparent',
                color: billing === 'yearly' ? '#fff' : '#6B7280',
              }}
            >
              Ежегодно <span className="text-emerald-400">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {plans.map((plan) => {
            const state = buttonState(plan)
            const isCurrent = plan.id === currentPlanId
            const isComingSoon = !!plan.comingSoonLabel
            const price = yearlyPrice(plan)

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-5 flex flex-col ${isComingSoon ? 'opacity-60' : ''}`}
                style={{
                  borderColor: plan.isPopular ? 'rgba(0, 212, 255, 0.3)' : '#222222',
                  background: plan.isPopular
                    ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.06) 0%, rgba(0, 153, 204, 0.03) 100%)'
                    : 'rgba(255,255,255,0.02)',
                }}
              >
                {plan.isPopular && !isComingSoon && (
                  <div className="absolute -top-3 right-4 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#00D4FF', color: '#060606' }}>
                    Популярный
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  {PLAN_ICONS[plan.id] || <Shield size={20} />}
                  <h2 className="text-lg font-bold">{plan.name}</h2>
                </div>
                <p className="text-text-muted text-xs mb-4 h-8">
                  {plan.tagLimit < 0 ? 'Безлимит тегов' : `До ${plan.tagLimit} тегов`}
                </p>
                <div className="text-2xl font-bold mb-4">
                  {price === 0 ? (
                    <>0 <span className="text-sm text-text-muted">₽</span></>
                  ) : (
                    <>
                      {formatPrice(price)} <span className="text-sm text-text-muted">₽/{billing === 'monthly' ? 'мес' : 'год'}</span>
                    </>
                  )}
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {featuresList.map((f) => {
                    const val = plan.features?.[f.key]
                    const has = val === true || val === f.requires
                    return (
                      <li key={f.key} className={`flex items-start gap-2 text-xs ${has ? 'text-text-secondary' : 'text-text-muted'}`}>
                        {has ? <Check size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" /> : <X size={14} className="flex-shrink-0 mt-0.5" />}
                        {f.label}
                      </li>
                    )
                  })}
                </ul>

                <button
                  onClick={() => handleAction(plan)}
                  disabled={state.disabled || payingPlan === plan.id}
                  className={`flex items-center justify-center w-full h-11 rounded-xl text-sm font-semibold transition-all hover:brightness-115 disabled:opacity-70 ${
                    isCurrent
                      ? 'border border-[#222222] text-text-muted cursor-default'
                      : plan.isPopular && !isComingSoon
                        ? 'text-[#060606]'
                        : 'border border-[#222222] text-white hover:bg-[#222222]'
                  }`}
                  style={isCurrent || isComingSoon || !plan.isPopular ? {} : { background: 'linear-gradient(135deg, #00D4FF, #0099CC)' }}
                >
                  {payingPlan === plan.id && <Loader2 size={16} className="animate-spin mr-2" />}
                  {state.text}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
