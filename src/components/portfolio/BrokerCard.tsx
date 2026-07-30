import { formatMoney, formatPercent } from '@/lib/format'
import { BROKER_META, type Broker, type PortfolioSummaryItem } from '@/types/portfolio'
import PositionsTable from './PositionsTable'

export default function BrokerCard({ portfolio, maxWeight }: { portfolio: PortfolioSummaryItem; maxWeight?: number }) {
  const meta = BROKER_META[portfolio.broker as Broker] ?? BROKER_META.finam
  const up = portfolio.totals.pnl >= 0

  return (
    <div
      className="rounded-[20px] mb-5 relative overflow-hidden transition-colors hover:border-[#2e2e2e]"
      style={{ background: '#0E0E0E', border: '1px solid #222' }}
    >
      <div
        className="absolute top-0 left-6 right-6 h-px opacity-[0.55]"
        style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }}
      />

      <div className="flex items-center flex-wrap gap-3 px-6 py-[18px]">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: meta.color, boxShadow: `0 0 12px ${meta.color}66` }}
        />
        <h2 className="text-[17px] font-semibold tracking-tight text-white">{portfolio.name}</h2>
        <span
          className="text-[10px] font-semibold text-[#6B7280] border border-[#222] rounded-full px-2 py-[3px]"
        >
          API · только чтение · синхр. {portfolio.lastSyncedAt ? formatTime(portfolio.lastSyncedAt) : '—'}
        </span>
        <div className="flex items-baseline gap-3 ml-auto">
          <span className="text-[20px] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatMoney(portfolio.totals.marketValue)}
          </span>
          <span
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-bold"
            style={{
              fontVariantNumeric: 'tabular-nums',
              color: up ? '#34D399' : '#EF4444',
              background: up ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.10)',
              border: `1px solid ${up ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.22)'}`,
            }}
          >
            {up ? '▲' : '▼'} {formatMoney(Math.abs(portfolio.totals.pnl))} · {formatPercent(portfolio.totals.pnlPct)}
          </span>
        </div>
      </div>

      <PositionsTable positions={portfolio.positions} maxWeight={maxWeight} />
    </div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
