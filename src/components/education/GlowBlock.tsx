/**
 * =============================================================================
 * ТЗ-203 — GlowBlock: обёртка подсветки интерактивных блоков урока
 * =============================================================================
 *
 * Включённая подсветка = блок обёрнут в BorderGlow (ТЗ-145) с автопробегом
 * по появлению во вьюпорте — 1:1 с кнопкой «Бесплатная регистрация» на главной.
 *
 * Контракт:
 *  - enabled=false → children рендерятся как есть (ноль изменений, регрессия
 *    существующих уроков);
 *  - enabled=true  → BorderGlow(borderRadius 12, фон карточки урока #101010)
 *    + карточка блока уходит во frameless-режим (свои border/background/
 *    box-shadow отключаются, чтобы не было двойной рамки — критерий 6 ТЗ-203);
 *  - prefers-reduced-motion → animated=false (автопробег не запускается,
 *    свечение по ховеру у BorderGlow остаётся).
 *
 * Источник enabled — атрибут data-glow="1" атома урока (хранится в HTML,
 * санитайзер: services/education/contentHtml.ts, только теговые блоки).
 */

import { useEffect, useState, type ReactNode } from 'react'
import BorderGlow from '@/components/BorderGlow'

export default function GlowBlock({ enabled = false, onSweepEnd, children }: {
  enabled?: boolean
  /** ТЗ-203 v2: колбэк завершения автопробега (напр. фокус в инпут блока) */
  onSweepEnd?: () => void
  children: ReactNode
}) {
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (!enabled) return <>{children}</>

  return (
    <div style={{ display: 'block', width: '100%' }}>
      <BorderGlow borderRadius={12} backgroundColor="#101010" animated={!reducedMotion} onSweepEnd={onSweepEnd}>
        {children}
      </BorderGlow>
    </div>
  )
}
