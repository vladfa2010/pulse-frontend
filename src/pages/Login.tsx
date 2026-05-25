import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'

export default function Login() {
  const { login, register, demoLogin } = useAuth()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { success, error } = await login(email, password)
    setLoading(false)
    if (!success && error) setError(error)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Пароль минимум 8 символов'); return }
    setLoading(true)
    const { success, error } = await register(username, email, password)
    setLoading(false)
    if (!success && error) setError(error)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold mb-2">P<span className="text-cyan-400">UL</span>SE</div>
          <p className="text-slate-400">Вход в систему</p>
        </div>

        <div className="flex rounded-lg bg-white/5 p-1 mb-6">
          <button onClick={() => { setTab('login'); setError('') }} className={`flex-1 py-2 rounded-md text-sm font-medium ${tab === 'login' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}>Вход</button>
          <button onClick={() => { setTab('register'); setError('') }} className={`flex-1 py-2 rounded-md text-sm font-medium ${tab === 'register' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}>Регистрация</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
        )}

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" required />
            <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" required />
            <button type="submit" disabled={loading} className="w-full p-3 bg-cyan-500 rounded-lg font-medium hover:bg-cyan-400 disabled:opacity-50">{loading ? 'Вход...' : 'Войти'}</button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <input type="text" placeholder="Имя пользователя" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" required />
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" required />
            <input type="password" placeholder="Пароль (мин. 8 символов)" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" required />
            <button type="submit" disabled={loading} className="w-full p-3 bg-cyan-500 rounded-lg font-medium hover:bg-cyan-400 disabled:opacity-50">{loading ? 'Создание...' : 'Создать аккаунт'}</button>
          </form>
        )}

        <div className="mt-4 text-center">
          <button onClick={() => demoLogin()} className="text-sm text-cyan-400 hover:underline">Демо-вход (без регистрации)</button>
        </div>

        <div className="mt-6 text-center text-sm">
          <Link to="/" className="text-slate-400 hover:text-white">← На главную</Link>
        </div>
      </div>
    </div>
  )
}
