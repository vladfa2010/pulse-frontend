import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Lock, User, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import PasswordStrength from './PasswordStrength'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

type AuthStep = 'form' | 'success'

const slideVariants = {
  hidden: { opacity: 0, height: 0, marginTop: 0, overflow: 'hidden' },
  visible: { opacity: 1, height: 'auto', marginTop: 16, overflow: 'hidden' },
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, register } = useAuth()
  const { defaultMode } = useAuthModal()

  const [mode, setMode] = useState<'login' | 'register'>(defaultMode)
  const [step, setStep] = useState<AuthStep>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Sync mode when defaultMode changes
  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode)
    }
  }, [isOpen, defaultMode])

  const reset = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setUsername('')
    setAgreed(false)
    setRememberMe(false)
    setError('')
    setShowPassword(false)
    setShowConfirm(false)
    setStep('form')
    setMode('login')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const switchMode = (m: 'login' | 'register') => {
    setMode(m)
    setError('')
    setStep('form')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setUsername('')
    setAgreed(false)
    setShowPassword(false)
    setShowConfirm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Пароли не совпадают')
        return
      }
      if (password.length < 8) {
        setError('Пароль должен быть не менее 8 символов')
        return
      }
      if (!agreed) {
        setError('Необходимо согласиться с условиями')
        return
      }
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
        const result = await register(username, email, password)
        if (result.success) {
          setStep('success')
        } else {
          setError(result.error || 'Ошибка регистрации')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Сетевая ошибка')
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
          className="fixed inset-0 z-[100] flex justify-center p-4"
          style={{ alignItems: 'flex-start', paddingTop: '10vh' }}
          onClick={handleClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            layout
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="relative w-full max-w-[400px] rounded-2xl p-8"
            style={{
              backgroundColor: '#111111',
              border: '1px solid #222222',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            {/* ============ SUCCESS SCREEN ============ */}
            <AnimatePresence mode="wait">
              {step === 'success' ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    <CheckCircle size={64} className="text-emerald-400 mb-4" />
                  </motion.div>

                  <motion.h3
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-xl font-bold text-white mb-2"
                  >
                    Аккаунт создан!
                  </motion.h3>

                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm text-text-secondary text-center mb-6"
                  >
                    Добро пожаловать в PULSE. Теперь вы можете добавлять теги и отслеживать новости.
                  </motion.p>

                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    onClick={handleClose}
                    className="w-full h-11 rounded-pill text-sm font-semibold transition-all hover:brightness-110"
                    style={{
                      background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                      color: '#060606',
                    }}
                  >
                    Начать
                  </motion.button>
                </motion.div>

              ) : (
                /* ============ FORM ============ */
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Logo */}
                  <div className="flex justify-center mb-6">
                    <img src="/logo.png" alt="PULSE" className="h-12 w-auto object-contain" />
                  </div>

                  {/* Tabs — pill toggle */}
                  <div
                    className="flex rounded-pill p-1 mb-6"
                    style={{ backgroundColor: '#161616' }}
                  >
                    <button
                      onClick={() => switchMode('login')}
                      className="flex-1 py-2 text-sm font-medium rounded-pill transition-all duration-200"
                      style={{
                        backgroundColor: mode === 'login' ? '#222222' : 'transparent',
                        color: mode === 'login' ? '#fff' : '#6B7280',
                      }}
                    >
                      Вход
                    </button>
                    <button
                      onClick={() => switchMode('register')}
                      className="flex-1 py-2 text-sm font-medium rounded-pill transition-all duration-200"
                      style={{
                        backgroundColor: mode === 'register' ? '#222222' : 'transparent',
                        color: mode === 'register' ? '#fff' : '#6B7280',
                      }}
                    >
                      Регистрация
                    </button>
                  </div>

                  {/* Title */}
                  <h3 className="text-center text-lg font-semibold mb-5">
                    {mode === 'login' ? 'Вход' : 'Создать аккаунт'}
                  </h3>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-0">

                    {/* Username (register) */}
                    <AnimatePresence initial={false}>
                      {mode === 'register' && (
                        <motion.div
                          key="username"
                          variants={slideVariants}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <label className="block text-sm text-text-secondary mb-1.5">Логин</label>
                          <div className="relative">
                            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                              type="text"
                              value={username}
                              onChange={e => setUsername(e.target.value)}
                              className="w-full h-11 pl-10 pr-4 text-sm bg-[#161616] border border-[#222222] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-[#00D4FF]/50 transition-colors"
                              placeholder="investor_2025"
                              required
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Email */}
                    <label className="block text-sm text-text-secondary mb-1.5">Email</label>
                    <div className="relative mb-4">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 text-sm bg-[#161616] border border-[#222222] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-[#00D4FF]/50 transition-colors"
                        placeholder="your@email.com"
                        required
                      />
                    </div>

                    {/* Password */}
                    <label className="block text-sm text-text-secondary mb-1.5">Пароль</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full h-11 pl-10 pr-10 text-sm bg-[#161616] border border-[#222222] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-[#00D4FF]/50 transition-colors"
                        placeholder="••••••••"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {/* Password strength (register only) */}
                    {mode === 'register' && <PasswordStrength password={password} />}

                    {/* Forgot password (login only) */}
                    {mode === 'login' && (
                      <div className="flex justify-end mt-1 mb-4">
                        <button type="button" className="text-xs text-[#00D4FF] hover:underline">
                          Забыли пароль?
                        </button>
                      </div>
                    )}

                    {/* Confirm password (register) */}
                    <AnimatePresence initial={false}>
                      {mode === 'register' && (
                        <motion.div
                          key="confirm"
                          variants={slideVariants}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <label className="block text-sm text-text-secondary mb-1.5">Подтвердите пароль</label>
                          <div className="relative mb-4">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                              type={showConfirm ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={e => setConfirmPassword(e.target.value)}
                              className="w-full h-11 pl-10 pr-10 text-sm bg-[#161616] border border-[#222222] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-[#00D4FF]/50 transition-colors"
                              placeholder="••••••••"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirm(!showConfirm)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                            >
                              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Remember me (login) */}
                    {mode === 'login' && (
                      <label className="flex items-center gap-2 mb-4 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={e => setRememberMe(e.target.checked)}
                          className="w-4 h-4 rounded accent-[#00D4FF]"
                        />
                        <span className="text-sm text-text-muted">Запомнить меня</span>
                      </label>
                    )}

                    {/* Agreement (register) */}
                    <AnimatePresence initial={false}>
                      {mode === 'register' && (
                        <motion.div
                          key="agreement"
                          variants={slideVariants}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <label className="flex items-start gap-2 cursor-pointer mb-4">
                            <input
                              type="checkbox"
                              checked={agreed}
                              onChange={e => setAgreed(e.target.checked)}
                              className="mt-0.5 w-4 h-4 rounded accent-[#00D4FF]"
                            />
                            <span className="text-xs text-text-muted leading-relaxed">
                              Я согласен с{' '}
                              <a href="/#/terms" className="text-[#00D4FF] hover:underline" onClick={handleClose}>Условиями использования</a>{' '}
                              и{' '}
                              <a href="/#/privacy" className="text-[#00D4FF] hover:underline" onClick={handleClose}>Политикой конфиденциальности</a>
                            </span>
                          </label>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-sm text-text-error text-center mb-3"
                        >
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 rounded-pill text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                        color: '#060606',
                      }}
                    >
                      {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
                    </button>

                    {/* Submit button only */}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
