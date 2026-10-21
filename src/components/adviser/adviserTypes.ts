/**
 * ТЗ-182 v15 — модуль клиентских портфелей (advisor).
 * Типы и защитные парсеры ответов /api/advisor/*.
 * Бэкенд реализуется параллельно по тому же ТЗ — парсеры терпимы
 * к расхождениям формы (объект/массив, вложенность, null-поля).
 */

export interface AdvisorClientTag {
  id: number
  tag_id: string | null
  tag_name: string
  tag_type: string | null
}

export interface AdvisorClient {
  id: number
  name: string
  notes: string | null
  is_archived: boolean
  sort_order: number
  active_tags: number
}

export interface AdvisorSummaryEntry {
  client_id: number
  summary: string | null
  articles_count: number
  sentiment_mix: { pos: number; neg: number; neu: number } | null
  /** имена тегов на момент генерации (для чипов карточки) */
  tags_snapshot: { name: string; type: string | null }[] | null
  generated_at: string | null
}

export interface AdvisorSchedule {
  slots: number[]
  last_run_at: string | null
  next_run_at: string | null
}

export interface AdvisorEventItem {
  id: string
  date: string
  title: string
  tag_name: string | null
}

export interface AdvisorEventGroup {
  client_id: number
  name: string
  events: AdvisorEventItem[]
}

/** Разрешённый набор часов слотов (МСК), ТЗ-182 Задача 6 */
export const ALLOWED_SLOTS = [6, 7, 8, 9, 10, 13, 17, 18, 19, 20, 21] as const

/**
 * Статичный список «менее загруженных» часов — зелёная точка в модале
 * расписания. Динамический расчёт по реальному распределению — backlog (ТЗ-182 §6).
 */
export const LIGHT_SLOTS: readonly number[] = [6, 7, 18, 21]

/** Цвета чипов по типу тега — DESIGN_SPEC (прецедент WeeklyReportPage/ActivityMap) */
export const TAG_TYPE_COLORS: Record<string, string> = {
  company: '#00D4FF',
  sector: '#A78BFA',
  person: '#FBBF24',
  trend: '#34D399',
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

function parseClient(raw: any): AdvisorClient | null {
  if (!raw || typeof raw !== 'object') return null
  const id = num(raw.id)
  if (!id) return null
  return {
    id,
    name: String(raw.name ?? `Клиент #${id}`),
    notes: str(raw.notes),
    is_archived: raw.is_archived === true || raw.is_archived === 1,
    sort_order: num(raw.sort_order),
    active_tags: num(raw.active_tags ?? raw.tags_count),
  }
}

/**
 * GET /api/advisor/clients → массив клиентов.
 * Терпим и к форме { clients: [...], limit: N }: лимит тогда берём из ответа.
 */
export function parseClientsResponse(data: any): { clients: AdvisorClient[]; limit: number | null } {
  if (Array.isArray(data)) {
    return { clients: data.map((c: any) => parseClient(c)).filter((c: AdvisorClient | null): c is AdvisorClient => c !== null), limit: null }
  }
  const list = Array.isArray(data?.clients) ? data.clients : []
  const limit = typeof data?.limit === 'number' && Number.isFinite(data.limit) ? data.limit : null
  return { clients: list.map((c: any) => parseClient(c)).filter((c: AdvisorClient | null): c is AdvisorClient => c !== null), limit }
}

function parseTagSnapshot(raw: any): { name: string; type: string | null }[] | null {
  if (!Array.isArray(raw)) return null
  const out = raw
    .map((t: any) => {
      if (typeof t === 'string') return { name: t, type: null }
      if (t && typeof t === 'object') {
        const name = str(t.tag_name) ?? str(t.name)
        return name ? { name, type: str(t.tag_type) ?? str(t.type) } : null
      }
      return null
    })
    .filter((t): t is { name: string; type: string | null } => t !== null)
  return out.length ? out : null
}

function parseSummaryEntry(raw: any): AdvisorSummaryEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const clientId = num(raw.client_id ?? raw.id)
  if (!clientId) return null
  const mix = raw.sentiment_mix && typeof raw.sentiment_mix === 'object' ? raw.sentiment_mix : null
  return {
    client_id: clientId,
    summary: str(raw.summary),
    articles_count: num(raw.articles_count),
    sentiment_mix: mix
      ? { pos: num(mix.pos), neg: num(mix.neg), neu: num(mix.neu) }
      : null,
    tags_snapshot: parseTagSnapshot(raw.tags_snapshot),
    generated_at: str(raw.generated_at),
  }
}

/** GET /api/advisor/summaries?hours=12 → { clients: [...], schedule } */
export function parseSummariesResponse(data: any): {
  clients: AdvisorSummaryEntry[]
  schedule: AdvisorSchedule | null
} {
  const list = Array.isArray(data?.clients) ? data.clients : Array.isArray(data) ? data : []
  const s = data?.schedule
  const schedule: AdvisorSchedule | null =
    s && typeof s === 'object'
      ? {
          slots: Array.isArray(s.slots) ? s.slots.map((v: any) => num(v)).filter((v: number) => v > 0) : [],
          last_run_at: str(s.last_run_at),
          next_run_at: str(s.next_run_at),
        }
      : null
  return { clients: list.map((c: any) => parseSummaryEntry(c)).filter((c: AdvisorSummaryEntry | null): c is AdvisorSummaryEntry => c !== null), schedule }
}

/** GET /api/advisor/events?days=14 → { groups: [{ client_id, name, events }] } */
export function parseEventsResponse(data: any): AdvisorEventGroup[] {
  if (!data || typeof data !== 'object') return []
  const groups = Array.isArray(data.groups) ? data.groups : []
  return groups
    .map((g: any) => {
      if (!g || typeof g !== 'object') return null
      const clientId = num(g.client_id ?? g.clientId)
      if (!clientId) return null
      const events = (Array.isArray(g.events) ? g.events : [])
        .map((e: any) => {
          if (!e || typeof e !== 'object') return null
          const date = str(e.date) ?? str(e.event_date)
          const title = str(e.title) ?? str(e.name)
          if (!date || !title) return null
          return { id: String(e.id ?? `${date}:${title}`), date, title, tag_name: str(e.tag_name) ?? str(e.company) }
        })
        .filter((e: AdvisorEventItem | null): e is AdvisorEventItem => e !== null)
      if (!events.length) return null
      return { client_id: clientId, name: String(g.name ?? `Клиент #${clientId}`), events }
    })
    .filter((g: AdvisorEventGroup | null): g is AdvisorEventGroup => g !== null)
}

/** GET /api/advisor/clients/:id → клиент + теги + counts (форма адаптируется к факту) */
export function parseClientDetail(data: any): {
  client: AdvisorClient | null
  tags: AdvisorClientTag[]
} {
  const raw = data?.client && typeof data.client === 'object' ? data.client : data
  const client = parseClient(raw)
  const rawTags = Array.isArray(data?.tags)
    ? data.tags
    : Array.isArray(raw?.tags)
      ? raw.tags
      : []
  const tags = rawTags
    .map((t: any) => {
      if (!t || typeof t !== 'object') return null
      const id = num(t.id)
      if (!id) return null
      return {
        id,
        tag_id: str(t.tag_id),
        tag_name: String(t.tag_name ?? ''),
        tag_type: str(t.tag_type),
      }
    })
    .filter((t: AdvisorClientTag | null): t is AdvisorClientTag => t !== null && !!t.tag_name)
  return { client, tags }
}

/** GET /api/advisor/clients/:id/news?limit=30 → новости по образцу основной ленты */
export function parseNewsResponse(data: any): any[] {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.articles)) return data.articles
  if (Array.isArray(data?.news)) return data.news
  return []
}

/**
 * Форматирование московского времени из ISO-ответа сервера.
 * Сервер считает слоты по МСК (ТЗ-182 Задача 6) — тайзону клиента не применяем.
 */
export function formatMskTime(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const msk = new Date(d.getTime() + (d.getTimezoneOffset() + 180) * 60_000)
  return `${String(msk.getHours()).padStart(2, '0')}:${String(msk.getMinutes()).padStart(2, '0')}`
}

/** «через N дн» / «сегодня» / «завтра» для события по дате 'YYYY-MM-DD' */
export function formatEventDistance(dateStr: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (days === 0) return 'сегодня'
  if (days === 1) return 'завтра'
  if (days > 1 && days < 45) return `через ${days} дн`
  return null
}

/** 'YYYY-MM-DD' → 'DD.MM' */
export function formatEventDate(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return dateStr
  return `${m[3]}.${m[2]}`
}
