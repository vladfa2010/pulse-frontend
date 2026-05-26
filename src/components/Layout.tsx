import { ReactNode } from 'react'
import { AuthModalProvider, useAuthModal } from '@/contexts/AuthModalContext'
import AuthModal from './AuthModal'
import Navbar from './Navbar'
import Footer from './Footer'

interface LayoutProps {
  children: ReactNode
}

function LayoutInner({ children }: LayoutProps) {
  const { isOpen, close } = useAuthModal()

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ backgroundColor: '#060606' }}>
      <Navbar />
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
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
