import { Link } from 'react-router'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { LogOut, Menu, X, Volume2, VolumeX } from 'lucide-react'
import { useSoundToggle } from '@/hooks/useSoundToggle'

const navLinks = [
  { href: '/', label: 'Главная' },
  { href: '/feed', label: 'Лента' },
  { href: '/sentiment', label: 'Индекс настроения' },
  { href: '/instructions', label: 'Инструкция' },
  { href: '/pricing', label: 'Тарифы' },
  { href: '/#features', label: 'О сервисе' },
]

const adminLink = { href: '/admin', label: 'Админ' }

export default function Navbar() {
  const { isLoggedIn, user, logout } = useAuth()
  const { open } = useAuthModal()
  const { isMuted, toggle } = useSoundToggle()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navHeight = 'calc(4rem + env(safe-area-inset-top))'

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center px-6 md:px-12 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.1)',
          paddingTop: 'env(safe-area-inset-top)',
          height: navHeight,
          contain: 'layout style paint',
        }}
      >
        {/* Liquid glass top highlight */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }}
        />
        <div className="max-w-[1400px] w-full mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 z-10">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-white">PULSE</span>
            </span>
          </Link>

          {/* Center nav links — desktop */}
          <div className="hidden md:flex items-center gap-8 z-10">
            {navLinks.map(link => (
              <Link
                key={link.href}
                to={link.href}
                className="relative text-sm text-text-secondary hover:text-text-primary transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
            {/* Admin link — only for admins */}
            {user?.isAdmin && (
              <Link
                to={adminLink.href}
                className="relative text-sm font-medium text-red-400 hover:text-red-300 transition-colors duration-200"
              >
                {adminLink.label}
              </Link>
            )}
          </div>

          {/* Auth buttons + mobile menu toggle */}
          <div className="flex items-center gap-3 z-10">
            {isLoggedIn ? (
              <>
                <button
                  onClick={toggle}
                  className="h-[38px] w-[38px] flex items-center justify-center text-text-muted hover:text-text-primary transition-colors duration-200"
                  title={isMuted ? 'Включить звук' : 'Выключить звук'}
                  aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
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
                  className="hidden sm:block text-sm text-text-secondary hover:text-text-primary transition-colors px-4 py-2"
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

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(prev => !prev)}
              className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
              aria-label={isMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {isMenuOpen && (
        <div
          className="md:hidden fixed inset-x-0 bottom-0 z-40 flex flex-col px-6 py-6"
          style={{
            top: navHeight,
            backgroundColor: 'rgba(6, 6, 6, 0.97)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="flex flex-col gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="text-base text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-xl px-4 py-3 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {user?.isAdmin && (
              <Link
                to={adminLink.href}
                onClick={() => setIsMenuOpen(false)}
                className="text-base font-medium text-red-400 hover:text-red-300 hover:bg-white/5 rounded-xl px-4 py-3 transition-colors"
              >
                {adminLink.label}
              </Link>
            )}
          </div>

          {/* Mobile sound toggle — only for logged-in users */}
          {isLoggedIn && (
            <div className="mt-6 pt-6 flex items-center gap-3 sm:hidden" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => {
                  toggle()
                  setIsMenuOpen(false)
                }}
                className="flex items-center gap-3 text-text-muted hover:text-text-primary transition-colors py-2"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                <span className="text-sm">{isMuted ? 'Включить звук' : 'Выключить звук'}</span>
              </button>
            </div>
          )}

          {/* Mobile auth fallback for anonymous */}
          {!isLoggedIn && (
            <div className="mt-6 pt-6 flex flex-col gap-3 sm:hidden" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => {
                  setIsMenuOpen(false)
                  open('login')
                }}
                className="w-full text-center text-sm text-text-secondary hover:text-text-primary transition-colors py-2"
              >
                Войти
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false)
                  open('register')
                }}
                className="w-full text-center text-sm font-medium px-5 py-2.5 rounded-pill transition-all duration-200 hover:brightness-115"
                style={{
                  background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                  color: '#060606',
                }}
              >
                Начать
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
