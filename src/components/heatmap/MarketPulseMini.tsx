import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { API_BASE } from '@/lib/api'
import { ArrowRight } from 'lucide-react'
import type { YearPayload } from './types'
import YearGrid from './YearGrid'

export default function MarketPulseMini() {
  const [data, setData] = useState<YearPayload | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`${API_BASE}/news_heatmap?scope=all&scale=year`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (data && data.meta?.empty) return null

  return (
    <section
      className="px-6 py-12 max-w-[1200px] mx-auto cursor-pointer"
      onClick={() => navigate('/activity-map?scope=all&scale=year')}
    >
      <div className="rounded-2xl p-6 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Пульс рынка</h3>
            <p className="text-xs text-text-muted">новостной фон всех тегов платформы · 12 месяцев</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-accent-primary">
            <span>Подробнее</span>
            <ArrowRight size={14} />
          </div>
        </div>

        {data ? (
          <YearGrid cells={data.cells} quantiles={data.quantiles} mini />
        ) : (
          <div className="h-16 rounded-xl bg-white/5 animate-pulse" />
        )}
      </div>
    </section>
  )
}
