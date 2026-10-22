/**
 * ТЗ-182 v15 + ТЗ-183 v6 — модуль клиентских портфелей (advisor).
 * Типы, защитные парсеры ответов /api/advisor/* и чистые хелперы форматирования.
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
  created_at: string | null
  /** ТЗ-191 Задача 5 — штампы последних алертов (крон шлёт и штампует на бэке) */
  last_alert_neg_at: string | null
  last_alert_pos_at: string | null
  /** ТЗ-192 — живые теги клиента (источник чипов карточки, не tags_snapshot) */
  tags: { name: string; type: string | null }[]
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

/** ТЗ-183 Задача 6 — задача советника (advisor_tasks) */
export interface AdvisorTask {
  id: number
  title: string
  /** 'YYYY-MM-DD' — дедлайн; null = без срока */
  due_date: string | null
  is_done: boolean
  /** id события календаря-источника (защита от дублей) */
  source_event_id: string | null
  /** ISO момент напоминания; null — не задано */
  remind_at: string | null
  remind_channels: ('telegram' | 'email')[]
  created_at: string | null
  /** только в агрегате GET /api/advisor/tasks */
  client_id?: number
  client_name?: string
}

/** ТЗ-183 Задача 1 — флаги доставки модуля (advisor_settings.notify_prefs) */
export interface AdvisorNotifyPrefs {
  advisor_digest: boolean
  advisor_news: boolean
  advisor_alert_neg: boolean
  advisor_alert_pos: boolean
  advisor_weekly: boolean
}

export const DEFAULT_NOTIFY_PREFS: AdvisorNotifyPrefs = {
  advisor_digest: true,
  advisor_news: true,
  advisor_alert_neg: true,
  advisor_alert_pos: true,
  advisor_weekly: true,
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
    created_at: str(raw.created_at),
    last_alert_neg_at: str(raw.last_alert_neg_at),
    last_alert_pos_at: str(raw.last_alert_pos_at),
    tags: Array.isArray(raw.tags)
      ? raw.tags
          .map((t: any) => ({ name: String(t?.name ?? ''), type: (t?.type as string | null) ?? null }))
          .filter((t: { name: string }) => t.name)
      : [],
  }
}

/**
 * GET /api/advisor/clients → массив клиентов.
 * Терпим и к форме { clients: [...], limit: N }: лимит тогда берём из ответа.
 * ТЗ-191: meta.portfolio_limit / meta.active_count (-1 = безлимит) — толерантно,
 * если meta ещё нет на сервере, получим null.
 */
export function parseClientsResponse(data: any): {
  clients: AdvisorClient[]
  limit: number | null
  meta: { portfolio_limit: number | null; active_count: number | null }
} {
  const metaRaw = data?.meta && typeof data.meta === 'object' ? data.meta : null
  const meta = {
    portfolio_limit: typeof metaRaw?.portfolio_limit === 'number' && Number.isFinite(metaRaw.portfolio_limit) ? metaRaw.portfolio_limit : null,
    active_count: typeof metaRaw?.active_count === 'number' && Number.isFinite(metaRaw.active_count) ? metaRaw.active_count : null,
  }
  if (Array.isArray(data)) {
    return { clients: data.map((c: any) => parseClient(c)).filter((c: AdvisorClient | null): c is AdvisorClient => c !== null), limit: null, meta }
  }
  const list = Array.isArray(data?.clients) ? data.clients : []
  const limit = typeof data?.limit === 'number' && Number.isFinite(data.limit) ? data.limit : null
  return { clients: list.map((c: any) => parseClient(c)).filter((c: AdvisorClient | null): c is AdvisorClient => c !== null), limit, meta }
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


// ═══════════════════════════════════════════════════════════════════════════
// ТЗ-183 v6 — задачи, напоминания, заметки, копирование, notify-prefs
// ═══════════════════════════════════════════════════════════════════════════

const bool = (v: unknown, dflt: boolean): boolean => (typeof v === 'boolean' ? v : v === 1 || v === '1' ? true : v === 0 || v === '0' ? false : dflt)

function parseTask(raw: any): AdvisorTask | null {
  if (!raw || typeof raw !== 'object') return null
  const id = num(raw.id)
  const title = str(raw.title)
  if (!id || !title) return null
  const channels = Array.isArray(raw.remind_channels)
    ? raw.remind_channels.filter((c: any): c is 'telegram' | 'email' => c === 'telegram' || c === 'email')
    : []
  return {
    id,
    title,
    due_date: str(raw.due_date),
    is_done: raw.is_done === true || raw.is_done === 1,
    source_event_id: raw.source_event_id != null ? String(raw.source_event_id) : null,
    remind_at: str(raw.remind_at),
    remind_channels: channels,
    created_at: str(raw.created_at),
    client_id: num(raw.client_id) || undefined,
    client_name: str(raw.client_name) ?? undefined,
  }
}

/**
 * GET /api/advisor/clients/:id/tasks и GET /api/advisor/tasks → { tasks: [...] }.
 * Терпим и к голому массиву. В агрегате у задач есть client_id/client_name.
 */
export function parseTasksResponse(data: any): AdvisorTask[] {
  const list = Array.isArray(data?.tasks) ? data.tasks : Array.isArray(data) ? data : []
  return list.map((t: any) => parseTask(t)).filter((t: AdvisorTask | null): t is AdvisorTask => t !== null)
}

/**
 * GET/PUT /api/advisor/notify-prefs → флаги доставки.
 * Терпим к форме: { prefs: {...} }, { notify_prefs: {...} } или голые флаги
 * в корне — неизвестные ключи = дефолт ON (ТЗ-183 Задача 1).
 */
export function parseNotifyPrefs(data: any): AdvisorNotifyPrefs {
  const raw =
    data?.prefs && typeof data.prefs === 'object'
      ? data.prefs
      : data?.notify_prefs && typeof data.notify_prefs === 'object'
        ? data.notify_prefs
        : data && typeof data === 'object'
          ? data
          : {}
  return {
    advisor_digest: bool(raw.advisor_digest, DEFAULT_NOTIFY_PREFS.advisor_digest),
    advisor_news: bool(raw.advisor_news, DEFAULT_NOTIFY_PREFS.advisor_news),
    advisor_alert_neg: bool(raw.advisor_alert_neg, DEFAULT_NOTIFY_PREFS.advisor_alert_neg),
    advisor_alert_pos: bool(raw.advisor_alert_pos, DEFAULT_NOTIFY_PREFS.advisor_alert_pos),
    advisor_weekly: bool(raw.advisor_weekly, DEFAULT_NOTIFY_PREFS.advisor_weekly),
  }
}

/** GET /api/advisor/telegram/status → { linked } (терпим к truthy-формам) */
export function parseTelegramStatus(data: any): boolean {
  if (!data || typeof data !== 'object') return false
  return data.linked === true || data.linked === 1
}

/** Саммари-заглушка — «Копировать» disabled (ТЗ-183 Задача 8) */
export function isStubSummary(summary: AdvisorSummaryEntry | null | undefined): boolean {
  return !summary || !summary.summary || summary.articles_count === 0
}

/** Бейдж «⚠ требует внимания»: негатив ≥ 60% (ТЗ-183 Задача 5, единый порог с алертом) */
export function needsAttention(summary: AdvisorSummaryEntry | null | undefined): boolean {
  return (summary?.sentiment_mix?.neg ?? 0) >= 60
}

/** ТЗ-191 Задача 3 — «1 новость / 2 новости / 5 новостей» */
export function formatNewsCount(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return `${n} новостей`
  switch (n % 10) {
    case 1:
      return `${n} новость`
    case 2:
    case 3:
    case 4:
      return `${n} новости`
    default:
      return `${n} новостей`
  }
}

/** ТЗ-191 Задача 5 — окно свежести алерта (cooldown на бэке — 12 ч на направление) */
export const ALERT_WINDOW_MS = 12 * 60 * 60 * 1000

/** ТЗ-191 Задача 5 — ISO самого свежего штампа алерта; null если ни одного не было */
export function latestAlertAt(
  client: Pick<AdvisorClient, 'last_alert_neg_at' | 'last_alert_pos_at'>,
): string | null {
  const negMs = client.last_alert_neg_at ? new Date(client.last_alert_neg_at).getTime() : NaN
  const posMs = client.last_alert_pos_at ? new Date(client.last_alert_pos_at).getTime() : NaN
  if (!Number.isFinite(negMs) && !Number.isFinite(posMs)) return null
  if (!Number.isFinite(negMs)) return client.last_alert_pos_at
  if (!Number.isFinite(posMs)) return client.last_alert_neg_at
  return posMs >= negMs ? client.last_alert_pos_at : client.last_alert_neg_at
}

/** ТЗ-191 Задача 5 — true, если последний алерт ушёл меньше 12 ч назад */
export function alertSentRecently(
  client: Pick<AdvisorClient, 'last_alert_neg_at' | 'last_alert_pos_at'>,
  nowMs: number = Date.now(),
): boolean {
  const at = latestAlertAt(client)
  if (!at) return false
  const t = new Date(at).getTime()
  return Number.isFinite(t) && nowMs - t >= 0 && nowMs - t < ALERT_WINDOW_MS
}

/** ТЗ-191 Задача 6 — цветовая кодировка типа события (палитра .kind-chip мокапа) */
export const EVENT_KIND_COLORS = {
  sd: '#F59E0B',
  div: '#34D399',
  report: '#00D4FF',
} as const

/** ТЗ-191 Задача 6 — тип события по заголовку: СД / Дивиденды / Отчётность; null — без чипа */
export function eventKind(title: string): { label: string; color: string } | null {
  if (/совет директоров/i.test(title)) return { label: 'СД', color: EVENT_KIND_COLORS.sd }
  if (/дивиденд/i.test(title)) return { label: 'Дивиденды', color: EVENT_KIND_COLORS.div }
  if (/отч[её]т|мсфо|рыночная оценка|\bras\b/i.test(title)) return { label: 'Отчётность', color: EVENT_KIND_COLORS.report }
  return null
}

/** ТЗ-191 Задача 6 — месяц для date-badge ('YYYY-MM-DD' → 'окт') */
export function formatEventMonth(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return ''
  return ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][Number(m[2]) - 1] ?? ''
}

/** 'YYYY-MM-DD' → 'ДД.ММ.ГГГГ' */
export function formatTaskDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return dateStr
  return `${m[3]}.${m[2]}.${m[1]}`
}

/** ISO → 'ДД.ММ.ГГГГ' (в тайзоне ответа); null/undefined → '' */
export function formatFullDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

/** ISO → 'ДД.ММ.ГГГГ, ЧЧ:ММ (мск)' — подпись заданного напоминания */
export function formatMskDateTime(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const msk = new Date(d.getTime() + (d.getTimezoneOffset() + 180) * 60_000)
  const date = `${String(msk.getDate()).padStart(2, '0')}.${String(msk.getMonth() + 1).padStart(2, '0')}.${msk.getFullYear()}`
  const time = `${String(msk.getHours()).padStart(2, '0')}:${String(msk.getMinutes()).padStart(2, '0')}`
  return `${date}, ${time} (мск)`
}

/**
 * Пресеты напоминаний (ТЗ-183 v6): фронт считает абсолютный remind_at от due_date
 * ('YYYY-MM-DD'), сервер пресетов не знает. 09:00 МСК = 06:00 UTC.
 * 'day' — в день дедлайна; 'before' — за день до. Без дедлайна → null.
 */
export function reminderPresetIso(dueDate: string | null, preset: 'day' | 'before'): string | null {
  if (!dueDate) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 6, 0, 0))
  if (preset === 'before') d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString()
}

/** Автотайтл задачи из события календаря: «Позвонить до 24.10 — Совет директоров Сбербанк» */
export function taskTitleFromEvent(event: AdvisorEventItem): string {
  return `Позвонить до ${formatEventDate(event.date)} — ${event.title}`
}

/**
 * White-label текст «Копировать» (ТЗ-183 Задача 8): без бренда, заметок,
 * лимитов и служебных строк. Пустые Теги/события — строка опускается.
 */
export function buildCopyText(opts: {
  name: string
  dateLabel: string
  summary: string
  tags: string[]
  events: { date: string; title: string }[]
}): string {
  const parts: string[] = [`${opts.name} — обзор на ${opts.dateLabel}`, '', opts.summary.trim()]
  if (opts.tags.length) parts.push('', `Теги: ${opts.tags.join(', ')}`)
  if (opts.events.length) {
    parts.push('', `Ближайшие события: ${opts.events.map(e => `${formatEventDate(e.date)} ${e.title}`).join('; ')}`)
  }
  return parts.join('\n').trim()
}
