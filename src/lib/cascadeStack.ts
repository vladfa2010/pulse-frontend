/**
 * ТЗ-100 — чистая логика карточки-стопки каскада.
 * Вынесена из компонентов, чтобы покрыть vitest без DOM.
 *
 * Решения владельца:
 * - ТЗ-100: полноценная стопка только у первоисточника (cluster_position === 1);
 *   у поздних новостей кластера — только чип «k из N»;
 * - ТЗ-105 (отменяет ТЗ-100 по хвосту): стопка у КАЖДОЙ карточки каскада,
 *   толщина = cluster_size (позиция остаётся в чипе). Клик не меняется:
 *   первоисточник → каскад, поздняя карточка → обычное открытие новости.
 * - у свежей необработанной новости (<15 мин, cluster_pending) — серый «···».
 */
import type { NewsArticle } from '@/types/news'

/** Максимум видимых слоёв под карточкой каскада. */
export const MAX_STACK_LAYERS = 6

/** Возраст (мс), в течение которого свежая новость показывает pending-чип «···». */
export const PENDING_WINDOW_MS = 15 * 60 * 1000

export interface StackLayout {
  /** Новость — первоисточник каскада (cluster_position === 1). */
  isOrigin: boolean
  /** Любая карточка каскада размера > 1 (ТЗ-105: хвост и акцент у всех карт каскада). */
  inCluster: boolean
  /** Рисовать слои-стопку (только портрет; в landscape хвост ломает сетку 16:9). */
  showLayers: boolean
  /** Число слоёв: min(N−1, MAX_STACK_LAYERS). */
  layersCount: number
  /** Показывать серый pending-чип «···». */
  showPending: boolean
  /**
   * Куда ведёт клик по обёртке карточки (§2.4 ТЗ-100):
   * 'cascade' — на страницу каскада (первоисточник; NewsDetailModal НЕ открывается),
   * 'card'    — обычный клик по карточке (NewsDetailModal).
   */
  wrapperClick: 'cascade' | 'card'
}

export function getStackLayout(
  article: NewsArticle,
  variant: 'portrait' | 'landscape',
  now: number = Date.now(),
  hasCascadeClick: boolean = true,
): StackLayout {
  const isOrigin = !!article.cluster_id && article.cluster_position === 1
  const size = article.cluster_size ?? 1
  // ТЗ-105: хвост у КАЖДОЙ карточки каскада, толщина = cluster_size
  // (раньше — только у первоисточника; клик по wrapperClick не изменился).
  const inCluster = !!article.cluster_id && size > 1
  const layersCount = inCluster && variant === 'portrait'
    ? Math.min(Math.max(size - 1, 0), MAX_STACK_LAYERS)
    : 0
  const published = new Date(article.published_at).getTime()
  const showPending = !!article.cluster_pending && now - published < PENDING_WINDOW_MS
  // Первоисточник: весь клик по обёртке ведёт на каскад (пока ТЗ-101 не подменит
  // на разъезд). Поздняя карточка каскада — обычный клик по карточке (хвост у неё
  // тоже есть, но pointer-events у слоёв выключены — клик ловит обёртка).
  // Без обработчика каскада — обычный клик по карточке.
  const wrapperClick = isOrigin && hasCascadeClick ? 'cascade' : 'card'
  return { isOrigin, inCluster, showLayers: layersCount > 0, layersCount, showPending, wrapperClick }
}

/** Геометрия слоя l (1 — верхний … layersCount — нижний). Значения из мокапа
 * stack-feed.html v2 (ТЗ-103): слой начинается на top: calc(100% − 14px), поэтому
 * видимый хвост слоя l = height − 14 = 4l px (шаг 4px — утверждённое усиление). */
export interface StackLayerGeom {
  /** Высота слоя: 14 + l*4 px. */
  height: number
  /** Сужение слева/справа: l*5 px. */
  inset: number
  /** Прозрачность: max(.25, 1 − l·.1) — верхний слой .9. */
  opacity: number
  /** Сдвиг вниз при hover-веере: 1..3 px. */
  hoverShift: number
  /** Поворот при hover-веере: нечётные +.5deg, чётные −.5deg (1-based, мокап). */
  hoverRotate: number
}

export function getLayerGeom(l: number): StackLayerGeom {
  return {
    height: 14 + l * 4,
    inset: l * 5,
    opacity: Math.max(0.25, 1 - l * 0.1),
    hoverShift: Math.min(1 + l * 0.4, 3),
    hoverRotate: l % 2 === 1 ? 0.5 : -0.5,
  }
}

/** Компенсация высоты хвоста под карточкой: layersCount*4 + 2 px. */
export function getStackMarginBottom(layersCount: number): number | undefined {
  return layersCount > 0 ? layersCount * 4 + 2 : undefined
}
