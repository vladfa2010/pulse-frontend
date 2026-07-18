import { useState } from 'react'
import PlansSubTab from './PlansSubTab'
import PromoCodesSubTab from './PromoCodesSubTab'
import FeaturesSubTab from './FeaturesSubTab'

export default function TariffsTab() {
  const [subTab, setSubTab] = useState<'plans' | 'promo' | 'features'>('plans')

  return (
    <div>
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
