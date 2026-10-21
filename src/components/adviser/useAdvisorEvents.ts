import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { parseEventsResponse, type AdvisorEventGroup } from './adviserTypes'

/**
 * ТЗ-182 Задача 7: агрегированные события клиентов.
 * Эндпоинт /api/advisor/events появится тем же этапом, что и весь модуль;
 * страница к нему tolerant: при ЛЮБОЙ ошибке (404, 5xx, сеть) возвращаем
 * null — блок «События по клиентам» просто не рендерится, страница цела.
 */
export function useAdvisorEvents(days = 14): AdvisorEventGroup[] | null {
  const [groups, setGroups] = useState<AdvisorEventGroup[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get(`/advisor/events?days=${days}`)
      .then(data => {
        if (!cancelled) setGroups(parseEventsResponse(data))
      })
      .catch(() => {
        if (!cancelled) setGroups(null)
      })
    return () => {
      cancelled = true
    }
  }, [days])

  return groups
}
