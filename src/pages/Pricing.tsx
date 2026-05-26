import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { api } from '@/lib/api'
import { Check, X, ArrowLeft, Zap, Shield, Loader2 } from 'lucide-react'

const freeFeatures = [
  '3 тега для отслеживания',
  'Лента новостей на сайте',
  'Базовый сентимент-анализ',
  'Перевод EN &#8594; RU',
]

const premiumFeatures = [
  '10 тегов для отслеживания',
  'Лента новостей на сайте',
  'Расширенный сентимент-анализ',
  'Перевод EN &#8594; RU',
  'Еженедельный репорт (TG + Email)',
  'Sentiment-алерты в реальном времени',
  '11 настроек уведомлений',
  'Приоритетная поддержка',
]

export default function Pricing() {
  const { isLoggedIn, user } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [paying, setPaying] = useState(false)
  const [paySuccess, setPaySuccess] = useState(false)

  const handlePay = async () => {
    if (!isLoggedIn) { openAuthModal(); return }
    setPaying(true)
    try {
      const amount = billing === 'monthly' ? 490 : Math.floor(490 * 12 * 0.8)
      const payment = await api.post('/payment/create', { amount, discount: billing === 'yearly' ? 20 : 0 })
      await api.post('/payment/confirm', { paymentId: payment.payment.id })
      setPaySuccess(true)
      setTimeout(() => setPaySuccess(false), 3000)
    } catch {
      alert('Ошибка оплаты. Попробуйте позже.')
    } finally {
      setPaying(false)
    }
  }

  const yearlyPrice = Math.floor(490 * 12 * 0.8)

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} />
            <span>Назад</span>
          </Link>
          <h1 className="text-2xl font-bold">Тарифы</h1>
        </div>

        {/* Billing toggle */}
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

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free */}
          <div className="rounded-2xl border border-[#222222] bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={20} className="text-text-secondary" />
              <h2 className="text-xl font-bold">Free</h2>
            </div>
            <p className="text-text-muted text-sm mb-4">Для начинающих инвесторов</p>
            <div className="text-3xl font-bold mb-6">
              0 <span className="text-lg text-text-muted">&#8381;/мес</span>
            </div>
            <ul className="space-y-3 mb-6">
              {freeFeatures.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                  <Check size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
              {premiumFeatures.slice(freeFeatures.length).map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
                  <X size={16} className="flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              disabled
              className="w-full h-12 rounded-xl border border-[#222222] text-text-muted font-medium cursor-default"
            >
              Текущий тариф
            </button>
          </div>

          {/* Premium */}
          <div
            className="rounded-2xl border p-6 relative"
            style={{
              borderColor: 'rgba(0, 212, 255, 0.3)',
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.06) 0%, rgba(0, 153, 204, 0.03) 100%)',
            }}
          >
            <div className="absolute -top-3 right-6 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#00D4FF', color: '#060606' }}>
              Популярный
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Zap size={20} className="text-[#00D4FF]" />
              <h2 className="text-xl font-bold">Premium</h2>
            </div>
            <p className="text-text-muted text-sm mb-4">Для активных инвесторов</p>
            <div className="text-3xl font-bold mb-6">
              {billing === 'monthly' ? (
                <>490 <span className="text-lg text-text-muted">&#8381;/мес</span></>
              ) : (
                <>
                  {yearlyPrice} <span className="text-lg text-text-muted">&#8381;/год</span>
                  <span className="text-sm text-text-muted line-through ml-2">{490 * 12} &#8381;</span>
                </>
              )}
            </div>
            <ul className="space-y-3 mb-6">
              {premiumFeatures.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                  <Check size={16} className="text-[#00D4FF] flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={handlePay}
              disabled={paying || paySuccess}
              className="flex items-center justify-center w-full h-12 rounded-xl text-[15px] font-semibold transition-all hover:brightness-115 disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
            >
              {paying ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
              {paySuccess ? 'Подписка активирована!' : isLoggedIn ? 'Перейти на Premium' : 'Войти и подключить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
