export interface FactCheckClaim {
  id: number
  text: string
  category: string
  search_query: string
  verdict: 'confirmed' | 'partly_true' | 'unconfirmed' | 'false'
  explanation: string
  source: string
  confidence: number
  sources?: { name: string; url: string }[]
}

export interface FactCheckSource {
  name: string
  url: string
}

export interface FactCheckResult {
  verdict: 'reliable' | 'partly_reliable' | 'unreliable' | 'unverified' | null
  claims: FactCheckClaim[]
  sources: FactCheckSource[]
  confidence: number
  checked_at: string
  model: string
  error: string | null
}
