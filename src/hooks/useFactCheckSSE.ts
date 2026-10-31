import { useState, useCallback, useRef } from 'react'
import { API_BASE } from '@/lib/api'
import { safeStorage } from '@/lib/safeStorage'

export interface FactCheckStageEvent {
  stage: string
  payload: any
  timestamp: number
}

export interface RetryInfo {
  attempt: number
  delaySec: number
}

export interface UseFactCheckSSE {
  stages: FactCheckStageEvent[]
  isLoading: boolean
  error: string | null
  isComplete: boolean
  retryInfo: RetryInfo | null
  start: (newsId: string) => void
  stop: () => void
}

function getToken(): string {
  return safeStorage.get('pulse_token') || ''
}

export function useFactCheckSSE(): UseFactCheckSSE {
  const [stages, setStages] = useState<FactCheckStageEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [retryInfo, setRetryInfo] = useState<RetryInfo | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  // ТЗ-206: плашка ретрая снимается по истечении задержки — проверка доигрывает молча
  const showRetry = useCallback((info: RetryInfo) => {
    clearRetryTimer()
    setRetryInfo(info)
    retryTimerRef.current = setTimeout(() => {
      setRetryInfo(null)
      retryTimerRef.current = null
    }, info.delaySec * 1000)
  }, [clearRetryTimer])

  const stop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    clearRetryTimer()
    setRetryInfo(null)
    setIsLoading(false)
  }, [clearRetryTimer])

  const start = useCallback((newsId: string) => {
    stop()

    setStages([])
    setError(null)
    setIsComplete(false)
    setRetryInfo(null)
    setIsLoading(true)

    const token = getToken()
    if (!token) {
      setError('Требуется авторизация')
      setIsLoading(false)
      return
    }

    // Сначала запускаем проверку
    fetch(`${API_BASE}/news/${newsId}/fact-check`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Ошибка ${res.status}`)
        }

        // Подключаем SSE
        const es = new EventSource(`${API_BASE}/news/${newsId}/fact-check/stream?token=${encodeURIComponent(token)}`)
        eventSourceRef.current = es

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)

            if (data.type === 'complete') {
              clearRetryTimer()
              setRetryInfo(null)
              setIsComplete(true)
              setIsLoading(false)
              es.close()
              return
            }

            if (data.type === 'error') {
              clearRetryTimer()
              setRetryInfo(null)
              setError(data.message || 'Ошибка проверки')
              setIsLoading(false)
              es.close()
              return
            }

            // ТЗ-206: нефинальная ошибка — проверка продолжается, stream жив
            if (data.type === 'retry') {
              showRetry({ attempt: data.attempt || 1, delaySec: data.delaySec || 60 })
              return
            }

            setStages((prev) => [...prev, data])
          } catch (err) {
            console.error('[useFactCheckSSE] parse error:', err)
          }
        }

        es.onerror = () => {
          // SSE упал — не закрываем loading сразу, пусть fallback polling разберётся
          es.close()
          console.warn('[useFactCheckSSE] EventSource error, fallback to polling')
        }
      })
      .catch((err) => {
        setError(err.message || 'Не удалось запустить проверку')
        setIsLoading(false)
      })
  }, [stop, showRetry, clearRetryTimer])

  return { stages, isLoading, error, isComplete, retryInfo, start, stop }
}
