import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Lock, User, ArrowRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setEmail('')
    setPassword('')
    setUsername('')
    setAgreed(false)
    setError('')
    setMode('login')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (mode === 'register' && !agreed) {
      setError('Необходимо согласиться с условиями')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const result = await login(email, password)
        if (result.success) {
          handleClose()
        } else {
          setError(result.error || 'Неправильный логин или пароль')
        }
      } else {
        const result = await register(email, password, username)
        if (result.success) {
          setMode('login')
          setError('')
        } else {
          setError(result.error || 'Ошибка регистрации')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-[420px] rounded-2xl p-8"
            style={{
              backgroundColor: '#0E0E0E',
              border: '1px solid #222222',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={20} />
            </button>

            {/* Tabs */}
            <div className="flex mb-6 border-b border-[#222222]">
              <button
                onClick={() => { setMode('login'); setError('') }}
                className="flex-1 pb-3 text-center text-sm font-medium transition-colors relative"
                style={{
                  color: mode === 'login' ? '#00D4FF' : '#6B7280',
                }}
              >
                Войти
                {mode === 'login' && (
                  <motion.div
                    layoutId="authTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: '#00D4FF' }}
                  />
                )}
              </button>
              <button
                onClick={() => { setMode('register'); setError('') }}
                className="flex-1 pb-3 text-center text-sm font-medium transition-colors relative"
                style={{
                  color: mode === 'register' ? '#00D4FF' : '#6B7280',
                }}
              >
                Регистрация
                {mode === 'register' && (
                  <motion.div
                    layoutId="authTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: '#00D4FF' }}
                  />
                )}
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === 'register' && (
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#161616] border border-[#222222] text-text-primary placeholder-text-muted focus:outline-none focus:border-[#00D4FF] transition-colors"
                    placeholder="Имя пользователя"
                    required
                  />
                </div>
              )}

              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#161616] border border-[#222222] text-text-primary placeholder-text-muted focus:outline-none focus:border-[#00D4FF] transition-colors"
                  placeholder="Email"
                  required
                />
              </div>

              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#161616] border border-[#222222] text-text-primary placeholder-text-muted focus:outline-none focus:border-[#00D4FF] transition-colors"
                  placeholder="Пароль"
                  required
                  minLength={6}
                />
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-text-error text-center">{error}</p>
              )}

              {/* Agreement checkbox (register only) */}
              {mode === 'register' && (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded accent-[#00D4FF]"
                  />
                  <span className="text-xs text-text-muted leading-relaxed">
                    Я согласен с{' '}
                    <a href="/#/terms" className="text-[#00D4FF] hover:underline" onClick={handleClose}>
                      Условиями использования
                    </a>{' '}
                    и{' '}
                    <a href="/#/privacy" className="text-[#00D4FF] hover:underline" onClick={handleClose}>
                      Политикой конфиденциальности
                    </a>
                  </span>
                </label>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl text-[15px] font-semibold transition-all duration-200 hover:brightness-115 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                  color: '#060606',
                }}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#060606] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Demo hint */}
            <p className="text-center text-xs text-text-muted mt-4">
              Для теста используйте: demo@pulse.ru / demo123
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
