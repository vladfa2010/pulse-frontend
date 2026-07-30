import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRecommendedTags, usePortfolioMutations } from '@/hooks/usePortfolio'
import { Check, Lock } from 'lucide-react'
import type { RecommendedTag, RecommendedTagStatus } from '@/types/portfolio'

function tagSizeClass(weight: number): string {
  if (weight >= 25) return 'text-[18px] h-12 px-6 font-semibold'
  if (weight >= 15) return 'text-[16px] h-[42px] px-5'
  if (weight >= 8) return 'text-[14px] h-9 px-4'
  return 'text-[13px] h-8 px-4'
}

export default function RecommendedTagsCloud() {
  const { isLoggedIn } = useAuth()
  const { data, isLoading } = useRecommendedTags()
  const { subscribeRecommendedTag } = usePortfolioMutations()
  const [optimistic, setOptimistic] = useState<Record<string, RecommendedTagStatus>>({})

  const tags = data?.tags || []
  const tagLimit = data?.tagLimit || { used: 0, limit: 0 }

  const visible = useMemo(() => {
    return tags.map(t => ({
      ...t,
      status: optimistic[t.ticker] ?? t.status,
    }))
  }, [tags, optimistic])

  const used = tagLimit.used
  const limit = tagLimit.limit
  const nearLimit = limit > 0 && used >= limit - 1

  if (!isLoggedIn) return null

  if (isLoading) {
    return (
      <div className="mt-10">
        <div className="h-6 w-48 rounded bg-white/5 animate-pulse mb-4" />
        <div className="h-32 rounded-[20px] bg-white/5 animate-pulse" />
      </div>
    )
  }

  if (!visible || visible.length === 0) {
    return (
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-2xl font-semibold text-[#00D4FF]">Рекомендуемые теги</h2>
        </div>
        <p className="text-xs text-[#6B7280] mb-5">Собраны автоматически из состава вашего портфеля.</p>
        <div className="rounded-[20px] px-6 py-8 text-center text-[13px] text-[#6B7280] glass">
          Теги появятся, когда в портфеле будут позиции
        </div>
      </div>
    )
  }

  const handleClick = (t: RecommendedTag) => {
    if (t.status === 'subscribed' || t.status === 'created-new' || t.status === 'limit-reached') return
    setOptimistic(prev => ({ ...prev, [t.ticker]: 'subscribed' }))
    subscribeRecommendedTag.mutate({ ticker: t.ticker, exchange: 'MOEX' })
  }

  return (
    <section className="mt-10">
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <h2 className="text-2xl font-semibold text-[#00D4FF]">Рекомендуемые теги</h2>
        <span
          className="text-[11px] font-bold px-3 py-1 rounded-full"
          style={{
            fontVariantNumeric: 'tabular-nums',
            color: nearLimit ? '#F59E0B' : '#00D4FF',
            background: nearLimit ? 'rgba(245,158,11,0.1)' : 'rgba(0,212,255,0.1)',
            border: `1px solid ${nearLimit ? 'rgba(245,158,11,0.25)' : 'rgba(0,212,255,0.2)'}`,
          }}
        >
          {used}/{limit}
        </span>
      </div>
      <p className="text-xs text-[#6B7280] mb-5">
        Собраны автоматически из состава вашего портфеля.{' '}
        <span className="text-[#9CA3AF] font-semibold">Клик = подписаться</span> — новости по бумаге сразу попадут в ленту и саммари.
      </p>

      <div
        className="rounded-[20px] px-7 py-8 flex flex-wrap items-center justify-center gap-3 relative overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div
          className="absolute top-0 left-7 right-7 h-px opacity-60"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.7), transparent)' }}
        />

        {visible.map(t => {
          const isSub = t.status === 'subscribed' || t.status === 'created-new'
          const isLock = t.status === 'limit-reached'
          return (
            <button
              key={t.ticker}
              onClick={() => handleClick(t)}
              disabled={isSub || isLock || subscribeRecommendedTag.isPending}
              className={`
                inline-flex items-center gap-2 rounded-full select-none transition-all
                ${tagSizeClass(t.weightPct)}
                ${isSub
                  ? 'cursor-default'
                  : isLock
                    ? 'opacity-40 cursor-not-allowed border-dashed'
                    : 'hover:-translate-y-0.5 hover:shadow-[0_6px_22px_-6px_rgba(0,212,255,0.25)]'
                }
              `}
              style={{
                background: isSub ? 'rgba(0,212,255,0.12)' : '#161616',
                border: isSub
                  ? '1px solid rgba(0,212,255,0.55)'
                  : isLock
                    ? '1px dashed rgba(0,212,255,0.25)'
                    : '1px solid rgba(0,212,255,0.25)',
                boxShadow: isSub ? '0 0 18px -4px rgba(0,212,255,0.4)' : undefined,
              }}
              title={isLock ? 'Лимит тегов тарифа исчерпан' : isSub ? 'Подписаны' : 'Подписаться на новости'}
            >
              <span className="w-2 h-2 rounded-full bg-[#00D4FF]" />
              <span className="text-white">#{t.suggestedTag}</span>
              <span className="text-[#6B7280] text-[0.72em] font-normal">{t.companyName}</span>
              {isSub && <Check size={14} className="text-[#00D4FF]" />}
              {isLock && <Lock size={14} className="text-[#6B7280]" />}
            </button>
          )
        })}

        <div className="w-full text-center mt-4 text-[11px] text-[#6B7280]">
          Размер тега = вес бумаги в портфеле · <span className="text-[#00D4FF]">✓ подписан</span> ·{' '}
          <Lock size={10} className="inline align-text-bottom" /> лимит тарифа
        </div>
      </div>
    </section>
  )
}
