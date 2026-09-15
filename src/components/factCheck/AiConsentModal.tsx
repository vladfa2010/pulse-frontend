/**
 * PULSE — Диалог согласия на передачу файла оператору ИИ (§5 TZ фактчекинга)
 *
 * Показывается при первом клике на скрепку, если пользователь ещё не давал
 * согласия (user.ai_file_consent === false), и при 403 consent_required от сервера.
 * Визуально — как PremiumPromptModal: карточка #111111, рамка #222,
 * иконка в круге 64px rgba(0,212,255,0.1). CTA неактивна, пока не отмечен чекбокс.
 *
 * После подтверждения: PUT /api/user/ai-consent {granted:true} → обновление
 * пользователя → onConfirmed() (открывает file picker).
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

interface AiConsentModalProps {
  isOpen: boolean
  onClose: () => void
  /** Вызывается после успешного сохранения согласия (открыть file picker и т.п.) */
  onConfirmed?: () => void
}

export default function AiConsentModal({ isOpen, onClose, onConfirmed }: AiConsentModalProps) {
  const { refreshUser } = useAuth()
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    if (submitting) return
    setChecked(false)
    setError(null)
    onClose()
  }

  const handleConfirm = async () => {
    if (!checked || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await api.put('/user/ai-consent', { granted: true })
      await refreshUser()
      setChecked(false)
      onClose()
      onConfirmed?.()
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить согласие. Попробуйте снова.')
    } finally {
      setSubmitting(false)
    }
  }

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
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

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
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>

            <div className="flex justify-center mb-5">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(0, 212, 255, 0.1)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                }}
              >
                <FileText size={28} style={{ color: '#00D4FF' }} />
              </div>
            </div>

            <h3 className="text-center text-lg font-semibold text-white mb-2.5">
              Передача файла оператору ИИ
            </h3>

            <p className="text-center text-sm leading-relaxed mb-5" style={{ color: '#9CA3AF' }}>
              Для извлечения текста файл будет отправлен оператору ИИ-сервиса (Moonshot AI / Kimi).
              PULSE файл не хранит — в системе остаются только его имя и извлечённый текст.
              Не прикрепляйте файлы с паролями, ключами и другими чувствительными данными.{' '}
              <Link to="/privacy" onClick={onClose} className="underline hover:text-white">
                Политика конфиденциальности
              </Link>
            </p>

            <label
              className="flex items-start gap-2.5 p-3 rounded-[10px] cursor-pointer select-none mb-5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={e => setChecked(e.target.checked)}
                className="mt-0.5 shrink-0"
                style={{ accentColor: '#00D4FF' }}
              />
              <span className="text-[13px] leading-relaxed" style={{ color: '#D1D5DB' }}>
                Согласен на передачу файлов оператору ИИ для извлечения текста. Понимаю риски.
              </span>
            </label>

            {error && (
              <p className="text-xs text-center mb-4" style={{ color: '#EF4444' }}>
                {error}
              </p>
            )}

            <button
              onClick={handleConfirm}
              disabled={!checked || submitting}
              className="flex items-center justify-center w-full h-11 rounded-pill text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-35 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                color: '#060606',
              }}
            >
              {submitting ? 'Сохраняем…' : 'Подтвердить и выбрать файл'}
            </button>

            <button
              onClick={handleClose}
              className="w-full mt-3 text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              Отмена
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
