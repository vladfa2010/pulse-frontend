import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type AuthModalMode = 'login' | 'register'

interface AuthModalContextType {
  isOpen: boolean
  defaultMode: AuthModalMode
  open: (mode?: AuthModalMode) => void
  close: () => void
}

const AuthModalContext = createContext<AuthModalContextType>({
  isOpen: false,
  defaultMode: 'login',
  open: () => {},
  close: () => {},
})

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [defaultMode, setDefaultMode] = useState<AuthModalMode>('login')

  const open = useCallback((mode: AuthModalMode = 'login') => {
    setDefaultMode(mode)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <AuthModalContext.Provider value={{ isOpen, defaultMode, open, close }}>
      {children}
    </AuthModalContext.Provider>
  )
}

export function useAuthModal() {
  return useContext(AuthModalContext)
}
