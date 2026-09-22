/**
 * =============================================================================
 * PULSE — Типы радио (ТЗ-43)
 * =============================================================================
 *
 * Интерфейсы адаптеров фиксируются здесь — ТЗ-44 (UI и голос) потребляет их,
 * не переопределяя. Источник данных — существующие эндпоинты Pulse
 * (/api/news, /api/user/tags, /api/calendar, /api/radio/config).
 */
import type { TagImpact } from './news'

/** Режим подачи карточки (RADIO.md §1). Дефолт — серверный флаг radio_default_mode */
export type RadioReadMode = 'text' | 'reflect' | 'podcast'

/** Голосовой провайдер — ТЗ-44: значение только из серверного конфига */
export type RadioVoiceProvider = 'browser' | 'minimax'

/** Роль в эфире: ведущий / аналитик / одиночный диктор */
export type RadioSpeaker = 'host' | 'guest' | 'single'

/** Озвучиваемый сегмент реплики */
export interface RadioSegment {
  text: string
  role: RadioSpeaker
}

/** Котировка наблюдения (watchlist, ТЗ-44) */
export interface RadioQuote {
  symbol: string
  name: string
  price: number
  changePct: number
}

/** Серверные флаги радио (GET /api/radio/config, ТЗ-42) */
export interface RadioConfig {
  /** Kill-switch всего сервиса радио (админ, ТЗ-46). Авточтение — юзерская
   * настройка RadioLocalConfig.autoRead, сюда она не входит. */
  radio_service_enabled: boolean
  radio_voice_provider: 'browser' | 'minimax' | string
  radio_minimax_host_voice: string
  radio_minimax_guest_voice: string
  radio_default_mode: RadioReadMode | string
}

/** Тег юзера как приходит из GET /api/user/tags (matched_tags хранит tag_id) */
export interface RadioUserTag {
  tag_id: string
  tag_name: string
}

/** Карточка эфира — единый тип ленты, плеера и движка речи */
export interface RadioNewsItem {
  id: string
  /** published_at, ISO — как пришёл с бэкенда */
  time: string
  title: string            // title_ru (фолбэк title_original)
  text: string             // summary_ru (фолбэк summary_original)
  source: string
  url: string
  /** имена тегов через tagMap; неизвестный id — показываем id, не падаем */
  tags: string[]
  /**
   * max |tag_impact[].score| по тегам юзера; если у новости нет ни одного
   * импакта по тегам юзера — |sentiment_score|; иначе 0.
   * 0 = нет оценки (LLM-фолбэк пайплайна): ни чипа, ни фразы не выдумываем.
   */
  score: number
  /** source_count > 1 — перепечатка сюжета */
  reprint: boolean
  /** all_sources (фолбэк [source]) */
  sources: string[]
  /** tag_impact — проносится как есть (для режима «мысли» и строк влияния) */
  tagImpact: TagImpact[]
  /** sentiment_reasoning — 3 абзаца (факты / эффект / каскад) или '' */
  sentimentReasoning: string
}

/** Событие календаря на сегодня (calendarAdapter) */
export interface RadioCalendarEvent {
  /** HH:MM извлечённое regex-ом из title группы; null — показывать без времени */
  time: string | null
  title: string
  kind: string
}

/** Элемент очереди плеера (useSpeech, ТЗ-44) */
export interface RadioQueueEntry {
  id: string
  item: RadioNewsItem
  /** визуальный label карточки в плеере: «эфир · N из M», «по запросу», … */
  label: string
  segments: RadioSegment[]
}
