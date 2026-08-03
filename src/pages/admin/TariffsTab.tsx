import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { AlertTriangle } from 'lucide-react'
import PlansSubTab from './PlansSubTab'
import PromoCodesSubTab from './PromoCodesSubTab'
import FeaturesSubTab from './FeaturesSubTab'

interface FeatureDef {
  id: string
  label: string
  is_active: boolean
}

export default function TariffsTab() {
  const [subTab, setSubTab] = useState<'plans' | 'promo' | 'features'>('plans')
  const [features, setFeatures] = useState<FeatureDef[]>([])

  const loadFeatures = useCallback(async () => {
    try {
      const data = await adminApi.get('/api/admin/features')
      setFeatures(Array.isArray(data) ? data : (data.features || []))
    } catch (err) {
      console.error('TariffsTab features load error:', err)
    }
  }, [])

  useEffect(() => {
    loadFeatures()
    const interval = setInterval(loadFeatures, 60000)
    return () => clearInterval(interval)
  }, [loadFeatures])

  const telegramFeature = features.find(f => f.id === 'telegram')

  return (
    <div>
      {telegramFeature && !telegramFeature.is_active && (
        <div className="mb-4 flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
             style={{ backgroundColor: '#EF444411', border: '1px solid #EF444433', color: '#EF4444' }}>
          <AlertTriangle size={16} />
          <span>
            <strong>Telegram глобально отключён</strong> — ни один пользователь не получает TG-уведомления.
            Включите во вкладке <button onClick={() => setSubTab('features')} className="underline hover:text-red-300">Features</button>.
          </span>
        </div>
      )}
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-6 rounded-lg p-1 border" style={{ backgroundColor: '#0A0A0A', borderColor: '#222222' }}>
        <button
          onClick={() => setSubTab('plans')}
          className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all"
          style={{
            backgroundColor: subTab === 'plans' ? '#111111' : 'transparent',
            color: subTab === 'plans' ? '#FFFFFF' : '#6B7280',
            border: subTab === 'plans' ? '1px solid #222222' : '1px solid transparent',
          }}
        >
          Тарифы
        </button>
        <button
          onClick={() => setSubTab('promo')}
          className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all"
          style={{
            backgroundColor: subTab === 'promo' ? '#111111' : 'transparent',
            color: subTab === 'promo' ? '#FFFFFF' : '#6B7280',
            border: subTab === 'promo' ? '1px solid #222222' : '1px solid transparent',
          }}
        >
          Промокоды
        </button>
        <button
          onClick={() => setSubTab('features')}
          className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all"
          style={{
            backgroundColor: subTab === 'features' ? '#111111' : 'transparent',
            color: subTab === 'features' ? '#FFFFFF' : '#6B7280',
            border: subTab === 'features' ? '1px solid #222222' : '1px solid transparent',
          }}
        >
          Features
        </button>
      </div>

      {subTab === 'plans' && <PlansSubTab />}
      {subTab === 'promo' && <PromoCodesSubTab />}
      {subTab === 'features' && <FeaturesSubTab />}
    </div>
  )
}
