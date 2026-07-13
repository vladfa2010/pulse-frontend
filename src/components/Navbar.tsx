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

function SoundToggleButton({ isMuted, toggle }: { isMuted: boolean; toggle: () => void }) {
  const [isHover, setIsHover] = useState(false)
  const [pulseKey, setPulseKey] = useState(0)

  const handleClick = () => {
    toggle()
    setPulseKey((k) => k + 1)
  }

  const buttonStyle: Record<string, any> = {
    background: 'rgba(255,255,255,0.01)',
    backgroundBlendMode: 'luminosity',
    backdropFilter: 'blur(6px) saturate(140%)',
    WebkitBackdropFilter: 'blur(6px) saturate(140%)',
    boxShadow: isMuted
      ? 'inset 0 1px 1px rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.12)'
      : 'inset 0 1px 1px rgba(0,212,255,0.15), 0 0 16px rgba(0,212,255,0.2), 0 4px 16px rgba(0,0,0,0.15)',
    transform: isHover ? 'scale(1.08)' : 'scale(1)',
    transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1), color 0.9s ease, box-shadow 0.9s ease, background 0.3s ease',
  }

  const beforeStyle: Record<string, any> = {
    padding: '1.4px',
    background: isMuted
      ? 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.5) 100%)'
      : 'linear-gradient(180deg, rgba(0,212,255,0.5) 0%, rgba(0,212,255,0.15) 20%, rgba(0,212,255,0) 40%, rgba(0,212,255,0) 60%, rgba(0,212,255,0.15) 80%, rgba(0,212,255,0.5) 100%)',
    webkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
    mixBlendMode: 'screen',
    opacity: isHover ? 0.4 : 0.25,
    transition: 'opacity 0.3s ease',
  }

  const afterStyle: Record<string, any> = {
    background: `
      radial-gradient(ellipse 90% 40% at 50% 0%, rgba(255,255,255,0.18) 0%, transparent 55%),
      radial-gradient(ellipse 60% 35% at 65% 10%, rgba(255,255,255,0.08) 0%, transparent 50%)
    `,
    mixBlendMode: 'overlay',
    opacity: isMuted ? (isHover ? 0.5 : 0.3) : (isHover ? 0.7 : 0.5),
    transition: 'opacity 0.3s ease',
  }

  return (
    <>
      <style>{`
        @keyframes pulseRingCyan {
          0% { box-shadow: 0 0 0 0 rgba(0,212,255,0.4); }
          70% { box-shadow: 0 0 0 10px rgba(0,212,255,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,212,255,0); }
        }
        @keyframes pulseRingMuted {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
          70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        @keyframes soundWave {
          0%, 100% { opacity: 0.5; transform: scaleY(1); }
          50% { opacity: 1; transform: scaleY(1.3); }
        }
        .wave-line {
          transform-origin: center;
        }
        .waves-active .wave-line:nth-child(1) {
          animation: soundWave 0.9s ease-in-out 3;
          animation-fill-mode: forwards;
        }
        .waves-active .wave-line:nth-child(2) {
          animation: soundWave 1.3s ease-in-out 3;
          animation-delay: 0.15s;
          animation-fill-mode: forwards;
        }
        .waves-active .wave-line:nth-child(3) {
          animation: soundWave 1.7s ease-in-out 3;
          animation-delay: 0.3s;
          animation-fill-mode: forwards;
        }
      `}</style>
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
        className={`
          relative flex items-center justify-center
          h-[38px] w-[38px] rounded-full
          overflow-hidden
          ${isMuted ? 'text-gray-500' : 'text-[#00D4FF]'}
        `}
        style={buttonStyle as React.CSSProperties}
        title={isMuted ? 'Включить звук' : 'Выключить звук'}
        aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
      >
        {/* Liquid glass ::before — gradient border */}
        <span
          className="absolute inset-0 rounded-full pointer-events-none"
          style={beforeStyle as React.CSSProperties}
        />
        {/* Liquid glass ::after — specular highlights */}
        <span
          className="absolute inset-0 rounded-full pointer-events-none"
          style={afterStyle as React.CSSProperties}
        />
        {/* Pulse ring */}
        <span
          key={`pulse-${pulseKey}`}
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            animation: isMuted
              ? 'pulseRingMuted 0.8s ease-out'
              : 'pulseRingCyan 0.8s ease-out',
          }}
        />
        {/* Icon wrapper with animation */}
        <span className="relative z-10" style={{ width: 20, height: 20 }}>
          <span
            className={`
              absolute top-0 left-0
              transition-all duration-[250ms]
              ${isMuted ? 'opacity-0 scale-[0.4] -rotate-45' : 'opacity-100 scale-100 rotate-0'}
            `}
            style={{ transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
          >
            {!isMuted ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="waves-active"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path className="wave-line" d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path className="wave-line" d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            ) : (
              <Volume2 size={20} />
            )}
          </span>
          <span
            className={`
              absolute top-0 left-0
              transition-all duration-[250ms]
              ${isMuted ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-[0.4] -rotate-45'}
            `}
            style={{ transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
          >
            <VolumeX size={20} />
          </span>
        </span>
      </button>
    </>
  )
}

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
                <SoundToggleButton isMuted={isMuted} toggle={toggle} />
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
