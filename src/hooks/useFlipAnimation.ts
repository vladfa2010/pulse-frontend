/**
 * useFlipAnimation — FLIP-анимация сдвига карточек при появлении новых
 *
 * Срабатывает ТОЛЬКО когда новые статьи добавляются в начало списка.
 * При infinite-scroll подгрузке (страница N+1) — игнорирует.
 *
 * Алгоритм точно повторяет carousel-flip-fixed-v2.html:
 *   1. Храним собственный `displayItems`, изначально пустой.
 *   2. Когда приходят новые items, сначала измеряем FIRST на текущем DOM
 *      (новые карточки ещё не вставлены).
 *   3. Обновляем `displayItems` -> React вставляет новые карточки.
 *   4. В следующем useLayoutEffect измеряем LAST и применяем INVERT/PLAY.
 *   5. Cleanup через 2s.
 */

import { useRef, useState, useLayoutEffect } from 'react'

interface FlipItem {
  id: string
}

export function useFlipAnimation<T extends FlipItem>(
  items: T[],
  trackRef: React.RefObject<HTMLDivElement | null>
): { items: T[]; newIds: Set<string> } {
  // Реально отрисованные элементы. Можут отставать от props на один цикл FLIP.
  const [displayItems, setDisplayItems] = useState<T[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  const flipPendingRef = useRef<{
    addedIds: Set<string>
    first: number[]
    oldCardIds: string[]
  } | null>(null)
  const isFlippingRef = useRef(false)

  // Этап 1: обнаружить новые элементы, измерить FIRST и (при необходимости) вставить новые карточки
  useLayoutEffect(() => {
    const track = trackRef.current
    const currentIds = new Set(items.map((i) => i.id))
    const displayIds = new Set(displayItems.map((i) => i.id))
    const addedIds = new Set<string>()

    for (const id of currentIds) {
      if (!displayIds.has(id)) {
        addedIds.add(id)
      }
    }

    // Нет изменений, но списки могли пересортироваться/удалиться — синхронизируем
    if (addedIds.size === 0) {
      if (items.length !== displayItems.length || !items.every((item, i) => item.id === displayItems[i]?.id)) {
        setDisplayItems(items)
      }
      return
    }

    const firstNewIndex = items.findIndex((i) => addedIds.has(i.id))

    const shouldRunFlip =
      track !== null &&
      track.scrollLeft <= 50 &&
      !isFlippingRef.current &&
      displayItems.length > 0 && // не первая загрузка
      firstNewIndex === 0 &&
      addedIds.size < items.length

    if (shouldRunFlip) {
      // 0. Сброс inline-стилей у ВСЕХ текущих карточек (как в тестовом файле)
      const allCards = Array.from(track.querySelectorAll<HTMLElement>('[data-flip-id]'))
      allCards.forEach((card) => {
        card.style.animation = ''
        card.style.transition = ''
        card.style.transform = ''
      })

      // 1. FIRST: позиции ДО вставки новых карточек
      const oldCards = allCards.filter((c) => !addedIds.has(c.dataset.flipId!))
      const first = oldCards.map((c) => c.getBoundingClientRect().left)
      const oldCardIds = oldCards.map((c) => c.dataset.flipId!)

      flipPendingRef.current = { addedIds, first, oldCardIds }
      isFlippingRef.current = true

      // 2. Вставляем новые карточки — именно здесь, после измерения FIRST
      setDisplayItems(items)
      setNewIds((prev) => new Set([...prev, ...addedIds]))
    } else {
      // Первая загрузка, infinite scroll или пользователь скроллил -> только Frost Appear
      setDisplayItems(items)
      setNewIds((prev) => new Set([...prev, ...addedIds]))
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev)
          addedIds.forEach((id) => next.delete(id))
          return next
        })
      }, 2000)
    }
  }, [items, displayItems, trackRef])

  // Этап 2: после вставки новых карточек синхронно применить FLIP
  useLayoutEffect(() => {
    const pending = flipPendingRef.current
    if (!pending) return

    const track = trackRef.current
    if (!track) return

    const { addedIds, first, oldCardIds } = pending
    flipPendingRef.current = null

    // Перезапрашиваем DOM-элементы: React мог пересоздать узлы
    const allCards = Array.from(track.querySelectorAll<HTMLElement>('[data-flip-id]'))
    const freshOldCards: HTMLElement[] = []
    for (const id of oldCardIds) {
      const card = allCards.find((c) => c.dataset.flipId === id)
      if (card) freshOldCards.push(card)
    }

    if (freshOldCards.length === 0) {
      isFlippingRef.current = false
      return
    }

    // 3. LAST: позиции ПОСЛЕ вставки
    const last = freshOldCards.map((c) => c.getBoundingClientRect().left)

    // 4. INVERT: сдвигаем старые карточки обратно без transition
    freshOldCards.forEach((card, i) => {
      const delta = first[i] - last[i]
      if (Math.abs(delta) > 0.5) {
        card.style.transition = 'none'
        card.style.transform = `translateX(${delta}px)`
        card.classList.add('flip-card-shifting')
      }
    })

    // 5. FORCE REFLOW
    void track.offsetWidth

    // 6. PLAY: анимируем к нулю
    freshOldCards.forEach((card, i) => {
      const delta = first[i] - last[i]
      if (Math.abs(delta) > 0.5) {
        card.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)'
        card.style.transform = 'translateX(0)'
      }
    })

    // 7. Cleanup через 2s
    setTimeout(() => {
      const currentTrack = trackRef.current
      if (currentTrack) {
        freshOldCards.forEach((card) => {
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
  }, [displayItems, trackRef])

  return { items: displayItems, newIds }
}
