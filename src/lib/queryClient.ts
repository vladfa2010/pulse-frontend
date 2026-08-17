/**
 * =============================================================================
 * PULSE — React Query Client
 * =============================================================================
 *
 * Task 5: React Query (tanstack-query) — кэширование, dedup, background refetch.
 *
 * Настройки:
 *   - staleTime: 2 мин — данные считаются свежими 2 минуты
 *   - gcTime: 5 мин — кэш хранится 5 минут после размонтирования
 *   - retry: 1 — одна повторная попытка при ошибке, кроме 429
 *   - refetchOnWindowFocus: false — не обновляем при фокусе окна
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,    // 2 мин — данные свежие
      gcTime: 5 * 60 * 1000,       // 5 мин — кэш живёт
      retry: (failureCount, error) => {
        // Не ретраим при rate-limit — это только усугубит блокировку
        if ((error as any)?.status === 429) return false
        return failureCount < 1
      },
      refetchOnWindowFocus: false,   // Не трогаем при фокусе
    },
    mutations: {
      retry: 0,                      // Мутации не повторяем
    },
  },
});
