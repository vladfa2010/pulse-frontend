import { useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { usePortfolioSummary, PortfolioMode } from '@/hooks/usePortfolio'
import GrandTotalStrip from '@/components/portfolio/GrandTotalStrip'
import BrokerCard from '@/components/portfolio/BrokerCard'
import ConsolidatedTable from '@/components/portfolio/ConsolidatedTable'
import RecommendedTagsCloud from '@/components/portfolio/RecommendedTagsCloud'
import PortfolioFormModal from '@/components/portfolio/PortfolioFormModal'
import GlassCard from '@/components/GlassCard'
import { ArrowLeft, User, Plus } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import type { PortfolioSummaryItem } from '@/types/portfolio'

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

function SegmentSwitcher({
  value,
  onChange,
}: {
  value: PortfolioMode
  onChange: (v: PortfolioMode) => void
}) {
  return (
    <div
      className="flex gap-0.5 p-[3px] rounded-xl"
      style={{ background: '#0E0E0E', border: '1px solid #222' }}
    >
      {[
        { id: 'by-broker' as PortfolioMode, label: 'По брокерам' },
        { id: 'consolidated' as PortfolioMode, label: 'Сводный' },
      ].map(opt => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className="text-[12px] font-semibold px-4 py-[7px] rounded-lg transition-all"
            style={{
              background: active ? 'linear-gradient(135deg, #00D4FF, #0099CC)' : 'transparent',
              color: active ? '#060606' : '#6B7280',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-[110px] rounded-[20px] bg-white/5" />
      <div className="h-[260px] rounded-[20px] bg-white/5" />
      <div className="h-[160px] rounded-[20px] bg-white/5" />
    </div>
  )
}

export default function PortfolioPage() {
  const { isLoggedIn } = useAuth()
  const [mode, setMode] = useState<PortfolioMode>('by-broker')
  const [modalOpen, setModalOpen] = useState(false)
  const { data: summary, isLoading, error } = usePortfolioSummary(mode)

  if (!isLoggedIn) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center px-6">
        <GlassCard className="text-center max-w-sm">
          <User className="w-12 h-12 text-[#6B7280] mx-auto mb-4" />
          <p className="mb-4 text-[#9CA3AF]">Войдите, чтобы увидеть портфель</p>
          <Link to="/" className="text-[#00D4FF] hover:underline text-sm">На главную</Link>
        </GlassCard>
      </div>
    )
  }

  const portfolios = summary?.portfolios || []
  const positionsCount = portfolios.reduce((acc, p) => acc + p.positions.length, 0)
  const maxWeight = Math.max(
    ...portfolios.flatMap((p: PortfolioSummaryItem) => p.positions.map(pos => pos.weightPct ?? 0)),
    1
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <div
        className="pt-24 pb-8 px-6 md:px-12"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 212, 255, 0.06), transparent)',
        }}
      >
        <div className="max-w-[1200px] mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-white transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              <span>На главную</span>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutExpo }}
            className="flex items-center flex-wrap gap-4 mb-6"
          >
            <h1 className="text-2xl font-semibold tracking-tight text-white">Портфель</h1>
            <span className="text-[10px] text-[#6B7280]">
              ({portfolios.length} {portfolios.length === 1 ? 'брокер' : portfolios.length < 5 ? 'брокера' : 'брокеров'} · {positionsCount} {positionsCount === 1 ? 'позиция' : positionsCount < 5 ? 'позиции' : 'позиций'})
            </span>
            <div className="ml-auto flex items-center gap-3 flex-wrap">
              <SegmentSwitcher value={mode} onChange={setMode} />
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1 h-9 px-4 rounded-xl text-[12px] font-bold transition-all hover:brightness-115 hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
              >
                <Plus size={14} />
                Портфель
              </button>
            </div>
          </motion.div>

          {isLoading ? (
            <Skeleton />
          ) : error ? (
            <div className="text-center py-12 text-[#EF4444]">
              Не удалось загрузить портфель. Попробуйте позже.
            </div>
          ) : portfolios.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#6B7280] mb-4">Портфелей пока нет</p>
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1 h-10 px-5 rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
                style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
              >
                <Plus size={16} />
                Подключить портфель
              </button>
            </div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08, ease: easeOutExpo }}
              >
                {summary && (
                  <GrandTotalStrip
                    total={summary.grandTotal}
                    byBroker={mode === 'by-broker' ? summary.byBroker : undefined}
                  />
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.14, ease: easeOutExpo }}
              >
                {mode === 'by-broker' ? (
                  portfolios.map(p => (
                    <BrokerCard key={p.id} portfolio={p} maxWeight={maxWeight} />
                  ))
                ) : (
                  <div
                    className="rounded-[20px] mb-5 overflow-hidden"
                    style={{ background: '#0E0E0E', border: '1px solid #222' }}
                  >
                    <div className="flex items-center flex-wrap gap-3 px-6 py-[18px]">
                      <h2 className="text-[17px] font-semibold tracking-tight text-white">Сводный портфель</h2>
                      <span className="text-[10px] font-semibold text-[#6B7280] border border-[#222] rounded-full px-2 py-[3px]">
                        средневзвешенная цена по всем брокерам
                      </span>
                      <div className="flex items-baseline gap-3 ml-auto">
                        <span className="text-[20px] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {summary ? formatMoney(summary.grandTotal.marketValue) : '—'}
                        </span>
                      </div>
                    </div>
                    <ConsolidatedTable positions={summary?.portfolios?.[0]?.positions || []} />
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.22, ease: easeOutExpo }}
              >
                <RecommendedTagsCloud />
              </motion.div>
            </>
          )}
        </div>
      </div>

      <PortfolioFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
