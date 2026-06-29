/**
 * useFlipAnimation — FLIP-анимация сдвига карточек при появлении новых
 *
 * Срабатывает ТОЛЬКО когда новые статьи добавляются в начало списка.
 * При infinite-scroll подгрузке (страница N+1) — игнорирует.
 *
 * Алгоритм (синхронный, как в carousel-flip-fixed-v2.html):
 *   1. FIRST: запомнить getBoundingClientRect старых карточек до рендера новых
 *   2. setNewIds -> React отрисовывает новую карточку
 *   3. LAST: в следующем useLayoutEffect измерить новые позиции
 *   4. INVERT: translateX(delta) без transition
 *   5. Force reflow
 *   6. PLAY: transition к translateX(0)
 *   7. Cleanup через 2s
 */

import { useRef, useState, useLayoutEffect } from 'react'

interface FlipItem {
  id: string
}

export function useFlipAnimation<T extends FlipItem>(
  items: T[],
  trackRef: React.RefObject<HTMLDivElement | null>
): { newIds: Set<string> } {
  const prevIdsRef = useRef<Set<string>>(new Set())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const flipPendingRef = useRef<{
    addedIds: Set<string>
    first: number[]
    oldCards: HTMLElement[]
  } | null>(null)
  const isFlippingRef = useRef(false)

  // Этап 1: обнаружить новые элементы, измерить FIRST и запустить рендер с новыми карточками
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
        // Сброс inline-стилей и измерение FIRST
        const allCards = Array.from(track.querySelectorAll<HTMLElement>('[data-flip-id]'))
        allCards.forEach((card) => {
          card.style.animation = ''
          card.style.transition = ''
          card.style.transform = ''
        })

        const oldCards = allCards.filter((c) => !addedIds.has(c.dataset.flipId!))
        const first = oldCards.map((c) => c.getBoundingClientRect().left)

        flipPendingRef.current = { addedIds, first, oldCards }
        isFlippingRef.current = true

        // Рендерим новую карточку (opacity: 0 через news-appear-wrapper)
        setNewIds((prev) => new Set([...prev, ...addedIds]))
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
  }, [items, trackRef])

  // Этап 2: после рендера новых карточек синхронно применить FLIP
  useLayoutEffect(() => {
    const pending = flipPendingRef.current
    if (!pending) return

    const track = trackRef.current
    if (!track) return

    const { addedIds, first, oldCards } = pending
    flipPendingRef.current = null

    // LAST
    const last = oldCards.map((c) => c.getBoundingClientRect().left)

    // INVERT
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

    // PLAY
    oldCards.forEach((card, i) => {
      const delta = first[i] - last[i]
      if (Math.abs(delta) > 0.5) {
        card.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)'
        card.style.transform = 'translateX(0)'
      }
    })

    // Cleanup
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
  }, [newIds, trackRef])

  return { newIds }
}
