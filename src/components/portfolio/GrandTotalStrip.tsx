import { formatMoney, formatPercent, sign } from '@/lib/format'
import type { PortfolioTotals } from '@/types/portfolio'

export default function GrandTotalStrip({
  total,
  byBroker,
}: {
  total: PortfolioTotals
  byBroker?: Record<string, PortfolioTotals>
}) {
  const up = total.pnl >= 0

  return (
    <div
      className="rounded-[20px] px-6 py-[18px] mb-6 flex items-center flex-wrap gap-7 relative overflow-hidden"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <div
        className="absolute top-0 left-6 right-6 h-px opacity-70"
        style={{ background: 'linear-gradient(90deg, transparent, #00D4FF, transparent)' }}
      />

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-1">
          Общая стоимость
        </div>
        <div className="text-[26px] font-bold tracking-tight text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatMoney(total.marketValue)}
        </div>
        <div className="text-xs text-[#9CA3AF]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          вложено {formatMoney(total.cost)}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-1">
          Прибыль
        </div>
        <div
          className={`text-[26px] font-bold tracking-tight ${up ? 'text-[#34D399]' : 'text-[#EF4444]'}`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {sign(total.pnl)} {formatMoney(Math.abs(total.pnl))}
        </div>
        <div className="text-xs text-[#9CA3AF]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <span className={up ? 'text-[#34D399]' : 'text-[#EF4444]'}>{formatPercent(total.pnlPct)}</span> за всё время
        </div>
      </div>

      {byBroker && Object.keys(byBroker).length > 0 && (
        <div className="hidden md:flex items-center gap-6 ml-auto">
          {Object.entries(byBroker).map(([broker, b]) => {
            const bUp = b.pnl >= 0
            return (
              <div key={broker}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] mb-1">
                  {broker}
                </div>
                <div className="text-xs text-white font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(b.marketValue)} ·{' '}
                  <span className={bUp ? 'text-[#34D399]' : 'text-[#EF4444]'}>{formatPercent(b.pnlPct)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
