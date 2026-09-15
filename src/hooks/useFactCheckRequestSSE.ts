/**
 * PULSE — SSE-подписка на прогресс ad-hoc фактчекинга
 *
 * Только слушает стрим: проверка создаётся отдельным POST /api/fact-check,
 * после чего страница вызывает start(requestId).
 *
 * События бэкенда: {stage, payload, timestamp}, {type:'complete'}, {type:'error'}.
 * Авторизация SSE — через ?token= (EventSource не умеет заголовки).
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { API_BASE } from '@/lib/api'
import { safeStorage } from '@/lib/safeStorage'
import type { FactCheckStageEvent } from '@/hooks/useFactCheckSSE'

export interface UseFactCheckRequestSSE {
  stages: FactCheckStageEvent[]
  error: string | null
  isComplete: boolean
  /** Подписаться на стрим проверки. Без токена — сразу ошибка. */
  start: (requestId: string) => void
  stop: () => void
}

function getToken(): string {
  return safeStorage.get('pulse_token') || ''
}

export function useFactCheckRequestSSE(): UseFactCheckRequestSSE {
  const [stages, setStages] = useState<FactCheckStageEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const stop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const start = useCallback(
    (requestId: string) => {
      stop()
      setStages([])
      setError(null)
      setIsComplete(false)

      const token = getToken()
      if (!token) {
        setError('Требуется авторизация')
        return
      }

      const es = new EventSource(
        `${API_BASE}/fact-check/${encodeURIComponent(requestId)}/stream?token=${encodeURIComponent(token)}`
      )
      eventSourceRef.current = es

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)

          if (data.type === 'complete') {
            setIsComplete(true)
            es.close()
            eventSourceRef.current = null
            return
          }

          if (data.type === 'error') {
            setError(data.message || data.error || 'Ошибка проверки')
            es.close()
            eventSourceRef.current = null
            return
          }

          setStages((prev) => [...prev, data])
        } catch (err) {
          console.error('[useFactCheckRequestSSE] parse error:', err)
        }
      }

      es.onerror = () => {
        // Стрим оборвался — не считаем это фатальным: страница включает fallback polling
        es.close()
        eventSourceRef.current = null
        console.warn('[useFactCheckRequestSSE] EventSource error, fallback to polling')
      }
    },
    [stop]
  )

  // Закрываем соединение при размонтировании владельца
  useEffect(() => stop, [stop])

  return { stages, error, isComplete, start, stop }
}
