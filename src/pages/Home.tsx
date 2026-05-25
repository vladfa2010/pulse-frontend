import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { TrendingUp, Zap, Shield, ChevronRight } from 'lucide-react'

export default function Home() {
  const { isLoggedIn, user, demoLogin } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="text-2xl font-bold">
          P<span className="text-cyan-400">UL</span>SE
        </div>
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <>
              <Link to="/profile" className="text-sm hover:text-cyan-400">{user?.username}</Link>
              <Link to="/news" className="text-sm hover:text-cyan-400">Новости</Link>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm hover:text-cyan-400">Войти</Link>
              <Link to="/login" className="px-4 py-2 bg-cyan-500 rounded-lg text-sm font-medium hover:bg-cyan-400">
                Начать
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-5xl font-bold mb-6">
          Инвестиционные новости
          <br />
          <span className="text-cyan-400">в одном месте</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-xl mb-8">
          Следите за рынками, компаниями и трендами. Персональная лента на основе ваших интересов.
        </p>
        <div className="flex gap-4">
          {isLoggedIn ? (
            <Link to="/news" className="px-8 py-3 bg-cyan-500 rounded-xl font-medium hover:bg-cyan-400 flex items-center gap-2">
              Моя лента <ChevronRight size={18} />
            </Link>
          ) : (
            <>
              <button onClick={() => demoLogin()} className="px-8 py-3 bg-cyan-500 rounded-xl font-medium hover:bg-cyan-400">
                Демо-вход
              </button>
              <Link to="/login" className="px-8 py-3 border border-white/20 rounded-xl font-medium hover:bg-white/5">
                Создать аккаунт
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto px-6 py-16">
        <FeatureCard icon={<Zap className="w-6 h-6 text-cyan-400" />} title="RSS-агрегатор" desc="32 источника, обновление каждые 15 минут" />
        <FeatureCard icon={<TrendingUp className="w-6 h-6 text-green-400" />} title="Сентимент-анализ" desc="Определение тональности каждой новости" />
        <FeatureCard icon={<Shield className="w-6 h-6 text-purple-400" />} title="Персональная лента" desc="Только новости по вашим тегам" />
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500">
        <div className="flex justify-center gap-6 mb-4">
          <Link to="/terms" className="hover:text-white">Условия</Link>
          <Link to="/privacy" className="hover:text-white">Конфиденциальность</Link>
          <Link to="/pricing" className="hover:text-white">Тарифы</Link>
        </div>
        © 2025 PULSE
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-400">{desc}</p>
    </div>
  )
}
