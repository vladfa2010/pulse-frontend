import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Lock, User, Eye, EyeOff, CheckCircle, ArrowLeft, AlertTriangle, Check } from 'lucide-react'
import { useNavigate, Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { safeStorage } from '@/lib/safeStorage'
import { logAnalyticsEvent } from '@/lib/analytics'
import { popReturnUrl } from '@/lib/returnUrl'
import PasswordStrength from './PasswordStrength'
import BorderGlow from './BorderGlow'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

type AuthStep = 'form' | 'success'
type ForgotStep = 'email' | 'code' | 'password' | 'success'

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, register, forgotPassword, verifyCode, resetPassword } = useAuth()
  const { defaultMode } = useAuthModal()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(defaultMode)
  const [step, setStep] = useState<AuthStep>('form')
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email')
  const [resetToken, setResetToken] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const [returnUrl, setReturnUrl] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showNewConfirm, setShowNewConfirm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [code, setCode] = useState('')
  // ТЗ-119: регистрация в 3 шага (имя → почта → пароль + согласие)
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1)
  const [stepDir, setStepDir] = useState(1) // направление slide-x анимации
  const [stepHint, setStepHint] = useState('') // инлайн-подсказка шагов 1–2
  const [igniteCount, setIgniteCount] = useState(0) // вспышка пробегом при зажигании
  const [pwdSubmitError, setPwdSubmitError] = useState(false) // красный счётчик (сабмит)
  const [pwdShakeTick, setPwdShakeTick] = useState(0)
  const [agreeError, setAgreeError] = useState(false) // подсветка чекбокса (сабмит)
  const [agreeShakeTick, setAgreeShakeTick] = useState(0)
  const wasLitRef = useRef(false) // «уже зажигалась» — сброс при удалении ниже 8
  const usernameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const isStoragePersistent = useMemo(() => safeStorage.isPersistent(), [])

  // Sync mode when defaultMode changes
  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode)
    }
  }, [isOpen, defaultMode])

  // ТЗ-110: блок скролла страницы под открытой модалкой (паттерн
  // NewsDetailModal). AuthModal смонтирован всегда — эффект ключуем на isOpen;
  // cleanup восстанавливает overflow, локов не остаётся.
  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // ТЗ-119: сброс стейта 3-шаговой регистрации
  const resetRegState = () => {
    setRegStep(1)
    setStepDir(1)
    setStepHint('')
    setIgniteCount(0)
    setPwdSubmitError(false)
    setPwdShakeTick(0)
    setAgreeError(false)
    setAgreeShakeTick(0)
    wasLitRef.current = false
  }

  const reset = () => {
    setEmail('')
    setPassword('')
    setUsername('')
    setAgreed(false)
    setRememberMe(false)
    setError('')
    setShowPassword(false)
    setShowNewPassword(false)
    setShowNewConfirm(false)
    setNewPassword('')
    setConfirmNewPassword('')
    setCode('')
    setResetToken('')
    setResendTimer(0)
    setStep('form')
    setForgotStep('email')
    setMode('login')
    setReturnUrl(null)
    resetRegState()
  }

  const handleAuthSuccess = (savedUrl: string | null = popReturnUrl()) => {
    if (savedUrl) {
      onClose()
      navigate(savedUrl, { replace: true })
    } else {
      handleClose()
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const switchMode = (m: 'login' | 'register' | 'forgot') => {
    setMode(m)
    setError('')
    setStep('form')
    if (m === 'forgot') {
      setForgotStep('email')
      setPassword('')
      setUsername('')
      setNewPassword('')
      setConfirmNewPassword('')
      setCode('')
      setResetToken('')
      setResendTimer(0)
    } else {
      setForgotStep('email')
      setEmail('')
      setPassword('')
      setUsername('')
      setAgreed(false)
      setShowPassword(false)
    }
    resetRegState()
  }

  const goBackToLogin = () => {
    reset()
    setMode('login')
  }

  // Таймер повторной отправки кода
  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setTimeout(() => setResendTimer(prev => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [resendTimer])

  // ═══════════════════════════════════════════════════════════════════════
  // ТЗ-119: регистрация в 3 шага
  // ═══════════════════════════════════════════════════════════════════════

  const pluralSymbols = (n: number) =>
    n % 10 === 1 && n % 100 !== 11 ? 'символ' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'символа' : 'символов'

  const goStep = (next: 1 | 2 | 3) => {
    setStepDir(next > regStep ? 1 : -1)
    setRegStep(next)
    setStepHint('')
  }

  // Шаг 1 → 2: имя не короче 2 символов
  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim().length < 2) {
      setStepHint('Напишите хотя бы пару букв — и вперёд')
      usernameRef.current?.focus()
      return
    }
    goStep(2)
  }

  // Шаг 2 → 3: валидация почты
  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setStepHint('Похоже, в адресе опечатка — проверьте')
      emailRef.current?.focus()
      return
    }
    goStep(3)
  }

  // Зажигание кнопки: вспышка пробегом в момент первого достижения 8 символов;
  // стерли ниже 8 — флаг сбрасывается, при повторном достижении вспышка повторяется.
  useEffect(() => {
    const lit = password.length >= 8
    if (lit && !wasLitRef.current) {
      wasLitRef.current = true
      setIgniteCount(c => c + 1)
    } else if (!lit) {
      wasLitRef.current = false
    }
  }, [password.length])

  // Автофокус на поле текущего шага — только десктоп (на мобильном не дёргать клавиатуру)
  useEffect(() => {
    if (!isOpen || mode !== 'register' || step !== 'form') return
    if (!window.matchMedia('(pointer:fine)').matches) return
    const t = setTimeout(() => {
      if (regStep === 1) usernameRef.current?.focus()
      else if (regStep === 2) emailRef.current?.focus()
      else passwordRef.current?.focus()
    }, 300)
    return () => clearTimeout(t)
  }, [regStep, mode, step, isOpen])

  // ═══════════════════════════════════════════════════════════════════════
  // Восстановление пароля — шаг 1: отправка кода
  // ═══════════════════════════════════════════════════════════════════════
  const handleForgotEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Введите email')
      return
    }

    setLoading(true)
    try {
      const result = await forgotPassword(email)
      if (result.success) {
        setForgotStep('code')
        setResendTimer(60)
      } else {
        setError(result.error || 'Не удалось отправить код')
      }
    } catch (err: any) {
      setError(err.message || 'Сетевая ошибка')
    } finally {
      setLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Восстановление пароля — шаг 2: проверка кода
  // ═══════════════════════════════════════════════════════════════════════
  const handleForgotVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (code.length !== 6) {
      setError('Введите 6 цифр кода')
      return
    }

    setLoading(true)
    try {
      const result = await verifyCode(email, code)
      if (result.success && result.resetToken) {
        setResetToken(result.resetToken)
        setForgotStep('password')
      } else {
        setError(result.error || 'Неверный или просроченный код')
      }
    } catch (err: any) {
      setError(err.message || 'Сетевая ошибка')
    } finally {
      setLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Восстановление пароля — повторная отправка кода
  // ═══════════════════════════════════════════════════════════════════════
  const handleResendCode = async () => {
    if (resendTimer > 0) return
    setError('')
    setLoading(true)
    try {
      const result = await forgotPassword(email)
      if (result.success) {
        setResendTimer(60)
      } else {
        setError(result.error || 'Не удалось отправить код')
      }
    } catch (err: any) {
      setError(err.message || 'Сетевая ошибка')
    } finally {
      setLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Восстановление пароля — шаг 3: сохранение нового пароля
  // ═══════════════════════════════════════════════════════════════════════
  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Пароль должен быть не менее 8 символов')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setError('Пароли не совпадают')
      return
    }

    setLoading(true)
    try {
      const result = await resetPassword(resetToken, newPassword)
      if (result.success) {
        logAnalyticsEvent('login', { method: 'password_reset' })
        setForgotStep('success')
      } else {
        setError(result.error || 'Не удалось сменить пароль')
      }
    } catch (err: any) {
      setError(err.message || 'Сетевая ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (mode === 'register') {
      // Сюда попадаем только с шага 3 (шаги 1–2 валидируют свои формы).
      // Guard на имя: гарантируется шагом 1, но на всякий случай возвращаем туда.
      if (username.trim().length < 2) {
        goStep(1)
        return
      }
      if (password.length < 8) {
        // Красный счётчик + тряска в подзаголовке шага (ТЗ-119 Задача 5)
        setPwdSubmitError(true)
        setPwdShakeTick(t => t + 1)
        passwordRef.current?.focus()
        return
      }
      if (!agreed) {
        // Подсветка чекбокса + подсказка (ТЗ-119 Задача 5)
        setAgreeError(true)
        setAgreeShakeTick(t => t + 1)
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const result = await login(email, password)
        if (result.success) {
          logAnalyticsEvent('login', { method: 'email' })
          handleAuthSuccess()
        } else {
          setError(result.error || 'Неправильный логин или пароль')
        }
      } else {
        const result = await register(username, email, password)
        if (result.success) {
          logAnalyticsEvent('sign_up', { method: 'email' })
          setReturnUrl(popReturnUrl())
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
          className="fixed inset-0 z-[100] flex justify-center items-start pt-[4vh] sm:pt-[10vh] p-4"
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
            className="relative w-full max-w-[400px] rounded-2xl p-8
                       max-h-[calc(100vh-6rem)]
                       supports-[height:100dvh]:max-h-[calc(100dvh-6rem)]
                       overflow-y-auto overflow-x-hidden
                       [overscroll-behavior:contain]"
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

            {/* ============ SUCCESS SCREEN (register) ============ */}
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
                    <CheckCircle size={64} className="text-[#00D4FF] mb-4" />
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
                    style={{ whiteSpace: 'pre-line' }}
                  >
                    {username.trim()
                      ? `${username.trim().charAt(0).toUpperCase()}${username.trim().slice(1)}, добро пожаловать в PULSE.\nПисьмо с подтверждением уже летит на почту.`
                      : 'Добро пожаловать в PULSE. Письмо с подтверждением уже летит на почту.'}
                  </motion.p>

                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    onClick={() => handleAuthSuccess(returnUrl)}
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

                  {mode === 'forgot' ? (
                    <>
                      {/* Back to login */}
                      <button
                        type="button"
                        onClick={goBackToLogin}
                        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-white transition-colors mb-4"
                      >
                        <ArrowLeft size={16} />
                        Назад ко входу
                      </button>

                      {/* Title */}
                      <h3 className="text-center text-lg font-semibold mb-5">
                        {forgotStep === 'email' && 'Восстановление пароля'}
                        {forgotStep === 'code' && 'Введите код'}
                        {forgotStep === 'password' && 'Новый пароль'}
                        {forgotStep === 'success' && 'Пароль изменён'}
                      </h3>

                      {forgotStep === 'email' && (
                        <form onSubmit={handleForgotEmail} className="flex flex-col gap-0">
                          <p className="text-sm text-text-secondary text-center mb-4">
                            Введите email, который вы использовали при регистрации. Мы отправим код для сброса пароля.
                          </p>

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

                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 rounded-pill text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                            style={{
                              background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                              color: '#060606',
                            }}
                          >
                            {loading ? 'Загрузка...' : 'Отправить код'}
                          </button>
                        </form>
                      )}

                      {forgotStep === 'code' && (
                        <form onSubmit={handleForgotVerify} className="flex flex-col gap-0">
                          <p className="text-sm text-text-secondary text-center mb-4">
                            Мы отправили 6-значный код на <strong>{email}</strong>. Введите его ниже.
                          </p>

                          <label className="block text-sm text-text-secondary mb-1.5">Код из письма</label>
                          <div className="relative mb-4">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={code}
                              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                              className="w-full h-11 pl-10 pr-4 text-sm bg-[#161616] border border-[#222222] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-[#00D4FF]/50 transition-colors tracking-[0.3em] font-mono"
                              placeholder="123456"
                              required
                            />
                          </div>

                          <div className="flex justify-center mb-4">
                            <button
                              type="button"
                              onClick={handleResendCode}
                              disabled={resendTimer > 0 || loading}
                              className="text-xs text-[#00D4FF] hover:underline disabled:text-text-muted disabled:no-underline"
                            >
                              {resendTimer > 0 ? `Отправить повторно через ${resendTimer} с` : 'Отправить код повторно'}
                            </button>
                          </div>

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

                          <button
                            type="submit"
                            disabled={loading || code.length !== 6}
                            className="w-full h-11 rounded-pill text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                            style={{
                              background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                              color: '#060606',
                            }}
                          >
                            {loading ? 'Загрузка...' : 'Продолжить'}
                          </button>
                        </form>
                      )}

                      {forgotStep === 'password' && (
                        <form onSubmit={handleForgotReset} className="flex flex-col gap-0">
                          <label className="block text-sm text-text-secondary mb-1.5">Новый пароль</label>
                          <div className="relative mb-4">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              className="w-full h-11 pl-10 pr-10 text-sm bg-[#161616] border border-[#222222] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-[#00D4FF]/50 transition-colors"
                              placeholder="••••••••"
                              required
                              minLength={8}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                            >
                              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>

                          <PasswordStrength password={newPassword} />

                          <label className="block text-sm text-text-secondary mb-1.5">Подтвердите пароль</label>
                          <div className="relative mb-4">
                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                              type={showNewConfirm ? 'text' : 'password'}
                              value={confirmNewPassword}
                              onChange={e => setConfirmNewPassword(e.target.value)}
                              className="w-full h-11 pl-10 pr-10 text-sm bg-[#161616] border border-[#222222] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-[#00D4FF]/50 transition-colors"
                              placeholder="••••••••"
                              required
                              minLength={8}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewConfirm(!showNewConfirm)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                            >
                              {showNewConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>

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

                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 rounded-pill text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                            style={{
                              background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                              color: '#060606',
                            }}
                          >
                            {loading ? 'Загрузка...' : 'Сохранить пароль'}
                          </button>
                        </form>
                      )}

                      {forgotStep === 'success' && (
                        <div className="flex flex-col items-center py-4">
                          <CheckCircle size={64} className="text-emerald-400 mb-4" />
                          <p className="text-sm text-text-secondary text-center mb-6">
                            Ваш пароль успешно изменён. Теперь вы можете пользоваться аккаунтом.
                          </p>
                          <button
                            onClick={handleClose}
                            className="w-full h-11 rounded-pill text-sm font-semibold transition-all hover:brightness-110"
                            style={{
                              background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                              color: '#060606',
                            }}
                          >
                            Начать
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
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

                      {/* Title / степпер (ТЗ-119: в register заголовок — степпер, в login — h3) */}
                      {mode === 'register' ? (
                        <>
                          <div className="flex items-center mb-2">
                            {([1, 2, 3] as const).map((s, i) => (
                              <Fragment key={s}>
                                {i > 0 && (
                                  <div
                                    className="flex-1 h-[2px] mx-2 rounded-[1px] overflow-hidden"
                                    style={{ backgroundColor: '#2A2A2A' }}
                                  >
                                    <div
                                      className="h-full"
                                      style={{
                                        backgroundColor: '#00D4FF',
                                        width: regStep > s - 1 ? '100%' : '0%',
                                        transition: 'width .35s cubic-bezier(.16,1,.3,1)',
                                      }}
                                    />
                                  </div>
                                )}
                                <div
                                  className="flex items-center justify-center rounded-full"
                                  style={{
                                    width: 30,
                                    height: 30,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    transition: '.3s',
                                    backgroundColor: regStep === s ? '#00D4FF' : regStep > s ? 'rgba(0,212,255,.12)' : '#1C1C1C',
                                    border: `1px solid ${regStep === s || regStep > s ? '#00D4FF' : '#2A2A2A'}`,
                                    color: regStep === s ? '#060606' : regStep > s ? '#00D4FF' : '#6B7280',
                                    boxShadow: regStep === s ? '0 0 16px rgba(0,212,255,.35)' : undefined,
                                  }}
                                >
                                  {regStep > s ? <Check size={14} color="#00D4FF" /> : s}
                                </div>
                              </Fragment>
                            ))}
                          </div>
                          <p
                            className="text-center text-[12px] mb-[22px]"
                            style={{ color: '#6B7280', letterSpacing: '.04em' }}
                          >
                            Шаг {regStep} из 3
                          </p>
                        </>
                      ) : (
                        <h3 className="text-center text-lg font-semibold mb-5">Вход</h3>
                      )}

                      {mode === 'register' ? (
                        /* ═══ Регистрация: 3 шага (ТЗ-119) ═══ */
                        <div className="relative min-h-[258px]">
                          <AnimatePresence mode="wait" initial={false}>
                            {regStep === 1 && (
                              <motion.form
                                key="reg-step-1"
                                onSubmit={handleStep1}
                                initial={{ opacity: 0, x: 48 * stepDir }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -48 * stepDir }}
                                transition={{ duration: 0.3, x: { ease: [0.16, 1, 0.3, 1] } }}
                              >
                                <h4 className="text-[20px] font-bold tracking-[-0.02em] mb-1.5 text-white">
                                  Как к вам обращаться?
                                </h4>
                                <p className="text-[13px] leading-[1.5] mb-5" style={{ color: '#6B7280' }}>
                                  InsidePulse обращается по имени — как и положено личному аналитику.
                                </p>
                                <div className="relative">
                                  <User
                                    size={17}
                                    className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                                    style={{ left: 14, color: '#6B7280' }}
                                  />
                                  <input
                                    ref={usernameRef}
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    autoComplete="nickname"
                                    className="w-full h-12 text-[15px] text-white rounded-xl focus:outline-none"
                                    style={{
                                      backgroundColor: '#161616',
                                      border: '1px solid #2A2A2A',
                                      paddingLeft: 42,
                                      paddingRight: 44,
                                      transition: 'border-color .2s',
                                    }}
                                    onFocus={e => { e.target.style.borderColor = '#00D4FF' }}
                                    onBlur={e => { e.target.style.borderColor = '#2A2A2A' }}
                                  />
                                </div>
                                {/* Зарезервированная высота — layout не прыгает */}
                                <p
                                  className="min-h-[20px] text-[12.5px] mt-1.5"
                                  style={{ color: '#F87171', opacity: stepHint ? 1 : 0, transition: 'opacity .2s' }}
                                >
                                  {stepHint || ' '}
                                </p>
                                <button
                                  type="submit"
                                  className="w-full h-[46px] rounded-pill font-bold text-[15px] transition-all hover:brightness-110 active:scale-[.98]"
                                  style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                                >
                                  Вперёд →
                                </button>
                              </motion.form>
                            )}

                            {regStep === 2 && (
                              <motion.form
                                key="reg-step-2"
                                onSubmit={handleStep2}
                                initial={{ opacity: 0, x: 48 * stepDir }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -48 * stepDir }}
                                transition={{ duration: 0.3, x: { ease: [0.16, 1, 0.3, 1] } }}
                              >
                                <h4 className="text-[20px] font-bold tracking-[-0.02em] mb-1.5 text-white">
                                  Ваша почта
                                </h4>
                                <p className="text-[13px] leading-[1.5] mb-5" style={{ color: '#6B7280' }}>
                                  Нужна, чтобы восстановить доступ и уведомлять о важных событиях.
                                </p>
                                <div className="relative">
                                  <Mail
                                    size={17}
                                    className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                                    style={{ left: 14, color: '#6B7280' }}
                                  />
                                  <input
                                    ref={emailRef}
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    autoComplete="email"
                                    placeholder="your@email.com"
                                    className="w-full h-12 text-[15px] text-white rounded-xl focus:outline-none placeholder:text-[#6B7280]"
                                    style={{
                                      backgroundColor: '#161616',
                                      border: '1px solid #2A2A2A',
                                      paddingLeft: 42,
                                      paddingRight: 44,
                                      transition: 'border-color .2s',
                                    }}
                                    onFocus={e => { e.target.style.borderColor = '#00D4FF' }}
                                    onBlur={e => { e.target.style.borderColor = '#2A2A2A' }}
                                  />
                                </div>
                                <p
                                  className="min-h-[20px] text-[12.5px] mt-1.5"
                                  style={{ color: '#F87171', opacity: stepHint ? 1 : 0, transition: 'opacity .2s' }}
                                >
                                  {stepHint || ' '}
                                </p>
                                <div className="flex gap-[10px]">
                                  <button
                                    type="button"
                                    onClick={() => goStep(1)}
                                    className="px-[22px] h-[46px] rounded-pill text-[15px] font-medium transition-colors"
                                    style={{
                                      backgroundColor: 'transparent',
                                      border: '1px solid #2A2A2A',
                                      color: '#9CA3AF',
                                    }}
                                    onMouseEnter={e => {
                                      e.currentTarget.style.color = '#FFFFFF'
                                      e.currentTarget.style.borderColor = '#3A3A3A'
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.color = '#9CA3AF'
                                      e.currentTarget.style.borderColor = '#2A2A2A'
                                    }}
                                  >
                                    ← Назад
                                  </button>
                                  <button
                                    type="submit"
                                    className="flex-1 h-[46px] rounded-pill font-bold text-[15px] transition-all hover:brightness-110 active:scale-[.98]"
                                    style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
                                  >
                                    Вперёд →
                                  </button>
                                </div>
                              </motion.form>
                            )}

                            {regStep === 3 && (
                              <motion.form
                                key="reg-step-3"
                                onSubmit={handleSubmit}
                                initial={{ opacity: 0, x: 48 * stepDir }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -48 * stepDir }}
                                transition={{ duration: 0.3, x: { ease: [0.16, 1, 0.3, 1] } }}
                              >
                                <h4 className="text-[20px] font-bold tracking-[-0.02em] mb-1.5 text-white">
                                  Придумайте пароль
                                </h4>
                                {/* Живой счётчик — ключевая фича мокапа */}
                                <motion.p
                                  key={`pwd-err-${pwdShakeTick}`}
                                  initial={false}
                                  animate={pwdShakeTick ? { x: [0, -3, 0, 3, 0] } : { x: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="text-[13px] leading-[1.5] mb-5"
                                  style={{
                                    color: pwdSubmitError
                                      ? '#F87171'
                                      : password.length === 0 || password.length < 8
                                        ? '#6B7280'
                                        : '#00D4FF',
                                    transition: 'color .25s',
                                  }}
                                >
                                  {pwdSubmitError
                                    ? password.length === 0
                                      ? 'Введите пароль — минимум 8 символов'
                                      : `Не хватает ${8 - password.length} ${pluralSymbols(8 - password.length)}`
                                    : password.length === 0
                                      ? 'Минимум 8 символов. Последний шаг — честно.'
                                      : password.length < 8
                                        ? `Ещё ${8 - password.length} ${pluralSymbols(8 - password.length)} — и кнопка зажгётся`
                                        : 'Пароль готов ✓'}
                                </motion.p>
                                <div className="relative">
                                  <Lock
                                    size={17}
                                    className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                                    style={{ left: 14, color: '#6B7280' }}
                                  />
                                  <input
                                    ref={passwordRef}
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => {
                                      setPassword(e.target.value)
                                      setPwdSubmitError(false)
                                    }}
                                    autoComplete="new-password"
                                    placeholder="Пароль"
                                    className="w-full h-12 text-[15px] text-white rounded-xl focus:outline-none placeholder:text-[#6B7280]"
                                    style={{
                                      backgroundColor: '#161616',
                                      border: '1px solid #2A2A2A',
                                      paddingLeft: 42,
                                      paddingRight: 44,
                                      transition: 'border-color .2s',
                                    }}
                                    onFocus={e => { e.target.style.borderColor = '#00D4FF' }}
                                    onBlur={e => { e.target.style.borderColor = '#2A2A2A' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute top-1/2 -translate-y-1/2 transition-colors"
                                    style={{ right: 14, color: '#6B7280' }}
                                  >
                                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                  </button>
                                </div>

                                {/* Согласие — кастомный чекбокс по мокапу */}
                                <div className="flex items-start gap-2 mt-4">
                                  <motion.button
                                    key={`agree-${agreeShakeTick}`}
                                    type="button"
                                    role="checkbox"
                                    aria-checked={agreed}
                                    onClick={() => {
                                      setAgreed(!agreed)
                                      setAgreeError(false)
                                    }}
                                    initial={false}
                                    animate={agreeShakeTick ? { x: [0, -3, 0, 3, 0] } : { x: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="flex items-center justify-center shrink-0 mt-0.5"
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 5,
                                      backgroundColor: agreed ? '#00D4FF' : '#161616',
                                      border: `1.5px solid ${agreeError ? '#F87171' : agreed ? '#00D4FF' : '#2A2A2A'}`,
                                      boxShadow: agreeError ? '0 0 10px rgba(248,113,113,.35)' : undefined,
                                      transition: 'background-color .2s, border-color .2s',
                                    }}
                                  >
                                    {agreed && <Check size={12} color="#060606" strokeWidth={3} />}
                                  </motion.button>
                                  <span className="text-[12px] leading-[1.5]" style={{ color: '#6B7280' }}>
                                    Я согласен с{' '}
                                    <Link to="/terms" className="text-[#00D4FF] hover:underline" onClick={handleClose}>Условиями использования</Link>{' '}
                                    и{' '}
                                    <Link to="/privacy" className="text-[#00D4FF] hover:underline" onClick={handleClose}>Политикой конфиденциальности</Link>
                                  </span>
                                </div>
                                <p
                                  className="min-h-[18px] text-[12.5px] mt-1"
                                  style={{ color: '#F87171', opacity: agreeError ? 1 : 0, transition: 'opacity .2s' }}
                                >
                                  Без согласия аккаунт не создать — отметьте галочку
                                </p>

                                {/* Серверные ошибки register() */}
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

                                {!isStoragePersistent && (
                                  <div className="flex items-start gap-2 rounded-lg p-3 mb-4 text-xs" style={{ backgroundColor: 'rgba(251, 191, 36, 0.10)', color: '#FBBF24' }}>
                                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                    <span>
                                      Хранилище заблокировано. Сессия не сохранится после закрытия вкладки — включите cookies/данные сайта.
                                    </span>
                                  </div>
                                )}

                                <div className="flex gap-[10px]">
                                  <button
                                    type="button"
                                    onClick={() => goStep(2)}
                                    className="px-[22px] h-[46px] rounded-pill text-[15px] font-medium transition-colors"
                                    style={{
                                      backgroundColor: 'transparent',
                                      border: '1px solid #2A2A2A',
                                      color: '#9CA3AF',
                                    }}
                                    onMouseEnter={e => {
                                      e.currentTarget.style.color = '#FFFFFF'
                                      e.currentTarget.style.borderColor = '#3A3A3A'
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.color = '#9CA3AF'
                                      e.currentTarget.style.borderColor = '#2A2A2A'
                                    }}
                                  >
                                    ← Назад
                                  </button>
                                  {/* Кнопка «Создать аккаунт» — зажигается при 8 символах (ТЗ-119) */}
                                  <BorderGlow
                                    animated
                                    glowColor="192 100 50"
                                    backgroundColor="#0E0E0E"
                                    borderRadius={9999}
                                    glowRadius={40}
                                    glowIntensity={1.4}
                                    lit={password.length >= 8}
                                    sweepSignal={igniteCount}
                                    className="flex-1"
                                  >
                                    <button
                                      type="submit"
                                      disabled={loading}
                                      className="w-full h-[46px] rounded-pill bg-transparent text-[15px] font-medium"
                                      style={{
                                        color: password.length >= 8 ? '#FFFFFF' : '#6B7280',
                                        transition: 'color .35s',
                                      }}
                                    >
                                      {loading ? 'Загрузка...' : 'Создать аккаунт'}
                                    </button>
                                  </BorderGlow>
                                </div>
                              </motion.form>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        /* ═══ Вход (ТЗ-119 не меняет) ═══ */
                        <form onSubmit={handleSubmit} className="flex flex-col gap-0">

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

                          {/* Forgot password (login only) */}
                          <div className="flex justify-end mt-1 mb-4">
                            <button
                              type="button"
                              onClick={() => switchMode('forgot')}
                              className="text-xs text-[#00D4FF] hover:underline"
                            >
                              Забыли пароль?
                            </button>
                          </div>

                          {/* Remember me (login) */}
                          <label className="flex items-center gap-2 mb-4 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rememberMe}
                              onChange={e => setRememberMe(e.target.checked)}
                              className="w-4 h-4 rounded accent-[#00D4FF]"
                            />
                            <span className="text-sm text-text-muted">Запомнить меня</span>
                          </label>

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
                          {!isStoragePersistent && (
                            <div className="flex items-start gap-2 rounded-lg p-3 mb-4 text-xs" style={{ backgroundColor: 'rgba(251, 191, 36, 0.10)', color: '#FBBF24' }}>
                              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                              <span>
                                Хранилище заблокировано. Сессия не сохранится после закрытия вкладки — включите cookies/данные сайта.
                              </span>
                            </div>
                          )}
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 rounded-pill text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                            style={{
                              background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                              color: '#060606',
                            }}
                          >
                            {loading ? 'Загрузка...' : 'Войти'}
                          </button>
                        </form>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
