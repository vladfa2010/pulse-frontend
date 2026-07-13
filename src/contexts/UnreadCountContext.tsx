import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface UnreadCountContextType {
  unreadCount: number
  increment: () => void
  reset: () => void
}

const UnreadCountContext = createContext<UnreadCountContextType>({
  unreadCount: 0,
  increment: () => {},
  reset: () => {},
})

export function UnreadCountProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const increment = useCallback(() => setUnreadCount((p) => p + 1), [])
  const reset = useCallback(() => setUnreadCount(0), [])

  return (
    <UnreadCountContext.Provider value={{ unreadCount, increment, reset }}>
      {children}
    </UnreadCountContext.Provider>
  )
}

export function useUnreadCount() {
  return useContext(UnreadCountContext)
}
