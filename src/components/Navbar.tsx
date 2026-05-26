import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { LogOut } from 'lucide-react'

const navLinks = [
  { href: '/', label: 'Главная' },
  { href: '/pricing', label: 'Тарифы' },
  { href: '/#features', label: 'О сервисе' },
]

export default function Navbar() {
  const { isLoggedIn, user, logout } = useAuth()
  const { open } = useAuthModal()

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6 md:px-12"
      style={{
        backgroundColor: 'rgba(6, 6, 6, 0.8)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
      }}
    >
      <div className="max-w-[1400px] w-full mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-white">PULSE</span>
          </span>
        </Link>

        {/* Center nav links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <Link
              key={link.href}
              to={link.href}
              className="relative text-sm text-text-secondary hover:text-text-primary transition-colors duration-200"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth buttons */}
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Link
                to="/profile"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {user?.username || 'Профиль'}
              </Link>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-error transition-colors"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Выйти</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => open('login')}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors px-4 py-2"
              >
                Войти
              </button>
              <button
                onClick={() => open('register')}
                className="text-sm font-medium px-5 py-2 rounded-pill transition-all duration-200 hover:brightness-115"
                style={{
                  background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                  color: '#060606',
                }}
              >
                Начать
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
