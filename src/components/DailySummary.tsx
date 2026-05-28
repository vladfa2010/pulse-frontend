import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, FileText, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

/* =============================================================================
   DailySummary — AI саммари новостей по тегам пользователя за последние 12ч
   ============================================================================= */

interface SummaryData {
  summary: string
  cached: boolean
  generated_at: string
  articles_count: number
}

export default function DailySummary() {
  const { isLoggedIn } = useAuth()
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchSummary = useCallback(async (refresh = false) => {
    if (!isLoggedIn) return
    setLoading(true)
    setError('')
    try {
      const params = refresh ? '?refresh=1' : ''
      const result = await api.get(`/user/summary${params}`)
      setData(result)
    } catch (err: any) {
      setError('Не удалось загрузить саммари')
      console.error('[DailySummary]', err)
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (isLoggedIn) fetchSummary()
  }, [isLoggedIn, fetchSummary])

  if (!isLoggedIn) return null

  return (
    <section className="px-6 md:px-12 pb-10 max-w-[1200px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(52, 211, 153, 0.1))',
                border: '1px solid rgba(0, 212, 255, 0.2)',
              }}
            >
              <Sparkles size={16} style={{ color: '#00D4FF' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Дайджест
              </h2>
              <p className="text-xs text-[#6B7280]">
                {data?.generated_at
                  ? `Обновлено ${new Date(data.generated_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
                  : 'AI-аналитика по вашим активам'}
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchSummary(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:brightness-110 disabled:opacity-40"
            style={{
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.15)',
              color: '#00D4FF',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>

        {/* ── Card ── */}
        <div
          className="rounded-2xl p-6 md:p-8 relative overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(12px) saturate(180%)',
            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {/* Subtle gradient glow */}
          <div
            className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(0, 212, 255, 0.3), transparent)',
            }}
          />

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <SkeletonLine width="100%" />
                <SkeletonLine width="92%" />
                <SkeletonLine width="85%" />
                <SkeletonLine width="60%" />
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 text-[#EF4444] text-sm"
              >
                <FileText size={18} />
                {error}
              </motion.div>
            ) : data?.summary ? (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <p className="text-[#D1D5DB] text-[15px] leading-[1.75] whitespace-pre-wrap">
                  {data.summary}
                </p>
                {data.articles_count > 0 && (
                  <p className="text-xs text-[#4B5563] mt-4">
                    Основано на {data.articles_count} новостях за последние 12 часов
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-[#6B7280]"
              >
                Нет данных для саммари. Добавьте теги в профиле, чтобы получать персональную аналитику.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </section>
  )
}

/* ── Skeleton loader ── */
function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      className="h-4 rounded animate-pulse"
      style={{
        width,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
      }}
    />
  )
}
