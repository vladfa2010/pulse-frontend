import { motion, AnimatePresence } from 'framer-motion'
import { X, Lock, Zap, ArrowRight, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'

interface PremiumPromptModalProps {
  isOpen: boolean
  onClose: () => void
  // Custom content mode
  title?: string
  description?: string
  cta?: string
  to?: string
  // Default tag-limit mode (backward compat)
  currentTags?: number
  limit?: number
}

export default function PremiumPromptModal({
  isOpen,
  onClose,
  title,
  description,
  cta,
  to = '/pricing',
  currentTags,
  limit,
}: PremiumPromptModalProps) {
  const isCustom = Boolean(title)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex justify-center p-4"
          style={{ alignItems: 'flex-start', paddingTop: '10vh' }}
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="relative w-full max-w-[400px] rounded-2xl p-8"
            style={{
              backgroundColor: '#111111',
              border: '1px solid #222222',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: isCustom ? 'rgba(0, 212, 255, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: isCustom ? '1px solid rgba(0, 212, 255, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                {isCustom ? (
                  <ShieldCheck size={28} style={{ color: '#00D4FF' }} />
                ) : (
                  <Lock size={28} style={{ color: '#EF4444' }} />
                )}
              </div>
            </div>

            {/* Title */}
            <h3 className="text-center text-xl font-bold text-white mb-2">
              {title || 'Лимит тегов достигнут'}
            </h3>

            {/* Description */}
            {description && (
              <p className="text-center text-sm text-text-secondary mb-6">
                {description}
              </p>
            )}

            {/* Tag limit content */}
            {!isCustom && limit !== undefined && currentTags !== undefined && (
              <>
                <p className="text-center text-sm text-text-secondary mb-2">
                  На бесплатном тарифе можно добавить максимум <strong className="text-white">{limit} тега</strong>.
                </p>
                <div
                  className="flex items-center justify-center gap-2 mb-6 py-2 rounded-lg"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.1)' }}
                >
                  <span className="text-sm font-semibold" style={{ color: '#EF4444' }}>
                    {currentTags}/{limit}
                  </span>
                  <span className="text-xs text-text-muted">— лимит исчерпан</span>
                </div>
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Zap size={14} className="text-[#00D4FF] flex-shrink-0" />
                    До 25 тегов на Premium
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Zap size={14} className="text-[#00D4FF] flex-shrink-0" />
                    Еженедельные репорты в Telegram
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Zap size={14} className="text-[#00D4FF] flex-shrink-0" />
                    Sentiment-алерты в реальном времени
                  </div>
                </div>
              </>
            )}

            {/* CTA */}
            <Link
              to={to}
              onClick={onClose}
              className="flex items-center justify-center w-full h-11 rounded-pill text-sm font-semibold transition-all hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                color: '#060606',
              }}
            >
              {cta || 'Оформить Premium'}
              <ArrowRight size={16} className="ml-2" />
            </Link>

            {/* Secondary */}
            <button
              onClick={onClose}
              className="w-full mt-3 text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              Позже
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
