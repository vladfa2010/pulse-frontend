/**
 * =============================================================================
 * PULSE — Радио: локальный конфиг юзера (ТЗ-44, задача 2)
 * =============================================================================
 *
 * Порт useConfig.ts прототипа: localStorage `pulse-radio-config-v1`,
 * merge поверх DEFAULT_RADIO_LOCAL_CONFIG (новые поля не ломают старые
 * сохранения), reset() — «сбросить к заводским». Настройки переживают reload
 * (критерий приёмки п.8).
 */
import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_RADIO_LOCAL_CONFIG,
  RADIO_CONFIG_KEY,
  type RadioLocalConfig,
} from '@/lib/radio/config'

function load(): RadioLocalConfig {
  try {
    const raw = localStorage.getItem(RADIO_CONFIG_KEY)
    if (!raw) return DEFAULT_RADIO_LOCAL_CONFIG
    const parsed = JSON.parse(raw) as Partial<RadioLocalConfig>
    return {
      ...DEFAULT_RADIO_LOCAL_CONFIG,
      ...parsed,
      blocks: { ...DEFAULT_RADIO_LOCAL_CONFIG.blocks, ...(parsed.blocks ?? {}) },
    }
  } catch {
    return DEFAULT_RADIO_LOCAL_CONFIG
  }
}

export function useRadioLocalConfig() {
  const [config, setConfig] = useState<RadioLocalConfig>(load)

  useEffect(() => {
    try {
      localStorage.setItem(RADIO_CONFIG_KEY, JSON.stringify(config))
    } catch {
      /* приватный режим — живём без сохранения */
    }
  }, [config])

  const update = useCallback((patch: Partial<RadioLocalConfig>) => {
    setConfig((c) => ({ ...c, ...patch }))
  }, [])

  const toggleBlock = useCallback((key: keyof RadioLocalConfig['blocks']) => {
    setConfig((c) => ({
      ...c,
      blocks: { ...c.blocks, [key]: !c.blocks[key] },
    }))
  }, [])

  const reset = useCallback(() => setConfig(DEFAULT_RADIO_LOCAL_CONFIG), [])

  return { config, update, toggleBlock, reset }
}
