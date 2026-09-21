/**
 * =============================================================================
 * PULSE — Радио: локальный конфиг юзера (ТЗ-44, задача 2)
 * =============================================================================
 *
 * Порт radio-app/src/lib/config.ts по ТЗ-44: удалены minimaxKey, userTags,
 * voiceProvider, minimaxHostVoice, minimaxGuestVoice, readModeDefault,
 * autoReadDefault (провайдер/голоса/режим по умолчанию — серверные флаги,
 * ТЗ-42; интересы — реальные теги юзера; kill-switch авточтения — блок
 * blocks.autoRead). Ключ localStorage — pulse-radio-config-v1.
 *
 * Хранится в localStorage (useRadioLocalConfig), переживает reload,
 * «сбросить к заводским» — reset().
 */
import type { RadioReadMode } from '@/types/radio'

/** блоки, из которых собирается эфир */
export interface RadioBlocks {
  ticker: boolean
  watchlist: boolean
  calendar: boolean
  radio: boolean
  summary: boolean
  beep: boolean
  autoRead: boolean
}

export type RadioNewsPace = 'fast' | 'normal' | 'slow'

export interface RadioLocalConfig {
  blocks: RadioBlocks
  /** порог свежих новостей для саммари рынка */
  threshold: number
  /** как часто прилетают новости (скорость ленты) */
  newsPace: RadioNewsPace
  /** сколько непрочитанных читать при «запуске эфира» */
  broadcastLimit: number
  /** сколько сюжетов включать в персональное саммари */
  summaryTopN: number
}

export const DEFAULT_RADIO_LOCAL_CONFIG: RadioLocalConfig = {
  blocks: {
    ticker: true,
    watchlist: true,
    calendar: true,
    radio: true,
    summary: true,
    beep: true,
    autoRead: true,
  },
  threshold: 50,
  newsPace: 'normal',
  broadcastLimit: 8,
  summaryTopN: 4,
}

/** диапазон задержки между новостями, мс */
export const PACE_MS: Record<RadioNewsPace, [number, number]> = {
  fast: [3500, 3000],
  normal: [8000, 7000],
  slow: [18000, 12000],
}

export const BLOCK_META: { key: keyof RadioBlocks; title: string; hint: string }[] = [
  { key: 'ticker', title: 'Бегущая строка', hint: 'марки с заголовками под шапкой' },
  { key: 'watchlist', title: 'Наблюдение', hint: 'котировки слева' },
  { key: 'calendar', title: 'Календарь', hint: 'события дня: ставки, CPI, отчётности, отсечки' },
  { key: 'radio', title: 'Панель эфира', hint: 'ON AIR, очередь, настройки голоса' },
  { key: 'summary', title: 'Панель саммари', hint: 'своё саммари + саммари рынка с порогом' },
  { key: 'beep', title: '«Пилик»', hint: 'звуковой сигнал о новой новости' },
  { key: 'autoRead', title: 'Авточтение', hint: 'новые новости сами встают в эфир' },
]

export const RADIO_CONFIG_KEY = 'pulse-radio-config-v1'

/** режимы эфира — для сегментов-переключателей в настройках */
export const READ_MODES: [RadioReadMode, string][] = [
  ['text', 'текст'],
  ['reflect', 'мысли'],
  ['podcast', 'подкаст'],
]
