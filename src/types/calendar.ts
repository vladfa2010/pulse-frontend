export type EventKind = 'МСФО' | 'РСБУ' | 'СД' | 'СА' | 'Дивиденды' | 'Другое'
export type EventStatus = 'confirmed' | 'expected'

export interface CalendarCompany {
  name: string
  ticker: string
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
