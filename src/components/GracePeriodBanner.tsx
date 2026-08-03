import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { isInGrace } from '@/lib/subscription'
import { AlertTriangle, X } from 'lucide-react'

const SESSION_DISMISS_KEY = 'graceBannerDismissed'

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

export default function GracePeriodBanner() {
  const { user, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  // Сбрасываем dismiss при каждом новом логине, чтобы показать актуальный баннер
  useEffect(() => {
    if (!isLoggedIn) {
      try { sessionStorage.removeItem(SESSION_DISMISS_KEY) } catch {}
      setDismissed(false)
    }
  }, [isLoggedIn])

  const handleDismiss = () => {
    try { sessionStorage.setItem(SESSION_DISMISS_KEY, '1') } catch {}
    setDismissed(true)
  }

  const inGrace = isInGrace(user)
  const daysLeft = user?.subscription?.daysLeft ?? 0

  if (!inGrace || dismissed) return null

  return (
    <AnimatePresence>
      {inGrace && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, ease: easeOutExpo }}
          className="sticky top-16 z-40 px-4 py-3 border-b border-amber-500/20 bg-amber-500/10"
        >
          <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-200">
                  Подписка истекла, но функции пока работают
                </p>
                <p className="text-xs text-amber-200/70 mt-0.5">
                  Grace-период: осталось {daysLeft} {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}. Оплатите продление, чтобы сохранить доступ.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/pricing')}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-115"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#060606' }}
              >
                Оплатить
              </button>
              <button
                onClick={handleDismiss}
                className="p-1 text-amber-200/70 hover:text-amber-100 transition-colors"
                aria-label="Скрыть"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
