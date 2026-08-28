import { api } from './api'
import { calendarCopy } from './copy'
import type { CalendarResponse } from '@/types/calendar'

/**
 * Fetch investor calendar from the backend.
 * If the backend returns 503 with calendar_not_loaded, the original error is
 * re-thrown so the component can hide the block.
 * Other errors are wrapped with a friendly message from copy.ts.
 */
export async function getCalendar(): Promise<CalendarResponse> {
  try {
    const data = await api.get('/calendar')
    return data as CalendarResponse
  } catch (err: any) {
    // 503 calendar_not_loaded is an expected state — preserve it.
    if (err?.status === 503 && err?.message === 'calendar_not_loaded') {
      throw err
    }

    const wrapped = new Error(calendarCopy.error)
    ;(wrapped as any).status = err?.status
    throw wrapped
  }
}
