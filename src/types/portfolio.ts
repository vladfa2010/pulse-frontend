export type Broker = 'inside' | 'finam' | 'bcs'

export interface BrokerKey {
  id: string
  broker: Broker
  label: string
  tail: string
  status: 'ok' | 'error' | 'pending'
  lastError?: string | null
  lastSyncedAt?: string | null
  portfolioName?: string | null
}

export interface BrokerPortfolio {
  id: string
  broker: Broker
  name: string
  source: 'api' | 'manual' | 'import'
  keyTail?: string
  status?: 'ok' | 'error' | 'pending'
  brokerKeyStatus?: 'ok' | 'error' | null
  brokerKeyTail?: string | null
  lastSyncedAt?: string | null
  positionsCount: number
}

export interface BrokerPositionSource {
  broker: Broker
  quantity: number
}

export interface BrokerPosition {
  ticker: string
  companyName: string
  quantity: number
  avgPrice?: number
  currentPrice?: number
  cost?: number
  marketValue?: number
  pnl?: number
  pnlPct?: number
  weightPct?: number
  sources?: BrokerPositionSource[]
}

export interface PortfolioTotals {
  cost: number
  marketValue: number
  pnl: number
  pnlPct: number
}

export interface PortfolioSummaryItem extends BrokerPortfolio {
  positions: BrokerPosition[]
  totals: PortfolioTotals
}

export interface PortfolioSummary {
  mode: 'by-broker' | 'consolidated'
  portfolios: PortfolioSummaryItem[]
  grandTotal: PortfolioTotals
  byBroker?: Record<Broker, PortfolioTotals>
}

export type RecommendedTagStatus = 'available' | 'subscribed' | 'created-new' | 'limit-reached'

export interface RecommendedTag {
  ticker: string
  exchange: string
  companyName: string
  suggestedTag: string
  status: RecommendedTagStatus
  existingTagId?: string | null
  weightPct: number
}

export interface TagLimit {
  used: number
  limit: number
}

export interface RecommendedTagsResponse {
  tags: RecommendedTag[]
  tagLimit: TagLimit
}

export const BROKER_META: Record<Broker, { label: string; color: string; hint: string }> = {
  inside: {
    label: 'Инсайд брокер',
    color: '#00D4FF',
    hint: 'Инсайд брокер: ЛК → Профиль → API → выпустить токен',
  },
  finam: {
    label: 'Финам',
    color: '#60A5FA',
    hint: 'Финам: портал tradeapi.finam.ru → раздел «Токены» → создать токен с доступом «Просмотр»',
  },
  bcs: {
    label: 'БКС',
    color: '#FBBF24',
    hint: 'БКС: веб «Мир инвестиций» → Профиль → счёт → «Токены API» → «Только для чтения»',
  },
}

export const BROKER_ORDER: Broker[] = ['inside', 'finam', 'bcs']
