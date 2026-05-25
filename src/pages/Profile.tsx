import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { User, Shield, Calendar, Newspaper, LogOut, ArrowLeft, Trash2 } from 'lucide-react'

interface ProfileStats {
  newsCount: number
  memberSince: string
}

export default function Profile() {
  const { user, isLoggedIn, logout } = useAuth()
  const [stats, setStats] = useState<ProfileStats>({ newsCount: 0, memberSince: '' })
  const [portfolio, setPortfolio] = useState<Array<{id: string; tag_name: string; tag_type: string}>>([])

  useEffect(() => {
    if (!user?.id) return
    const token = localStorage.getItem('pulse_token')
    
    // Fetch profile stats
    fetch('https://pulse-api-bsov.onrender.com/api/user/profile', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setStats({
        newsCount: data.stats?.newsCount || 0,
        memberSince: data.stats?.memberSince 
          ? new Date(data.stats.memberSince).toLocaleDateString('ru-RU') 
          : ''
      }))
      .catch(() => {})

    // Fetch portfolio
    fetch('https://pulse-api-bsov.onrender.com/api/user/portfolio', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setPortfolio(data.tags || []))
      .catch(() => {})
  }, [user?.id])

  const handleDeleteTag = (tagId: string) => {
    const token = localStorage.getItem('pulse_token')
    fetch(`https://pulse-api-bsov.onrender.com/api/user/portfolio/${tagId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        if (r.ok) setPortfolio(prev => prev.filter(t => t.id !== tagId))
      })
      .catch(() => {})
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center">
        <div className="text-center">
          <User className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="mb-4 text-slate-400">Войдите, чтобы увидеть профиль</p>
          <Link to="/login" className="px-6 py-2 bg-[#00D4FF] text-black font-medium rounded-lg hover:bg-[#00D4FF]/90 transition-colors">
            Войти
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
            <span>Назад</span>
          </Link>
          <h1 className="text-2xl font-bold">Профиль</h1>
        </div>

        {/* User Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-[#00D4FF]/10 flex items-center justify-center flex-shrink-0">
              <User className="text-[#00D4FF]" size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold mb-1">{user?.username || 'Пользователь'}</h2>
              <p className="text-slate-400 text-sm mb-3">{user?.email}</p>
              
              <div className="flex flex-wrap gap-3">
                {stats.memberSince && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar size={14} />
                    <span>С нами с {stats.memberSince}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Newspaper size={14} />
                  <span>Изучено новостей: {stats.newsCount}</span>
                </div>
                {user?.isAdmin && (
                  <div className="flex items-center gap-1.5 text-xs text-purple-400">
                    <Shield size={14} />
                    <span>Администратор</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio Tags */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Newspaper size={18} className="text-[#00D4FF]" />
            Мои теги
          </h3>
          {portfolio.length === 0 ? (
            <p className="text-slate-500 text-sm">Нет отслеживаемых тегов. Добавьте на главной странице.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {portfolio.map(tag => (
                <div 
                  key={tag.id} 
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#161616] border border-[#222] text-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-[#00D4FF]" />
                  <span>{tag.tag_name}</span>
                  <button 
                    onClick={() => handleDeleteTag(tag.id)}
                    className="ml-1 text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors"
          >
            <LogOut size={18} />
            <span>Выйти</span>
          </button>
        </div>
      </div>
    </div>
  )
}
