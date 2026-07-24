import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { Lock, X } from 'lucide-react'

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface TariffData {
  subscription: {
    plan: string
    active: boolean
    daysLeft: number
    inGracePeriod: boolean
    autoRenew: boolean
  }
  plan: {
    id: string
    name: string
    tagLimit: number
  }
  tagUsage: {
    active: number
    frozen: number
    limit: number
  }
}

export default function FreezeTagsBanner() {
  const { isLoggedIn, portfolio, removeTag } = useAuth()
  const [tariff, setTariff] = useState<TariffData | null>(null)
  const [closed, setClosed] = useState(() => {
    const raw = localStorage.getItem('freezeBannerClosed')
    if (!raw) return false
    return Date.now() - parseInt(raw, 10) < 24 * 60 * 60 * 1000
  })
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoggedIn) return
    api.get('/user/tariff-status')
      .then(data => setTariff(data))
      .catch(() => setTariff(null))
  }, [isLoggedIn])

  const handleClose = () => {
    localStorage.setItem('freezeBannerClosed', String(Date.now()))
    setClosed(true)
  }

  const handleDelete = async (tagId: string) => {
    setDeletingTagId(tagId)
    const ok = await removeTag(tagId)
    setDeletingTagId(null)
    if (!ok) alert('Не удалось удалить тег')
  }

  const shouldShow = useMemo(() => {
    if (!isLoggedIn || !tariff || closed) return false
    const freeLimit = tariff.tagUsage.limit < 0 ? 3 : tariff.tagUsage.limit
    const hasFrozen = tariff.tagUsage.frozen > 0
    const activeOverLimit = tariff.tagUsage.active > freeLimit
    return (hasFrozen || activeOverLimit) && (!tariff.subscription.active || tariff.subscription.plan === 'free')
  }, [isLoggedIn, tariff, closed])

  if (!shouldShow) return null

  const freeLimit = tariff!.tagUsage.limit < 0 ? 3 : tariff!.tagUsage.limit
  const excess = Math.max(0, tariff!.tagUsage.active - freeLimit)
  const tagsToShow = portfolio.filter(t => !t.is_frozen)
  const hasFrozen = tariff!.tagUsage.frozen > 0

  return (
    <section className="px-6 pt-6 max-w-[1200px] mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="rounded-2xl p-5 md:p-6 relative overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(12px) saturate(180%)',
          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)' }}
            >
              <Lock size={18} style={{ color: '#EF4444' }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {hasFrozen ? 'Теги заморожены — удалите лишние' : 'У вас слишком много тегов для Free'}
              </h3>
              <p className="text-sm text-[#9CA3AF] mt-1">
                У вас {tariff!.tagUsage.active} {tariff!.tagUsage.active === 1 ? 'тег' : tariff!.tagUsage.active < 5 ? 'тега' : 'тегов'} — {excess > 0 ? `удалите ещё ${excess}, останется ${freeLimit}` : `осталось ${freeLimit} бесплатных`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-[#6B7280] hover:text-white transition-colors p-1"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          <AnimatePresence>
            {tagsToShow.map(tag => {
              const isDeleting = deletingTagId === tag.tag_id
              return (
                <motion.div
                  key={tag.tag_id}
                  layout
                  initial={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.25, ease: easeOutExpo }}
                  className={`flex flex-col gap-1 px-3 py-2 rounded-xl min-w-[110px] ${isDeleting ? 'pointer-events-none opacity-60' : ''}`}
                  style={{
                    background: 'linear-gradient(180deg, #0f1923 0%, #0a111a 100%)',
                    border: '1px solid #1a2744',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#c9d1d9]">{tag.tag_name}</span>
                    <button
                      onClick={() => handleDelete(tag.tag_id)}
                      disabled={isDeleting}
                      className="text-[#30363d] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.15)] rounded transition-all p-0.5"
                      title="Удалить тег — данные будут потеряны"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <span className="text-[11px] text-[#6B7280]">
                    <strong className="text-[#00D4FF]">{(tag.news_per_month ?? 0).toLocaleString('ru-RU')}</strong> новостей за 30 дней
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        <button
          onClick={handleClose}
          disabled={excess > 0}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold transition-all hover:brightness-115 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: excess > 0 ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #00D4FF, #0099CC)',
            color: excess > 0 ? '#9CA3AF' : '#060606',
          }}
        >
          {excess > 0 ? `Удалите ещё ${excess} ${excess === 1 ? 'тег' : excess < 5 ? 'тега' : 'тегов'}` : 'Готово'}
        </button>
      </motion.div>
    </section>
  )
}
