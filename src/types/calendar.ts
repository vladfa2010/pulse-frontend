export type EventKind = 'МСФО' | 'РСБУ' | 'СД' | 'СА' | 'Дивиденды' | 'Другое'
export type EventStatus = 'confirmed' | 'expected'

export interface CalendarCompany {
  name: string
  ticker: string
  /** Источники строки компании из канона (детальный GET). */
  sources?: string[]
}

export interface CalendarEventGroup {
  title: string
  kind: EventKind
  status: EventStatus
  companies: CalendarCompany[]
}

export interface CalendarDay {
  date: string // YYYY-MM-DD
  weekday: string // 'пн'..'вс'
  groups: CalendarEventGroup[]
}

export interface CalendarResponse {
  server_date: string
  generated_at: string
  stale: boolean
  days: CalendarDay[]
}

export interface CalendarAdminEvent {
  date: string // YYYY-MM-DD
  weekday: string
  title: string
  kind: EventKind
  status: EventStatus
  companies: CalendarCompany[]
  companies_count: number
  /** Объединение источников по строкам группы (дедуп). */
  sources?: string[]
  possible_duplicate?: boolean
}

export interface CalendarSource {
  source: string
  uploaded_at: string | null
  events_count: number
  days: number
  last_stale_alert_at: string | null
  last_warnings: string[] | null
  stale: boolean
  /** Источник загружается файлами (investmint/smartlab/bcs/global). */
  feed: boolean
  /** Адаптер готов к приёму файлов (stub → false). */
  adapter_ready: boolean
}

export interface CalendarIngestParsed {
  days: number
  events: number
  no_ticker: number
  skipped: number
  date_from: string | null
  date_to: string | null
  warnings: string[]
}

export interface CalendarIngestDiff {
  new_events: number
  updated_events: number
  confirmed_upgrades: number
  confirmations: number
  removed_events: number
}

export interface CalendarIngestResponse {
  parsed: CalendarIngestParsed
  diff: CalendarIngestDiff
  samples: {
    new: string[]
    removed: string[]
    upgraded: string[]
    updated: string[]
  }
  generated_at: string | null
}

/** Ответ live-загрузки (без dry_run): канон пересобирается в фоне. */
export interface CalendarIngestLiveResponse {
  parsed: CalendarIngestParsed
  queued: true
}

/** Ответ свободной загрузки в ручной срез (manual-upload). */
export interface ManualUploadInvalidItem {
  index: number
  reason: string
}

export interface ManualUploadResponse {
  total: number
  added: number
  duplicates: number
  resurrected: number
  invalid: ManualUploadInvalidItem[]
  dry_run: boolean
}
