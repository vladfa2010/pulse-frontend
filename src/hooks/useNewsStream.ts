/**
 * useNewsStream — отслеживает новые статьи и добавляет анимацию
 * 
 * Сравнивает предыдущий список с новым. Новые элементы (по id)
 * помечаются флагом `isNew` для CSS-анимации.
 */

import { useRef, useState } from 'react'

interface WithId {
  id: string
}

export interface StreamItem<T extends WithId> extends WithId {
  data: T
  isNew: boolean
}

export function useNewsStream<T extends WithId>(articles: T[]): StreamItem<T>[] {
  const prevIdsRef = useRef<Set<string>>(new Set())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  const currentIds = new Set(articles.map(a => a.id))

  // Находим новые id
  const freshlyAdded = new Set<string>()
  for (const id of currentIds) {
    if (!prevIdsRef.current.has(id)) {
      freshlyAdded.add(id)
    }
  }

  // Если появились новые — запускаем таймер сброса
  if (freshlyAdded.size > 0) {
    // Не используем useEffect здесь — просто отмечаем
    prevIdsRef.current = currentIds

    // Добавляем в newIds
    if (newIds.size === 0) {
      setTimeout(() => setNewIds(new Set()), 600)
    }
    setNewIds(prev => {
      const next = new Set(prev)
      for (const id of freshlyAdded) next.add(id)
      return next
    })
  } else {
    prevIdsRef.current = currentIds
  }

  // Формируем результат
  return articles.map(a => ({
    id: a.id,
    data: a,
    isNew: newIds.has(a.id),
  }))
}
