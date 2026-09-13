/**
 * =============================================================================
 * PULSE — Утилиты маппинга времени новости на свечи графика
 * =============================================================================
 *
 * ТЗ-3.6: findNearestTimeIndex извлечён из CandleChart.tsx в общий модуль —
 * та же логика нужна графику каскада (ТЗ-93): маркеры новостей привязываются
 * к ближайшей свече по массиву times инструмента.
 */

/**
 * Индекс ближайшей по времени свечи. Один проход с кэшем эпох, без повторных
 * аллокаций Date при бинарном поиске. Времена отсортированы — дальше по массиву
 * разница только растёт, поэтому ранний выход.
 */
export function findNearestTimeIndex(times: string[], targetIso: string): number {
  const target = new Date(targetIso).getTime()
  let best = 0
  let bestDiff = Infinity
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - target)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    } else {
      // времена отсортированы — дальше diff только растёт
      break
    }
  }
  return best
}
