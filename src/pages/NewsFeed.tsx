import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { ArrowLeft, Newspaper, Search } from 'lucide-react'
import NewsCard from '@/components/NewsCard'

interface NewsArticle {
  id: string
  title_ru: string
  source: string
  published_at: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  tag: string
}

interface TagItem {
  id: string
  tag_name: string
}

export default function NewsFeed() {
  const { isLoggedIn } = useAuth()
  const [tags, setTags] = useState<TagItem[]>([])
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [filter, setFilter] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return }

    api.get('/user/portfolio')
      .then(data => {
        const t = data.tags || []
        setTags(t)
        if (t.length > 0) loadArticles()
        else setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [isLoggedIn])

  const loadArticles = () => {
    setLoading(true)
    api.get('/news')
      .then(data => setArticles(data.news || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const filtered = articles.filter(a => {
    const matchTag = !activeTag || a.tag === activeTag
    const matchSearch = !filter || a.title_ru.toLowerCase().includes(filter.toLowerCase())
    return matchTag && matchSearch
  })

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center">
        <div className="text-center">
          <Newspaper className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="mb-4 text-text-secondary">Войдите, чтобы увидеть ленту новостей</p>
          <Link to="/" className="text-[#00D4FF] hover:underline">На главную</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} />
            <span>Назад</span>
          </Link>
          <h1 className="text-2xl font-bold">Лента новостей</h1>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#161616] border border-[#222222] text-text-primary placeholder-text-muted focus:outline-none focus:border-[#00D4FF] transition-colors"
            placeholder="Поиск по новостям..."
          />
        </div>

        {/* Tag filters */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveTag(null)}
              className="px-4 py-2 rounded-full text-sm transition-colors"
              style={{
                backgroundColor: !activeTag ? 'rgba(0, 212, 255, 0.15)' : '#161616',
                border: `1px solid ${!activeTag ? '#00D4FF' : '#222222'}`,
                color: !activeTag ? '#00D4FF' : '#9CA3AF',
              }}
            >
              Все
            </button>
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => setActiveTag(tag.tag_name)}
                className="px-4 py-2 rounded-full text-sm transition-colors"
                style={{
                  backgroundColor: activeTag === tag.tag_name ? 'rgba(0, 212, 255, 0.15)' : '#161616',
                  border: `1px solid ${activeTag === tag.tag_name ? '#00D4FF' : '#222222'}`,
                  color: activeTag === tag.tag_name ? '#00D4FF' : '#9CA3AF',
                }}
              >
                {tag.tag_name}
              </button>
            ))}
          </div>
        )}

        {/* News grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((article, i) => (
              <NewsCard key={article.id} article={article} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-text-muted">
            <Newspaper size={32} className="mx-auto mb-3 opacity-40" />
            <p>{articles.length === 0 ? 'Новостей пока нет' : 'Ничего не найдено'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
