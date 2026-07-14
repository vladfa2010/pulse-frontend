import { useState, useCallback, useRef } from 'react'
import { API_BASE } from '@/lib/api'

export interface FactCheckStageEvent {
  stage: string
  payload: any
  timestamp: number
}

export interface UseFactCheckSSE {
  stages: FactCheckStageEvent[]
  isLoading: boolean
  error: string | null
  isComplete: boolean
  start: (newsId: string) => void
  stop: () => void
}

function getToken(): string {
  return localStorage.getItem('pulse_token') || ''
}

export function useFactCheckSSE(): UseFactCheckSSE {
  const [stages, setStages] = useState<FactCheckStageEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const stop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsLoading(false)
  }, [])

  const start = useCallback((newsId: string) => {
    stop()

    setStages([])
    setError(null)
    setIsComplete(false)
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
              setIsComplete(true)
              setIsLoading(false)
              es.close()
              return
            }

            if (data.type === 'error') {
              setError(data.message || 'Ошибка проверки')
              setIsLoading(false)
              es.close()
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
  }, [stop])

  return { stages, isLoading, error, isComplete, start, stop }
}
