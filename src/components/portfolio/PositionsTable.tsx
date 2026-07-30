import { formatMoney, formatPercent, sign } from '@/lib/format'
import { formatDecimal } from '@/lib/format'
import type { BrokerPosition } from '@/types/portfolio'

export default function PositionsTable({ positions, maxWeight }: { positions: BrokerPosition[]; maxWeight?: number }) {
  if (positions.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-[13px] text-[#6B7280]">
        Позиций пока нет — они появятся после синхронизации с брокером
      </div>
    )
  }

  const max = maxWeight ?? Math.max(...positions.map(p => p.weightPct ?? 0), 1)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[760px]">
        <thead>
          <tr>
            {['Тикер', 'Компания', 'Кол-во', 'Средняя', 'Текущая', 'Стоимость', 'P&L', 'Вес'].map((h, i) => (
              <th
                key={h}
                className={`text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6B7280] text-right py-2.5 px-6 border-t border-white/[0.06] ${i < 2 ? 'text-left' : ''}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map(p => {
            const up = (p.pnl ?? 0) >= 0
            const weight = p.weightPct ?? 0
            const barWidth = max ? (weight / max) * 100 : 0
            return (
              <tr
                key={p.ticker}
                className="transition-colors hover:bg-white/[0.025]"
              >
                <td className="py-3 px-6 text-left text-[13px] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <span className="text-[#00D4FF]">$</span>{p.ticker}
                </td>
                <td className="py-3 px-6 text-left text-[12px] text-[#9CA3AF]">{p.companyName}</td>
                <td className="py-3 px-6 text-right text-[13px] text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatDecimal(p.quantity, 0)}
                </td>
                <td className="py-3 px-6 text-right text-[13px] text-[#6B7280]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {p.avgPrice ? formatMoney(p.avgPrice) : '—'}
                </td>
                <td className="py-3 px-6 text-right text-[13px] text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {p.currentPrice ? formatMoney(p.currentPrice) : '—'}
                </td>
                <td className="py-3 px-6 text-right text-[13px] text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {p.marketValue ? formatMoney(p.marketValue) : '—'}
                </td>
                <td
                  className={`py-3 px-6 text-right text-[13px] font-semibold ${up ? 'text-[#34D399]' : 'text-[#EF4444]'}`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {sign(p.pnl ?? 0)} {formatMoney(Math.abs(p.pnl ?? 0))} · {formatPercent(p.pnlPct ?? 0)}
                </td>
                <td className="py-3 px-6 text-right text-[13px] text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <span className="inline-block w-[46px] h-1 rounded-[3px] bg-white/[0.07] mr-2 align-middle overflow-hidden">
                    <span
                      className="block h-full rounded-[3px]"
                      style={{ width: `${Math.min(100, barWidth)}%`, background: 'linear-gradient(90deg, #00D4FF, #0099CC)' }}
                    />
                  </span>
                  {formatPercent(weight).replace(/[+%]/g, '')}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
