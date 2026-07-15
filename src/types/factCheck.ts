export interface FactCheckSourceV4 {
  site: string
  url: string
  title: string
  date: string
  engine?: 'kimi' | 'yandex'
}

export interface AssessmentV4 {
  credibility_score: number
  credibility_label: 'Высокая' | 'Средняя' | 'Низкая' | 'Критическая'
  tone: 'нейтральная' | 'позитивная' | 'негативная' | 'манипулятивная'
  facts_verified: 'да' | 'частично' | 'нет'
  has_opinion_bias: boolean
  missing_context: string
  manipulation_risks: string
  verdict: string
}

export interface FactCheckResultV4 {
  version: 4
  analysis: string
  sources: FactCheckSourceV4[]
  assessment: AssessmentV4
  checked_at: string
  model: string
  error: string | null
}

export interface FactCheckEngineStatus {
  engine: 'kimi' | 'yandex'
  status: 'ok' | 'error'
  sources: number
  error?: string
}

// Обратная совместимость импортов в каруселях / лентах
export type FactCheckResult = FactCheckResultV4
