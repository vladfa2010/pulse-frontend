// Блок статуса SEO-пересборки курсов (ТЗ-164 Задача 6): последний ребилд,
// индикатор запланированной пересборки, кнопка «Пересобрать сейчас».
// Данные — GET /api/admin/education/seo-status; пока pending=true — поллинг
// раз в 10 с с остановкой после финиша. Стили — константы C, без CSS-файлов.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import { fetchSeoStatus, rebuildSeoNow } from './api'
import { C, Btn } from './ui'
import type { SeoRebuildTrigger, SeoStatusResponse } from './types'

const TRIGGER_LABEL: Record<string, string> = {
  mutation: 'сохранение',
  manual: 'ручной',
  boot: 'авто при старте',
}

/** ISO → «ДД.ММ.ГГГГ ЧЧ:ММ» по московскому времени (как везде в продукте). */
function fmtMsk(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const s = d.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return s.replace(', ', ' ')
}

function triggerLabel(t: SeoRebuildTrigger | string): string {
  return TRIGGER_LABEL[t] ?? t
}

export default function SeoStatusBlock() {
  const { toast, toastError } = useToast()
  const [status, setStatus] = useState<SeoStatusResponse | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchSeoStatus())
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Поллинг раз в 10 с только пока pending; стоп после финиша.
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (status?.pending) {
      timerRef.current = setInterval(() => {
        refresh()
      }, 10_000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [status?.pending, refresh])

  const handleRebuild = async () => {
    setRebuilding(true)
    try {
      const r = await rebuildSeoNow()
      toast(`SEO-файлы пересобраны: ${r.courses} курсов`, 'success')
      await refresh()
    } catch (err: any) {
      toastError(err?.message || 'Пересборка не удалась')
      await refresh()
    } finally {
      setRebuilding(false)
    }
  }

  const last = status?.last ?? null

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
      {!status && !loadFailed && <span>Загрузка статуса SEO…</span>}

      {loadFailed && !status && <span style={{ color: C.textMuted }}>Статус SEO-пересборки недоступен</span>}

      {status && !last && !loadFailed && <span>SEO-пересборок пока не было</span>}

      {last && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: C.textMuted }}>Последний ребилд:</span>
          <span style={{ color: C.textPrimary }}>{fmtMsk(last.finished_at ?? last.started_at)}</span>
          {last.status === 'running' && <span style={{ color: C.warning }}>⏳ выполняется…</span>}
          {last.status === 'ok' && (
            <span style={{ color: C.success }}>✅ {last.courses_count ?? 0} курсов</span>
          )}
          {last.status === 'error' && (
            <span style={{ color: C.error }}>
              ❌ ошибка: {(last.error || 'неизвестно').slice(0, 120)}
            </span>
          )}
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              color: C.textMuted,
              fontSize: 11,
            }}
          >
            {triggerLabel(last.trigger)}
          </span>
        </span>
      )}

      {status?.pending && (
        <span style={{ color: C.warning }}>⏳ Пересборка запланирована…</span>
      )}

      <span style={{ marginLeft: 'auto' }}>
        <Btn
          variant="ghost"
          sm
          disabled={rebuilding || status?.pending === true}
          onClick={handleRebuild}
        >
          {rebuilding ? 'Пересборка…' : 'Пересобрать сейчас'}
        </Btn>
      </span>
    </div>
  )
}
