/**
 * useFlipAnimation — FLIP-анимация сдвига карточек при появлении новых
 *
 * Срабатывает ТОЛЬКО когда новые статьи добавляются в начало списка.
 * При infinite-scroll подгрузке (страница N+1) — игнорирует.
 *
 * Алгоритм:
 *   1. Запомнить getBoundingClientRect всех видимых старых карточек (FIRST)
 *   2. Дать React отрисовать новые карточки (setNewIds -> CSS-класс)
 *   3. Измерить новые позиции старых карточек (LAST)
 *   4. Инвертировать: translateX(delta) без transition
 *   5. Force reflow
 *   6. Анимировать к translateX(0) с transition
 *   7. Cleanup через 2s
 */

import { useRef, useState, useLayoutEffect, useCallback } from 'react'

interface FlipItem {
  id: string
}

export function useFlipAnimation<T extends FlipItem>(
  items: T[],
  trackRef: React.RefObject<HTMLDivElement | null>
): { newIds: Set<string> } {
  const prevIdsRef = useRef<Set<string>>(new Set())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const isFlippingRef = useRef(false)

  const runFlip = useCallback(
    (addedIds: Set<string>) => {
      const track = trackRef.current
      if (!track) return

      // Не запускаем FLIP если пользователь скроллил вправо
      if (track.scrollLeft > 50) {
        setNewIds((prev) => new Set([...prev, ...addedIds]))
        setTimeout(() => {
          setNewIds((prev) => {
            const next = new Set(prev)
            addedIds.forEach((id) => next.delete(id))
            return next
          })
        }, 2000)
        return
      }

      // Защита от параллельных FLIP
      if (isFlippingRef.current) return
      isFlippingRef.current = true

      // Сброс inline-стилей у всех карточек
      const allCards = Array.from(track.querySelectorAll<HTMLElement>('[data-flip-id]'))
      allCards.forEach((card) => {
        card.style.animation = ''
        card.style.transition = ''
        card.style.transform = ''
      })

      // FIRST: запоминаем позиции старых карточек
      const oldCards = allCards.filter((c) => !addedIds.has(c.dataset.flipId!))
      const first = oldCards.map((c) => c.getBoundingClientRect().left)

      // Активируем CSS-класс для новых карточек -> React перерендерит
      setNewIds((prev) => new Set([...prev, ...addedIds]))

      // После React-рендера измеряем LAST
      requestAnimationFrame(() => {
        const last = oldCards.map((c) => c.getBoundingClientRect().left)

        // INVERT: сдвигаем старые карточки обратно на delta
        oldCards.forEach((card, i) => {
          const delta = first[i] - last[i]
          if (Math.abs(delta) > 0.5) {
            card.style.transition = 'none'
            card.style.transform = `translateX(${delta}px)`
            card.classList.add('flip-card-shifting')
          }
        })

        // FORCE REFLOW
        void track.offsetWidth

        // PLAY: анимируем к нулю
        oldCards.forEach((card, i) => {
          const delta = first[i] - last[i]
          if (Math.abs(delta) > 0.5) {
            card.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)'
            card.style.transform = 'translateX(0)'
          }
        })

        // Cleanup через 2s
        setTimeout(() => {
          const currentTrack = trackRef.current
          if (currentTrack) {
            oldCards.forEach((card) => {
              card.style.transition = ''
              card.style.transform = ''
              card.classList.remove('flip-card-shifting')
            })
          }
          setNewIds((prev) => {
            const next = new Set(prev)
            addedIds.forEach((id) => next.delete(id))
            return next
          })
          isFlippingRef.current = false
        }, 2000)
      })
    },
    [trackRef]
  )

  useLayoutEffect(() => {
    const track = trackRef.current
    const currentIds = new Set(items.map((i) => i.id))
    const addedIds = new Set<string>()

    for (const id of currentIds) {
      if (!prevIdsRef.current.has(id)) {
        addedIds.add(id)
      }
    }

    if (addedIds.size > 0) {
      const shouldRunFlip =
        track !== null &&
        track.scrollLeft <= 50 &&
        !isFlippingRef.current &&
        items.length > addedIds.size &&
        items.findIndex((i) => addedIds.has(i.id)) === 0

      if (shouldRunFlip) {
        runFlip(addedIds)
      } else {
        // Первая загрузка, infinite scroll или пользователь скроллил -> только Frost Appear
        setNewIds((prev) => new Set([...prev, ...addedIds]))
        setTimeout(() => {
          setNewIds((prev) => {
            const next = new Set(prev)
            addedIds.forEach((id) => next.delete(id))
            return next
          })
        }, 2000)
      }
    }

    prevIdsRef.current = currentIds
  }, [items, runFlip, trackRef])

  return { newIds }
}
