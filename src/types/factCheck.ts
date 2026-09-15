export interface FactCheckSourceV4 {
  site: string
  url: string
  title: string
  date: string
  engine?: 'kimi' | 'yandex_ru' | 'yandex_com' | 'serper_ru' | 'serper_en' | 'yandex'
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
  // Слой 3 валидации: можно ли вообще проверять утверждение.
  // У результатов до введения поля — undefined → трактуем как true.
  verifiable?: boolean
}

export interface FactCheckEngineStatus {
  engine: 'kimi' | 'yandex_ru' | 'yandex_com' | 'serper_ru' | 'serper_en' | 'yandex'
  status: 'ok' | 'error'
  sources: number
  error?: string
}

export interface FactCheckResultV4 {
  version: 4
  analysis: string
  sources: FactCheckSourceV4[]
  assessment: AssessmentV4
  engines?: FactCheckEngineStatus[]
  checked_at: string
  model: string
  error: string | null
}

// Обратная совместимость импортов в каруселях / лентах
export type FactCheckResult = FactCheckResultV4

// ─── Ad-hoc фактчекинг (страница /factcheck) ───────────────────────────────

export type FactCheckInputType = 'text' | 'url' | 'image' | 'file'

export type FactCheckRequestStatus = 'queued' | 'in_progress' | 'checked' | 'failed'

// Ad-hoc проверка пользователя (fact_check_requests)
export interface FactCheckRequestItem {
  id: string
  input_type: FactCheckInputType
  input_raw?: string | null
  title: string
  extracted_text?: string | null
  status: FactCheckRequestStatus
  result?: FactCheckResultV4 | null
  error_message?: string | null
  reused?: boolean
  created_at: string
  updated_at?: string
}

// Проверенная новость PULSE в общей ленте (kind: 'news')
export interface FactCheckFeedItem {
  kind: 'news'
  id: string
  title: string
  snippet?: string
  url?: string
  status: string
  result?: FactCheckResultV4 | null
  created_at: string
}

// Нормализованная карточка для каруселей и модалки
export interface FactCheckListItem {
  id: string
  kind: 'request' | 'news'
  input_type?: FactCheckInputType
  title: string
  snippet?: string
  url?: string
  extracted_text?: string | null
  status: FactCheckRequestStatus | string
  result?: FactCheckResultV4 | null
  created_at: string
}
