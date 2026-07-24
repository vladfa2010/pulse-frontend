import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { Lock, X } from 'lucide-react'

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface TagStatus {
  current_plan: string
  plan_name: string
  tag_limit: number
  total_tags: number
  active_tags: number
  frozen_tags: number
  to_remove: number
  tags: Array<{
    id: string
    tag_id: string
    name: string
    tag_type: string
    is_frozen: boolean
    news_count_30d: number
  }>
}

export default function FreezeTagsBanner() {
  const { isLoggedIn, removeTag, loadPortfolio } = useAuth()
  const [status, setStatus] = useState<TagStatus | null>(null)
  const [closed, setClosed] = useState(() => {
    const raw = localStorage.getItem('freezeBannerClosed')
    if (!raw) return false
    return Date.now() - parseInt(raw, 10) < 24 * 60 * 60 * 1000
  })
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.get('/user/tag-status')
      setStatus(data as TagStatus)
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return
    loadStatus()
  }, [isLoggedIn, loadStatus])

  const handleClose = useCallback(() => {
    localStorage.setItem('freezeBannerClosed', String(Date.now()))
    setClosed(true)
  }, [])

  const handleDelete = useCallback(async (tagId: string) => {
    setDeletingTagId(tagId)
    const ok = await removeTag(tagId)
    setDeletingTagId(null)
    if (ok) {
      await loadStatus()
    } else {
      alert('Не удалось удалить тег')
    }
  }, [removeTag, loadStatus])

  const handleSave = useCallback(async () => {
    if (!status || status.to_remove > 0) return
    setSaving(true)
    try {
      const keepIds = status.tags.map((t) => t.id)
      await api.post('/user/select-active-tags', { activeTagIds: keepIds })
      await loadPortfolio()
      handleClose()
    } catch (err: any) {
      alert(err.message || 'Не удалось сохранить активные теги')
    } finally {
      setSaving(false)
    }
  }, [status, handleClose, loadPortfolio])

  const shouldShow = useMemo(() => {
    if (!isLoggedIn || !status || closed) return false
    if (status.tag_limit < 0) return false
    return status.to_remove > 0 || status.frozen_tags > 0
  }, [isLoggedIn, status, closed])

  if (!shouldShow || !status) return null

  const { plan_name, tag_limit, active_tags, frozen_tags, to_remove, tags } = status
  const hasFrozen = frozen_tags > 0
  const tagWord = (n: number) =>
    n === 1 ? 'тег' : n < 5 ? 'тега' : 'тегов'

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
                {hasFrozen ? 'Теги заморожены — удалите лишние' : 'У вас слишком много тегов для тарифа'}
              </h3>
              <p className="text-sm text-[#9CA3AF] mt-1">
                Тариф: {plan_name || status.current_plan} (лимит {tag_limit} {tagWord(tag_limit)})
                {to_remove > 0
                  ? `. У вас ${active_tags} ${tagWord(active_tags)} — удалите ещё ${to_remove}, останется ${tag_limit}.`
                  : `. У вас ${active_tags} активных ${tagWord(active_tags)}.`}
              </p>
              {frozen_tags > 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  {frozen_tags} {tagWord(frozen_tags)} заморожено — восстановите Premium в профиле, чтобы разморозить.
                </p>
              )}
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
            {tags.map((tag) => {
              const isDeleting = deletingTagId === tag.tag_id
              return (
                <motion.div
                  key={tag.id}
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
                    <span className="text-sm font-semibold text-[#c9d1d9]">{tag.name}</span>
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
                    <strong className="text-[#00D4FF]">{(tag.news_count_30d ?? 0).toLocaleString('ru-RU')}</strong> новостей за 30 дней
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        <button
          onClick={handleSave}
          disabled={to_remove > 0 || saving}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold transition-all hover:brightness-115 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: to_remove > 0 ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #00D4FF, #0099CC)',
            color: to_remove > 0 ? '#9CA3AF' : '#060606',
          }}
        >
          {saving ? (
            <span className="animate-pulse">Сохраняем...</span>
          ) : to_remove > 0 ? (
            `Удалите ещё ${to_remove} ${tagWord(to_remove)}`
          ) : (
            `Сохранить ${active_tags} ${tagWord(active_tags)}`
          )}
        </button>
      </motion.div>
    </section>
  )
}
