/**
 * =============================================================================
 * PULSE — Радио: серверные флаги (ТЗ-43, задача 3)
 * =============================================================================
 *
 * useQuery(['radio','config']) → GET /api/radio/config (authMiddleware,
 * Cache-Control max-age=300 на бэке). TTL 5 мин, stale-while-revalidate:
 * при повторных заходах на страницу флаги сразу из кэша, фоном ревалидуются.
 * Эндпоинт дёргается не чаще раза в 5 мин (критерий приёмки п.7).
 *
 * При недоступности (сеть/401/ошибка) — дефолты, идентичные серверным
 * (контракт ТЗ-42): страница не ломается, радио работает на browser-голосе.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { RadioConfig } from '@/types/radio'

export const DEFAULT_RADIO_CONFIG: RadioConfig = {
  radio_service_enabled: true,
  radio_voice_provider: 'browser',
  radio_minimax_host_voice: 'presenter_male',
  radio_minimax_guest_voice: 'presenter_female',
  radio_default_mode: 'reflect',
}

export function useRadioConfig(): RadioConfig {
  const { data } = useQuery({
    queryKey: ['radio', 'config'],
    queryFn: async () => (await api.get('/radio/config')) as RadioConfig,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    // 401 (гость/сессия истекла) — не ретраим и не считаем ошибкой страницы
    retryOnMount: false,
  })
  return data ?? DEFAULT_RADIO_CONFIG
}
