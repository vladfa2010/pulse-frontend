import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import { X, Loader2 } from 'lucide-react'

interface PromoStats {
  promo: {
    id: string
    code: string
    discount_type: string
    discount_value: number
  }
  total_uses: number
  unique_users: number
  revenue_impact: number
  trial_conversions: number
  recent_uses: { user_email: string; plan_id: string; created_at: string }[]
}

interface PromoStatsModalProps {
  promoId: string
  onClose: () => void
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function PromoStatsModal({ promoId, onClose }: PromoStatsModalProps) {
  const [stats, setStats] = useState<PromoStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    adminApi.get(`/api/admin/promo-codes/${promoId}/stats`)
      .then(data => {
        setStats(data)
        setError(null)
      })
      .catch((err: any) => setError(err.message || 'Ошибка загрузки статистики'))
      .finally(() => setLoading(false))
  }, [promoId])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border" style={{ backgroundColor: '#111111', borderColor: '#222222' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#222222' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
            Статистика промокода {stats?.promo?.code || ''}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#222222]" style={{ color: '#6B7280' }}><X size={18} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin mr-2" style={{ color: '#60A5FA' }} />
            <span className="text-sm" style={{ color: '#9CA3AF' }}>Загрузка...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>
          </div>
        ) : stats ? (
          <div className="p-5 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
                <p className="text-xs" style={{ color: '#6B7280' }}>Всего использований</p>
                <p className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{stats.total_uses}</p>
              </div>
              <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
                <p className="text-xs" style={{ color: '#6B7280' }}>Уникальных пользователей</p>
                <p className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{stats.unique_users}</p>
              </div>
              <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
                <p className="text-xs" style={{ color: '#6B7280' }}>Потерянная выручка</p>
                <p className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{stats.revenue_impact.toLocaleString('ru-RU')} ₽</p>
              </div>
              <div className="rounded-lg border p-3" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
                <p className="text-xs" style={{ color: '#6B7280' }}>Конверсий trial</p>
                <p className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{stats.trial_conversions}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6B7280' }}>Последние использования</h4>
              <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: '#111111' }}>
                      <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#6B7280' }}>Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#6B7280' }}>Тариф</th>
                      <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#6B7280' }}>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.recent_uses || []).length === 0 && (
                      <tr><td colSpan={3} className="px-3 py-4 text-center text-xs" style={{ color: '#6B7280' }}>Нет данных</td></tr>
                    )}
                    {(stats.recent_uses || []).map((use, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid #1a1a1a' }}>
                        <td className="px-3 py-2 text-sm" style={{ color: '#FFFFFF' }}>{use.user_email}</td>
                        <td className="px-3 py-2 text-sm" style={{ color: '#9CA3AF' }}>{use.plan_id}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: '#6B7280' }}>{formatDate(use.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
