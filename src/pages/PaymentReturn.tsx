import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react'

type Status = 'checking' | 'success' | 'failed' | 'demo'

export default function PaymentReturn() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [message, setMessage] = useState('')

  const paymentId = searchParams.get('payment_id')
  const isDemo = searchParams.get('demo') === '1'

  useEffect(() => {
    if (!paymentId) {
      setStatus('failed')
      setMessage('Идентификатор платежа не найден')
      return
    }

    // If demo mode without YuKassa credentials, show demo form
    if (isDemo) {
      setStatus('demo')
      setMessage('Демо-режим оплаты')
      return
    }

    // Poll payment status from backend
    const checkStatus = async () => {
      try {
        const data = await api.get(`/payment/status/${paymentId}`)
        if (data.payment?.status === 'completed') {
          setStatus('success')
          setMessage('Оплата прошла успешно! Premium активирован.')
        } else if (data.payment?.status === 'failed') {
          setStatus('failed')
          setMessage('Платеж не был завершен. Попробуйте снова.')
        } else {
          // Still pending, poll again
          setTimeout(checkStatus, 2000)
        }
      } catch {
        setStatus('failed')
        setMessage('Ошибка проверки статуса платежа')
      }
    }

    checkStatus()
  }, [paymentId, isDemo])

  // For demo mode: simulate payment confirmation
  const handleDemoConfirm = async () => {
    if (!paymentId) return
    setStatus('checking')
    try {
      await api.post('/payment/confirm', { paymentId })
      setStatus('success')
      setMessage('Демо-оплата прошла успешно! Premium активирован на 30 дней.')
    } catch {
      setStatus('failed')
      setMessage('Ошибка подтверждения демо-платежа')
    }
  }

  return (
    <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Status card */}
        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-8 text-center">
          {status === 'checking' && (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 size={48} className="animate-spin text-[#00D4FF]" />
              </div>
              <h2 className="text-xl font-bold mb-2">Проверяем оплату...</h2>
              <p className="text-text-secondary text-sm">
                Это может занять несколько секунд
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle size={48} className="text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">Успешно!</h2>
              <p className="text-text-secondary text-sm mb-6">{message}</p>
              <button
                onClick={() => navigate('/profile')}
                className="w-full h-12 rounded-xl font-semibold transition-all hover:brightness-115"
                style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
              >
                Перейти в профиль
              </button>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="flex justify-center mb-4">
                <XCircle size={48} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">Ошибка</h2>
              <p className="text-text-secondary text-sm mb-6">{message}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/pricing')}
                  className="flex-1 h-12 rounded-xl border border-[#222222] text-white font-medium hover:bg-[#222222] transition-colors"
                >
                  Попробовать снова
                </button>
              </div>
            </>
          )}

          {status === 'demo' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)' }}>
                  <span className="text-xl font-bold" style={{ color: '#060606' }}>YK</span>
                </div>
              </div>
              <h2 className="text-xl font-bold mb-2">YuKassa — Демо</h2>
              <p className="text-text-secondary text-sm mb-4">
                В демо-режиме YuKassa не подключен. Нажмите кнопку ниже, чтобы имитировать успешную оплату.
              </p>
              <p className="text-text-muted text-xs mb-6">
                Для реальной интеграции добавьте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY в переменные окружения.
              </p>

              {/* Simulated card form */}
              <div className="rounded-xl border border-[#222222] bg-[#0a0a0a] p-4 mb-6 text-left">
                <div className="text-xs text-text-muted mb-3 uppercase tracking-wider">Демо-форма оплаты</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Номер карты</label>
                    <div className="h-10 rounded-lg bg-[#161616] border border-[#222222] flex items-center px-3 text-sm text-text-secondary font-mono">
                      5555 5555 5555 4477
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-text-muted mb-1 block">Срок</label>
                      <div className="h-10 rounded-lg bg-[#161616] border border-[#222222] flex items-center px-3 text-sm text-text-secondary font-mono">
                        12/25
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-text-muted mb-1 block">CVC</label>
                      <div className="h-10 rounded-lg bg-[#161616] border border-[#222222] flex items-center px-3 text-sm text-text-secondary font-mono">
                        000
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleDemoConfirm}
                className="w-full h-12 rounded-xl text-[15px] font-semibold transition-all hover:brightness-115"
                style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
              >
                Подтвердить демо-оплату
              </button>
            </>
          )}
        </div>

        {/* Back link */}
        <button
          onClick={() => navigate('/pricing')}
          className="flex items-center justify-center gap-2 mt-6 text-text-secondary hover:text-white transition-colors text-sm mx-auto"
        >
          <ArrowLeft size={16} />
          Вернуться к тарифам
        </button>
      </div>
    </div>
  )
}
