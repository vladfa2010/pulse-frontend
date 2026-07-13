import { useEffect, useRef } from 'react'

export function useUnreadBadge(count: number) {
  const originalTitleRef = useRef<string | null>(null)

  useEffect(() => {
    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title
    }

    const originalTitle = originalTitleRef.current
    document.title = count > 0 ? `(${count}) ${originalTitle}` : originalTitle
  }, [count])
}
