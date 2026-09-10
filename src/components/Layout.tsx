import { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { AuthModalProvider, useAuthModal } from '@/contexts/AuthModalContext'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from './AuthModal'
import Navbar from './Navbar'
import Footer from './Footer'

import GracePeriodBanner from './GracePeriodBanner'

interface LayoutProps {
  children: ReactNode
}

function LayoutInner({ children }: LayoutProps) {
  const { isOpen, close } = useAuthModal()
  // ТЗ-88: на гостевой главной футера нет — страница заканчивается финалом
  // TileReveal, жёсткий стоп (никакой «жизни» после сцены). Условие только на
  // рендер <Footer />. Ссылка «Android-приложение» из футера перенесена в
  // бургер-меню (Navbar.tsx).
  const { pathname } = useLocation()
  const { isLoggedIn } = useAuth()
  const hideFooter = pathname === '/' && !isLoggedIn

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-clip w-full max-w-[100vw]" style={{ backgroundColor: '#060606' }}>
      <Navbar />
      <GracePeriodBanner />
      <main className="flex-1 pt-16 overflow-x-clip gpu-content">{children}</main>
      {!hideFooter && <Footer />}
      <AuthModal isOpen={isOpen} onClose={close} />
    </div>
  )
}

export default function Layout({ children }: LayoutProps) {
  return (
    <AuthModalProvider>
      <LayoutInner>{children}</LayoutInner>
    </AuthModalProvider>
  )
}
