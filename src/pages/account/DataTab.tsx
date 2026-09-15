/**
 * PULSE — Профиль → вкладка «Ваши данные» (§5 TZ фактчекинга)
 *
 * Переключатель «Передача файлов оператору ИИ» + дата выдачи согласия.
 * Отзыв — с подтверждающим диалогом («новые загрузки файлов станут недоступны»),
 * мгновенный: PUT /api/user/ai-consent {granted:false}.
 *
 * Отзыв не влияет на прошлые проверки: файлы не хранятся, извлечённый текст остаётся.
 * Вкладка расширяемая (v2: экспорт данных, удаление аккаунта).
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Database, FileText, Info } from 'lucide-react'
import GlassCard from '@/components/GlassCard'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatFactCheckDateTime } from '@/lib/factCheckInput'

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

export default function DataTab() {
  const { user, refreshUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const granted = user?.ai_file_consent === true
  const grantedAt = user?.ai_file_consent_at

  const setConsent = async (value: boolean) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.put('/user/ai-consent', { granted: value })
      await refreshUser()
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить. Попробуйте снова.')
    } finally {
      setBusy(false)
    }
  }

  const handleToggle = () => {
    if (busy) return
    if (granted) {
      setConfirmRevoke(true)
    } else {
      setConsent(true)
    }
  }

  const handleConfirmRevoke = async () => {
    setConfirmRevoke(false)
    await setConsent(false)
  }

  return (
    <motion.div
      key="data"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: easeOutExpo }}
      className="space-y-6"
    >
      <GlassCard accentColor="#00D4FF">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
            }}
          >
            <FileText size={18} style={{ color: '#00D4FF' }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Передача файлов оператору ИИ</h3>
            <p className="text-xs text-[#6B7280]">
              Нужна для проверки картинок и документов на странице «Фактчекинг»
            </p>
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-4 p-4 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">Передача файлов оператору ИИ</p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {granted
                ? `Согласие выдано${grantedAt ? ` · ${formatFactCheckDateTime(grantedAt)}` : ''}`
                : 'Не выдано — прикрепление файлов недоступно'}
            </p>
          </div>

          {/* Переключатель */}
          <button
            onClick={handleToggle}
            disabled={busy}
            role="switch"
            aria-checked={granted}
            className="relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50"
            style={{
              backgroundColor: granted ? '#00D4FF' : 'rgba(255,255,255,0.1)',
            }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
              style={{
                left: granted ? '22px' : '2px',
                backgroundColor: granted ? '#001018' : '#6B7280',
              }}
            />
          </button>
        </div>

        {error && (
          <p className="text-xs mt-3" style={{ color: '#EF4444' }}>
            {error}
          </p>
        )}

        <div
          className="flex items-start gap-2 mt-4 p-3 rounded-xl text-[11px] leading-relaxed"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: '#6B7280',
          }}
        >
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>
            При проверке файл отправляется оператору ИИ-сервиса (Moonshot AI / Kimi) для извлечения
            текста. PULSE файл не хранит — остаются только его имя и извлечённый текст. Отзыв
            согласия действует мгновенно и не влияет на уже выполненные проверки.
          </span>
        </div>
      </GlassCard>

      {/* Заглушка расширяемости вкладки (v2: экспорт данных, удаление аккаунта) */}
      <GlassCard accentColor="#6B7280">
        <div className="flex items-center gap-3">
          <Database size={18} style={{ color: '#6B7280' }} />
          <p className="text-xs text-[#6B7280]">
            Скоро здесь появятся экспорт данных и другие настройки конфиденциальности.
          </p>
        </div>
      </GlassCard>

      {/* Подтверждение отзыва согласия */}
      {confirmRevoke && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-5"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => setConfirmRevoke(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl p-6"
            style={{ background: '#111111', border: '1px solid #222' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Отозвать согласие?</h3>
            <p className="text-sm text-[#9CA3AF] mb-5 leading-relaxed">
              Новые загрузки файлов для фактчекинга станут недоступны. На уже выполненные проверки
              это не повлияет: файлы не хранятся, извлечённый текст остаётся.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmRevoke}
                disabled={busy}
                className="flex-1 h-11 rounded-xl text-[13px] font-bold transition-all hover:brightness-115 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
              >
                Отозвать
              </button>
              <button
                onClick={() => setConfirmRevoke(false)}
                className="h-11 px-5 rounded-xl text-[13px] font-semibold text-[#9CA3AF] border border-[#222] hover:border-[#3a3a3a] hover:text-white transition-colors"
              >
                Оставить
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
