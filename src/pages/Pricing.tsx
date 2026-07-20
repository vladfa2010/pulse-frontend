/**
 * =============================================================================
 * PULSE — Страница тарифов (Pricing) v3
 * =============================================================================
 *
 * Динамические тарифы из /api/plans + фичи из /api/features.
 * Поддержка промокодов и trial-периодов.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { api } from '@/lib/api'
import { logAnalyticsEvent } from '@/lib/analytics'
import { Check, X, ArrowLeft, Zap, Shield, Crown, Rocket, Loader2, Sparkles, Star, Percent, Gift } from 'lucide-react'

interface Plan {
  id: string
  name: string
  price: number
  billingFrequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  yearlyDiscount: number
  tagLimit: number
  planLevel: number
  features: Record<string, boolean | string | number>
  isActive: boolean
  isPopular: boolean
  comingSoonLabel?: string | null
  displayOrder: number
  legacy?: boolean
}

interface FeatureDef {
  id: string
  label: string
}

interface AppliedPromo {
  code: string
  discount_type: 'percent' | 'trial'
  discount_value: number
  final_price: number
  final_price_yearly?: number
  description?: string
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Shield size={20} className="text-text-secondary" />,
  base: <Zap size={20} className="text-emerald-400" />,
  premium: <Sparkles size={20} className="text-[#00D4FF]" />,
  club: <Crown size={20} className="text-amber-400" />,
  pro: <Rocket size={20} className="text-purple-400" />,
}

function formatPrice(n: number): string {
  if (!isFinite(n)) return '0'
  return Math.round(n).toLocaleString('ru-RU')
}

function periodLabel(freq: string): string {
  if (freq === 'yearly') return '/год'
  if (freq === 'quarterly') return '/кв'
  if (freq === 'weekly') return '/нед'
  return '/мес'
}

function computedYearlyPrice(plan: Plan): number {
  if (plan.billingFrequency !== 'monthly' || plan.yearlyDiscount <= 0) return plan.price
  return Math.round(plan.price * 12 * (1 - plan.yearlyDiscount / 100))
}

export default function Pricing() {
  const { isLoggedIn, user } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const navigate = useNavigate()

  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [plans, setPlans] = useState<Plan[]>([])
  const [featureDefs, setFeatureDefs] = useState<FeatureDef[]>([])
  const [loading, setLoading] = useState(true)
  const [payingPlan, setPayingPlan] = useState<string | null>(null)

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [promoInput, setPromoInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/plans'),
      api.get('/features'),
    ])
      .then(([plansData, featuresData]) => {
        const list: Plan[] = (plansData.plans || []).sort((a: Plan, b: Plan) => a.displayOrder - b.displayOrder)
        setPlans(list)
        setFeatureDefs(featuresData.features || [])
      })
      .catch(() => {
        setPlans([])
        setFeatureDefs([])
      })
      .finally(() => setLoading(false))
  }, [])

  // Log page view for authenticated users
  useEffect(() => {
    if (!isLoggedIn) return
    api.post('/events/page-view', { page: 'plans' }).catch(() => {})
  }, [isLoggedIn])

  // Load current plan if missing from public catalog
  useEffect(() => {
    if (!isLoggedIn || loading || plans.length === 0) return
    const currentPlanId = user?.subscription?.plan || 'free'
    if (!plans.find(p => p.id === currentPlanId)) {
      api.get('/user/my-plan')
        .then(data => {
          const mp = data.plan
          if (!mp) return
          const legacy: Plan = {
            id: mp.id,
            name: mp.name,
            price: mp.price ?? mp.price_monthly ?? 0,
            billingFrequency: 'monthly',
            yearlyDiscount: 0,
            tagLimit: mp.tag_limit ?? -1,
            planLevel: mp.plan_level ?? 0,
            features: mp.features || {},
            isActive: mp.is_active ?? true,
            isPopular: false,
            comingSoonLabel: null,
            displayOrder: 999,
            legacy: true,
          }
          setPlans(prev => [...prev, legacy].sort((a, b) => a.displayOrder - b.displayOrder))
        })
        .catch(() => {})
    }
  }, [isLoggedIn, loading, plans, user?.subscription?.plan])

  const currentPlanId = user?.subscription?.plan || 'free'
  const currentIsActive = user?.subscription?.active ?? false
  const daysLeft = user?.subscription?.daysLeft ?? 0

  const currentPlan = plans.find(p => p.id === currentPlanId)
  const currentPlanLevel = currentPlan?.planLevel ?? 0

  const selectedPlan = plans.find(p => p.id === selectedPlanId)
  const isUpgradeTarget = !!selectedPlan && currentPlanId !== 'free' && currentIsActive && selectedPlan.planLevel > currentPlanLevel

  // Clear applied promo when selecting an upgrade target
  useEffect(() => {
    if (isUpgradeTarget && appliedPromo) {
      setAppliedPromo(null)
      setPromoError('Промокоды не применяются при апгрейде')
    }
  }, [isUpgradeTarget, appliedPromo])

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlanId(plan.id)
    setPromoError(null)
    // clear promo when switching target plan
    if (appliedPromo && selectedPlanId && selectedPlanId !== plan.id) {
      setAppliedPromo(null)
    }
  }

  const handleValidatePromo = async () => {
    if (!selectedPlanId) {
      setPromoError('Выберите тариф')
      return
    }
    const code = promoInput.trim()
    if (!code) return
    setPromoLoading(true)
    setPromoError(null)
    try {
      const data = await api.get(`/promo/validate?code=${encodeURIComponent(code)}&planId=${encodeURIComponent(selectedPlanId)}`)
      if (data.valid) {
        setAppliedPromo(data)
      } else {
        setAppliedPromo(null)
        setPromoError(data.reason || 'Промокод не действителен')
      }
    } catch (err: any) {
      setAppliedPromo(null)
      setPromoError(err.message || 'Ошибка проверки промокода')
    } finally {
      setPromoLoading(false)
    }
  }

  const handleAction = async (plan: Plan) => {
    setSelectedPlanId(plan.id)
    if (!isLoggedIn) {
      openAuthModal()
      return
    }

    if (plan.id === currentPlanId) return

    // Downgrade → schedule
    if (plan.planLevel < currentPlanLevel) {
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
      const billingCycle = plan.billingFrequency === 'monthly' ? billing : plan.billingFrequency
      const body: any = {
        planId: plan.id,
        billingCycle,
        isUpgrade,
      }
      if (appliedPromo && selectedPlanId === plan.id) {
        body.promoCode = appliedPromo.code
      }
      const payment = await api.post('/payment/create', body)

      if (payment.activated) {
        navigate('/profile')
        return
      }

      if (payment.confirmation_url) {
        logAnalyticsEvent('begin_checkout', {
          currency: 'RUB',
          value: payment.payment?.amount || 0,
          subscription: billingCycle,
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

  const displayPrice = (plan: Plan): { price: number; period: string; basePrice?: number; isYearlyComputed: boolean } => {
    const isYearlyComputed = billing === 'yearly' && plan.billingFrequency === 'monthly' && plan.yearlyDiscount > 0
    if (isYearlyComputed) {
      return { price: computedYearlyPrice(plan), period: '/год', basePrice: plan.price * 12, isYearlyComputed: true }
    }
    return { price: plan.price, period: periodLabel(plan.billingFrequency), isYearlyComputed: false }
  }

  const buttonState = (plan: Plan): { text: string; disabled: boolean } => {
    if (plan.comingSoonLabel) return { text: plan.comingSoonLabel, disabled: true }
    if (plan.id === currentPlanId) return { text: 'Текущий тариф', disabled: true }

    if (plan.planLevel < currentPlanLevel) {
      return { text: `Снизить до ${plan.name}`, disabled: false }
    }

    if (currentPlanId !== 'free' && currentIsActive && daysLeft > 0) {
      return { text: `Перейти на ${plan.name}`, disabled: false }
    }

    const { price } = displayPrice(plan)
    return { text: `Перейти на ${plan.name} — ${formatPrice(price)} ₽`, disabled: false }
  }

  const activeFeatureDefs = featureDefs

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

        <div className="flex flex-col items-center gap-4 mb-8">
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
              Ежегодно {selectedPlan?.yearlyDiscount ? <span className="text-emerald-400">-{selectedPlan.yearlyDiscount}%</span> : <span className="text-emerald-400">-20%</span>}
            </button>
          </div>

          {/* Promo code input */}
          <div className="w-full max-w-md rounded-xl border p-4" style={{ backgroundColor: '#111111', borderColor: '#222222' }}>
            <div className="flex items-center gap-2 mb-2">
              {appliedPromo?.discount_type === 'trial' ? <Gift size={16} className="text-[#60A5FA]" /> : <Percent size={16} className="text-[#34D399]" />}
              <span className="text-sm font-medium" style={{ color: '#D1D5DB' }}>Промокод</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null) }}
                disabled={!selectedPlanId || isUpgradeTarget || promoLoading}
                placeholder={isUpgradeTarget ? 'Недоступно при апгрейде' : selectedPlanId ? 'Введите код' : 'Выберите тариф'}
                className="flex-1 min-w-0 px-4 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#444444] disabled:opacity-50"
                style={{ backgroundColor: '#0A0A0A', borderColor: '#222222', color: '#FFFFFF' }}
              />
              <button
                onClick={handleValidatePromo}
                disabled={!selectedPlanId || isUpgradeTarget || promoLoading || !promoInput.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#2563EB', color: '#FFFFFF' }}
              >
                {promoLoading ? <Loader2 size={14} className="animate-spin" /> : 'Применить'}
              </button>
            </div>
            {promoError && <p className="text-xs mt-2" style={{ color: '#EF4444' }}>{promoError}</p>}
            {isUpgradeTarget && <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>Промокоды не применяются при апгрейде на более высокий тариф.</p>}
            {appliedPromo && selectedPlan && (
              <div className="mt-3 p-2 rounded-lg border flex items-center justify-between" style={{ backgroundColor: '#0A0A0A', borderColor: appliedPromo.discount_type === 'trial' ? '#2563EB44' : '#10B98144' }}>
                <div>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: appliedPromo.discount_type === 'trial' ? '#2563EB22' : '#10B98122', color: appliedPromo.discount_type === 'trial' ? '#60A5FA' : '#34D399' }}>
                    {appliedPromo.code}
                  </span>
                  <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                    {appliedPromo.discount_type === 'trial'
                      ? `${appliedPromo.discount_value} дней бесплатно`
                      : `Скидка ${appliedPromo.discount_value}%`}
                  </p>
                </div>
                <button onClick={() => { setAppliedPromo(null); setPromoInput('') }} className="p-1 rounded hover:bg-[#222222]" style={{ color: '#6B7280' }}><X size={14} /></button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {plans.map((plan) => {
            const state = buttonState(plan)
            const isCurrent = plan.id === currentPlanId
            const isComingSoon = !!plan.comingSoonLabel
            const isSelected = selectedPlanId === plan.id
            const { price, period, basePrice } = displayPrice(plan)

            const promo = (appliedPromo && isSelected) ? appliedPromo : null
            const finalPrice = promo
              ? (billing === 'yearly' && promo.final_price_yearly ? promo.final_price_yearly : promo.final_price)
              : price

            return (
              <div
                key={plan.id}
                onClick={() => handleSelectPlan(plan)}
                className={`relative rounded-2xl border p-5 flex flex-col cursor-pointer transition-all ${isComingSoon ? 'opacity-60' : ''} ${isSelected ? 'ring-2 ring-[#00D4FF]' : ''}`}
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
                {plan.legacy && (
                  <div className="absolute -top-3 left-4 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#6B7280', color: '#060606' }}>
                    Устаревший
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  {PLAN_ICONS[plan.id] || <Star size={20} className="text-[#FBBF24]" />}
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
                      {promo && finalPrice !== price ? (
                        <>
                          <span className="text-lg line-through text-text-muted mr-2">{formatPrice(basePrice ?? price)} ₽</span>
                          {formatPrice(finalPrice)}
                        </>
                      ) : (
                        formatPrice(price)
                      )}
                      <span className="text-sm text-text-muted">{period}</span>
                    </>
                  )}
                </div>

                {promo && promo.discount_type === 'trial' && (
                  <div className="mb-3 p-2 rounded-lg border text-xs" style={{ backgroundColor: '#2563EB11', borderColor: '#2563EB33', color: '#60A5FA' }}>
                    <Gift size={12} className="inline mr-1" />
                    {promo.discount_value} дней бесплатно
                    <p className="mt-1" style={{ color: '#9CA3AF' }}>Списание 1 ₽ для проверки карты — вернём сразу</p>
                  </div>
                )}

                <ul className="space-y-2 mb-6 flex-1">
                  {activeFeatureDefs.map((f) => {
                    const has = plan.features?.[f.id] === true
                    return (
                      <li key={f.id} className={`flex items-start gap-2 text-xs ${has ? 'text-text-secondary' : 'text-text-muted'}`}>
                        {has ? <Check size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" /> : <X size={14} className="flex-shrink-0 mt-0.5" />}
                        <span>{f.label}</span>
                      </li>
                    )
                  })}
                </ul>

                <button
                  onClick={(e) => { e.stopPropagation(); handleAction(plan) }}
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
