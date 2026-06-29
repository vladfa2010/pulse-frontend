import { useMemo } from 'react'
import type { AmbientStyle } from '@/components/AmbientBackground'

const POOL: AmbientStyle[] = ['01a', '01b', '01c', '01d', '03', '05', '06']

function hashId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function pickStyle(id: string, forbidden: Set<AmbientStyle>): AmbientStyle {
  let index = hashId(id) % POOL.length
  let attempts = 0
  while (forbidden.has(POOL[index]) && attempts < POOL.length) {
    index = (index + 1) % POOL.length
    attempts++
  }
  return POOL[index]
}

export function useAmbientStyles<T extends { id: string }>(items: T[]): AmbientStyle[] {
  return useMemo(() => {
    const styles: AmbientStyle[] = []
    for (let i = 0; i < items.length; i++) {
      const forbidden = new Set<AmbientStyle>()
      if (i > 0) forbidden.add(styles[i - 1])
      if (i > 1) forbidden.add(styles[i - 2])
      styles.push(pickStyle(items[i].id, forbidden))
    }
    return styles
  }, [items.map((item) => item.id).join(',')])
}
