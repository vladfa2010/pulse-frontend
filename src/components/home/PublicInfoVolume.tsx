import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import GlassCard from '@/components/GlassCard'

/**
 * Блок «Объём информации» для гостевой главной (ТЗ-56).
 * Данные — эталонный аккаунт (GET /api/public/efficiency, кэш 60 с на бэке).
 * Вёрстка 1:1 с Profile.tsx; подзаголовок адаптирован под гостевой контекст.
 * Эндпоинт недоступен → блок молча не рендерится.
 */

interface EfficiencyStats {
  total_news: number
  total_news_24h: number
  personal_news: number
  personal_news_24h: number
  user_tags_count: number
  cached_at: string
}

export default function PublicInfoVolume() {
  const [stats, setStats] = useState<EfficiencyStats | null>(null)

  useEffect(() => {
    api.get('/public/efficiency')
      .then((r: any) => setStats(r))
      .catch(() => setStats(null)) // молча скрываем блок
  }, [])

  if (!stats) return null

  return (
    <section className="px-6 pt-4 pb-8 max-w-[1200px] mx-auto w-full">
      <GlassCard accentColor="#10B981">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)' }}
          >
            <Sparkles size={18} style={{ color: '#10B981' }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Объём информации</h2>
            <p className="text-xs text-[#6B7280]">Живые данные эталонной подборки, обновляются каждую минуту</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Total news */}
          <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-3xl font-bold text-white" style={{ fontSize: 'clamp(28px, 5vw, 36px)' }}>
              {(stats?.total_news ?? 0).toLocaleString('ru-RU')}
            </div>
            <div className="text-xs text-[#6B7280] mt-1">новостей в базе</div>
          </div>

          {/* Personal news */}
          <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
            <div className="text-3xl font-bold" style={{ color: '#10B981', fontSize: 'clamp(28px, 5vw, 36px)' }}>
              {(stats?.personal_news ?? 0).toLocaleString('ru-RU')}
            </div>
            <div className="text-xs text-[#6B7280] mt-1">по вашим тегам</div>
          </div>

          {/* 24h total */}
          <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-2xl font-semibold text-white">
              +{(stats?.total_news_24h ?? 0).toLocaleString('ru-RU')}
            </div>
            <div className="text-xs text-[#6B7280] mt-1">за 24 часа</div>
          </div>

          {/* 24h personal */}
          <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
            <div className="text-2xl font-semibold" style={{ color: '#10B981' }}>
              +{(stats?.personal_news_24h ?? 0).toLocaleString('ru-RU')}
            </div>
            <div className="text-xs text-[#6B7280] mt-1">по тегам за 24ч</div>
          </div>
        </div>
      </GlassCard>
    </section>
  )
}
