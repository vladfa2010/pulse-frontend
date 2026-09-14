/**
 * =============================================================================
 * PULSE — Логика разъезда панели каскада (ТЗ-101)
 * =============================================================================
 *
 * Фиче-флаг VITE_CASCADE_EXPAND (задача 4 ТЗ-101):
 *   unset / 'true'  → разъезд панели каскада под каруселью (поведение ТЗ-101);
 *   'false'         → interim-навигация ТЗ-100: navigate('/cascades?cluster=<id>'),
 *                     контейнер разъезда не монтируется.
 *
 * Вся логика — чистые функции (компонентный рендер не тестируем: в проекте
 * нет jsdom-сетапа), тесты: src/lib/__tests__/cascadeExpand.test.ts.
 */

/**
 * unset/true → разъезд; 'false' → interim-navigate.
 * Полярность из ТЗ-101 §2.4: дефолт (флаг не задан) — разъезд включён.
 */
export function isCascadeExpandEnabled(flag: string | null | undefined): boolean {
  return flag !== 'false'
}

/**
 * Одновременно открыт максимум один каскад в карусели (ТЗ-101 задача 1):
 * клик по открытой стопке сворачивает её, клик по другой — переключает панель.
 */
export function nextExpandedCluster(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked
}
