// Блок «Мэтчинг новостей» в табе «Образование» (ТЗ-172): рантайм-выключатель
// LLM-ранкера + расход суточных вызовов. Данные — GET/PUT /api/admin/education/settings.
// Переключение оптимистичное с откатом при ошибке. Стили — константы C, без CSS-файлов.

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import { fetchMatchSettings, updateMatchLlmEnabled } from './api'
import { C } from './ui'
import type { MatchSettingsResponse } from './types'

export default function MatchSettingsBlock() {
  const { toast, toastError } = useToast()
  const [settings, setSettings] = useState<MatchSettingsResponse | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setSettings(await fetchMatchSettings())
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const toggle = async (next: boolean) => {
    if (!settings || saving) return
    const prev = settings
    setSettings({ ...settings, match_llm_enabled: next }) // оптимистично
    setSaving(true)
    try {
      const r = await updateMatchLlmEnabled(next)
      setSettings(r) // заодно перечитали счётчик used/limit
      toast(next ? 'LLM-оценка подсказок включена' : 'LLM-оценка подсказок выключена', 'success')
    } catch (err: any) {
      setSettings(prev) // откат
      toastError(err?.message || 'Не удалось сохранить настройку')
    } finally {
      setSaving(false)
    }
  }

  const on = settings?.match_llm_enabled ?? false

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
        background: C.bgSurface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '10px 14px',
        marginBottom: 20,
        fontSize: 12,
        color: C.textSecondary,
      }}
    >
      {!settings && !loadFailed && <span>Загрузка настроек мэтчинга…</span>}
      {loadFailed && !settings && <span style={{ color: C.textMuted }}>Настройки мэтчинга недоступны</span>}

      {settings && (
        <>
          <label
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
          >
            <input
              type="checkbox"
              checked={on}
              disabled={saving}
              onChange={(e) => toggle(e.target.checked)}
            />
            <span style={{ color: C.textPrimary, fontWeight: 600 }}>LLM-оценка подсказок</span>
          </label>

          <span style={{ color: C.textMuted }}>
            Сегодня LLM-вызовов: {settings.llm_today.used} / {settings.llm_today.limit}
            <span style={{ color: C.textMuted }}> (used — по данным процесса, сброс при рестарте)</span>
          </span>

          <span style={{ color: C.textMuted }}>
            Выключено — подсказки новостей продолжают приходить по совпадению тегов (без LLM-оценки
            и объяснения). Расход токенов на мэтчинг — ноль. Применяется в течение ~минуты.
          </span>
        </>
      )}

      {settings && !settings.match_master_enabled && (
        <span
          style={{
            padding: '2px 10px',
            borderRadius: 999,
            border: `1px solid ${C.warning}`,
            color: C.warning,
            fontSize: 11,
          }}
        >
          Мастер-флаг EDUCATION_MATCH_ENABLED выключен на сервере: мэтчинг не работает независимо от
          этого тумблера
        </span>
      )}
    </div>
  )
}
