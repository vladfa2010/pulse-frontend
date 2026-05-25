import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { ArrowLeft, Clock, Tag } from 'lucide-react'

interface Article {
  id: string
  title_ru: string
  source: string
  published_at: string
  sentiment: string
  matched_tags: string[]
}

export default function NewsFeed() {
  const { isLoggedIn } = useAuth()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return }
    api.get('/news')
      .then(data => { setArticles(data.articles || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [isLoggedIn])

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">Войдите, чтобы увидеть ленту</p>
          <Link to="/login" className="px-6 py-2 bg-cyan-500 rounded-lg hover:bg-cyan-400">Войти</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-slate-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <h1 className="text-xl font-bold">Моя лента</h1>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Загрузка...</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Новостей пока нет. Добавьте теги в профиле.</div>
        ) : (
          <div className="space-y-4">
            {articles.map(a => (
              <div key={a.id} className={`p-4 rounded-xl border ${getSentimentColor(a.sentiment)}`}>
                <h3 className="font-medium mb-2">{a.title_ru}</h3>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>{a.source}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {new Date(a.published_at).toLocaleString('ru-RU')}</span>
                  {a.matched_tags?.[0] && (
                    <span className="flex items-center gap-1"><Tag size={12} /> {a.matched_tags[0]}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getSentimentColor(s: string) {
  if (s === 'positive') return 'bg-green-500/5 border-green-500/10'
  if (s === 'negative') return 'bg-red-500/5 border-red-500/10'
  return 'bg-white/5 border-white/10'
}
