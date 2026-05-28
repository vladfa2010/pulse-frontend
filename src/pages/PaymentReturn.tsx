/**
 * =============================================================================
 * PULSE — Страница возврата с YuKassa (PaymentReturn)
 * =============================================================================
 *
 * Эта страница показывается после того, как пользователь:
 *   1. Нажал "Перейти на Premium" на /pricing
 *   2. Был редиректнут на YuKassa для оплаты
 *   3. YuKassa редиректит обратно сюда (return_url)
 *
 * URL: /#/payment/return?payment_id=xxx[&demo=1]
 *
 * Что делает:
 *   - Опрашивает статус платежа (polling каждые 2 сек)
 *   - Показывает спиннер → успех → или ошибка
 *   - DEMO-режим: показывает имитацию формы карты
 */

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react'

// Возможные состояния страницы
type Status = 'checking' | 'success' | 'failed' | 'demo'

export default function PaymentReturn() {
  const [searchParams] = useSearchParams()  // Читаем ?payment_id=xxx&demo=1
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [message, setMessage] = useState('')

  // Извлекаем параметры из URL
  const paymentId = searchParams.get('payment_id')
  const isDemo = searchParams.get('demo') === '1'

  const [checkCount, setCheckCount] = useState(0)
  const MAX_CHECKS = 15 // 15 * 2s = 30 seconds of polling

  // ═══════════════════════════════════════════════════════════════════════════
  // Эффект: проверяем статус платежа при загрузке страницы
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Нет payment_id → ошибка
    if (!paymentId) {
      setStatus('failed')
      setMessage('Идентификатор платежа не найден')
      return
    }

    // DEMO-режим → показываем имитацию формы карты
    if (isDemo) {
      setStatus('demo')
      setMessage('Демо-режим оплаты')
      return
    }

    // РЕАЛЬНЫЙ режим: опрашиваем статус каждые 2 секунды
    let attempts = 0
    let timer: number

    const checkStatus = async () => {
      try {
        attempts++
        setCheckCount(attempts)
        const data = await api.get(`/payment/status/${paymentId}`)

        if (data.payment?.status === 'completed') {
          // Успех! Подписка активирована
          setStatus('success')
          setMessage('Оплата прошла успешно! Premium активирован.')
          return
        } else if (data.payment?.status === 'failed') {
          // Платеж не прошёл
          setStatus('failed')
          setMessage('Платеж не был завершен. Попробуйте снова.')
          return
        }

        // Ещё pending
        if (attempts < MAX_CHECKS) {
          timer = window.setTimeout(checkStatus, 2000)
        } else {
          // Max attempts reached — show manual check button
          setMessage('Платёж ещё обрабатывается. Нажмите «Проверить» или подождите — мы уведомим вас.')
        }
      } catch {
        if (attempts < MAX_CHECKS) {
          timer = window.setTimeout(checkStatus, 3000) // Longer delay on error
        } else {
          setMessage('Не удалось проверить статус. Нажмите «Проверить» вручную.')
        }
      }
    }

    checkStatus()

    return () => { if (timer) clearTimeout(timer) }
  }, [paymentId, isDemo])

  // ═══════════════════════════════════════════════════════════════════════════
  // Force-check: если webhook не пришёл
  // ═══════════════════════════════════════════════════════════════════════════
  const handleForceCheck = async () => {
    if (!paymentId) return
    setStatus('checking')
    setMessage('Принудительная проверка у YuKassa...')
    try {
      const data = await api.post('/payment/force-check', { paymentId })

      if (data.status === 'completed') {
        setStatus('success')
        setMessage('Оплата подтверждена! Premium активирован.')
      } else if (data.status === 'failed') {
        setStatus('failed')
        setMessage('Платеж был отменён.')
      } else {
        setMessage(`Статус: ${data.yookassaStatus || 'pending'}. Попробуйте позже.`)
      }
    } catch (err: any) {
      setMessage('Ошибка проверки: ' + (err.message || 'Неизвестная ошибка'))
    }
  }

  // ─── DEMO: подтверждение оплаты ───────────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════════════════════
  // UI — отображаем состояние
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-8 text-center">

          {/* ─── Состояние: Проверяем ─────────────────────────────────── */}
          {status === 'checking' && (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 size={48} className="animate-spin text-[#00D4FF]" />
              </div>
              <h2 className="text-xl font-bold mb-2">Проверяем оплату...</h2>
              <p className="text-text-secondary text-sm mb-4">{message || 'Это может занять несколько секунд'}</p>
              {checkCount >= MAX_CHECKS && (
                <button
                  onClick={handleForceCheck}
                  className="w-full h-10 rounded-lg text-sm font-medium border border-[#222] hover:bg-[#222] transition-colors"
                >
                  Проверить принудительно
                </button>
              )}
            </>
          )}

          {/* ─── Состояние: Успех ─────────────────────────────────────── */}
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

          {/* ─── Состояние: Ошибка ────────────────────────────────────── */}
          {status === 'failed' && (
            <>
              <div className="flex justify-center mb-4">
                <XCircle size={48} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">Ошибка</h2>
              <p className="text-text-secondary text-sm mb-6">{message}</p>
              <button
                onClick={() => navigate('/pricing')}
                className="flex-1 h-12 rounded-xl border border-[#222222] text-white font-medium hover:bg-[#222222] transition-colors w-full"
              >
                Попробовать снова
              </button>
            </>
          )}

          {/* ─── Состояние: DEMO (имитация формы) ─────────────────────── */}
          {status === 'demo' && (
            <>
              {/* Заголовок */}
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)' }}>
                  <span className="text-xl font-bold" style={{ color: '#060606' }}>YK</span>
                </div>
              </div>
              <h2 className="text-xl font-bold mb-2">YuKassa — Демо</h2>
              <p className="text-text-secondary text-sm mb-4">
                В демо-режиме YuKassa не подключен. Нажмите кнопку ниже, чтобы имитировать успешную оплату.
              </p>

              {/* Имитация формы карты */}
              <div className="rounded-xl border border-[#222222] bg-[#0a0a0a] p-4 mb-6 text-left">
                <div className="text-xs text-text-muted mb-3 uppercase tracking-wider">Демо-форма оплаты</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Номер карты</label>
                    <div className="h-10 rounded-lg bg-[#161616] border border-[#222222] flex items-center px-3 text-sm text-text-secondary font-mono">
                      5555 5555 5555 4477  {/* Тестовая карта YuKassa */}
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

        {/* Ссылка "Вернуться к тарифам" */}
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
