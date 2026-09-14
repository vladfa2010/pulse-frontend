/**
 * =============================================================================
 * PULSE — Контекст разъезда панели каскада (ТЗ-101, задача 1)
 * =============================================================================
 *
 * Provider живёт в NewsCarousel (все карусели главной получают разъезд через
 * общий компонент) и в NewsFeed. Потребители — CascadeStackCard (обёртка
 * первоисточника: назначение клика + класс --open для слоёв) и NewsCard
 * (чип «k из N»: fallback, если проп onCascadeClick не передан).
 *
 * Режимы (фиче-флаг VITE_CASCADE_EXPAND, см. lib/cascadeExpand.ts):
 *   развёрнут (unset/true) — handleCascadeClick открывает/переключает/сворачивает
 *     панель; выключен ('false') — тот же хук делает interim-navigate
 *     '/cascades?cluster=<id>' (ТЗ-100), expandedClusterId всегда null,
 *     контейнер разъезда не монтируется.
 *
 * Панель удерживается после сворачивания (retainedClusterId) до конца transition
 * контейнера — иначе grid-rows 0fr схлопывается мгновенно, без анимации закрытия.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { isCascadeExpandEnabled, nextExpandedCluster } from '@/lib/cascadeExpand'

export interface CascadeExpandContextValue {
  /** Фиче-флаг VITE_CASCADE_EXPAND: false → контейнер разъезда не монтируется. */
  expandEnabled: boolean
  /** Сейчас открытый кластер; null — свёрнуто. */
  expandedClusterId: string | null
  /** id удерживаемой для анимации закрытия панели (см. шапку файла). */
  retainedClusterId: string | null
  /** Клик по стопке/чипу: разъезд либо interim-навигация под флагом. */
  handleCascadeClick: (clusterId: string) => void
  /** Сворачивание (✕ панели). */
  close: () => void
  /** Контейнер зовёт по окончании transition grid-template-rows. */
  onContainerTransitionEnd: () => void
}

const CascadeExpandContext = createContext<CascadeExpandContextValue | null>(null)

/** null — вне провайдера (карточка без разъезда, поведение ТЗ-100 по пропу). */
export function useCascadeExpand(): CascadeExpandContextValue | null {
  return useContext(CascadeExpandContext)
}

export default function CascadeExpandProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const expandEnabled = isCascadeExpandEnabled(import.meta.env.VITE_CASCADE_EXPAND as string | undefined)

  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null)
  const [retainedClusterId, setRetainedClusterId] = useState<string | null>(null)
  // Зеркало expandedClusterId для transition-end (обработчик не в замыкании рендера)
  const expandedRef = useRef<string | null>(null)

  const handleCascadeClick = useCallback((clusterId: string) => {
    // Откат ТЗ-101 §5: флаг выключен — старое поведение ТЗ-100, без панели
    if (!expandEnabled) {
      navigate(`/cascades?cluster=${clusterId}`)
      return
    }
    const next = nextExpandedCluster(expandedRef.current, clusterId)
    expandedRef.current = next
    setExpandedClusterId(next)
    // Панель нового кластера монтируется сразу; при сворачивании id остаётся
    // удержанным до конца transition (анимация закрытия, см. шапку файла)
    setRetainedClusterId(clusterId)
  }, [expandEnabled, navigate])

  const close = useCallback(() => {
    expandedRef.current = null
    setExpandedClusterId(null)
  }, [])

  const onContainerTransitionEnd = useCallback(() => {
    if (!expandedRef.current) setRetainedClusterId(null)
  }, [])

  const value = useMemo<CascadeExpandContextValue>(() => ({
    expandEnabled,
    expandedClusterId: expandEnabled ? expandedClusterId : null,
    retainedClusterId: expandEnabled ? retainedClusterId : null,
    handleCascadeClick,
    close,
    onContainerTransitionEnd,
  }), [expandEnabled, expandedClusterId, retainedClusterId, handleCascadeClick, close, onContainerTransitionEnd])

  return (
    <CascadeExpandContext.Provider value={value}>
      {children}
    </CascadeExpandContext.Provider>
  )
}
