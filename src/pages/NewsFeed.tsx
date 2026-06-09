/**
 * =============================================================================
 * PULSE — Лента новостей (NewsFeed)
 * =============================================================================
 *
 * Страница для ОБУЧЕНИЯ: показывает ВСЕ новости (и прочитанные, и нет).
 *
 * Логика:
 *   1. Загружает ВСЕ новости: GET /api/news?all=true
 *      (параметр all=true отключает фильтр непрочитанных)
 *   2. Фильтр по тегам пользователя (кнопки)
 *   3. Поиск по заголовку
 *   4. При клике на тег на главной → ?tag=tagname показывает только этот тег
 *
 * Отличие от "Это вы ещё не видели":
 *   - Там: ТОЛЬКО непрочитанные (для быстрого просмотра)
 *   - Здесь: ВСЕ новости (для глубокого изучения)
 */

import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { ArrowLeft, Newspaper, Search } from 'lucide-react'
import NewsCard from '@/components/NewsCard'
import TagEnrichment from '@/components/TagEnrichment'

interface NewsArticle {
  id: string
  title_ru: string
  source: string
  published_at: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  tag?: string
}

interface TagItem {
  id: string
  tag_name: string
}

export default function NewsFeed() {
  const { isLoggedIn } = useAuth()
  const [searchParams] = useSearchParams()
  const urlTag = searchParams.get('tag')  // ← ?tag=Сбербанк из URL

  const [tags, setTags] = useState<TagItem[]>([])
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [filter, setFilter] = useState('')
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [activeTagName, setActiveTagName] = useState<string | null>(urlTag)
  const [loading, setLoading] = useState(true)

  // ─── Загрузка тегов и новостей ────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return }

    // Загружаем теги пользователя
    api.get('/user/tags')
      .then(data => {
        const t = data.tags || []
        setTags(t)
        // Если ?tag= в URL — ищем matching tag_id
        let targetTagId: string | null = null
        if (urlTag && t.length > 0) {
          const matched = t.find((tag: TagItem) => tag.tag_name === urlTag || tag.id === urlTag)
          if (matched) {
            setActiveTagId(matched.id)
            setActiveTagName(matched.tag_name)
            targetTagId = matched.id
          }
        }
        if (t.length > 0) loadArticles(targetTagId)
        else setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [isLoggedIn, urlTag])

  // ─── Загрузка новостей: по тегу ИЛИ все ───────────────────────────────
  const loadArticles = (tagId: string | null) => {
    setLoading(true)
    const endpoint = tagId
      ? `/news/tags/${encodeURIComponent(tagId)}`   // ← по конкретному тегу
      : '/news?all=true'                            // ← все новости
    api.get(endpoint)
      .then(data => {
        setArticles(data.articles || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  // ─── Фильтрация: только поиск ─────────────────────────────────────────
  const filtered = articles.filter(a => {
    const matchSearch = !filter || a.title_ru.toLowerCase().includes(filter.toLowerCase())
    return matchSearch
  })

  // ─── Отметить как прочитанную (при клике) ─────────────────────────────
  const handleCardClick = (newsId: string) => {
    api.post(`/news/${newsId}/read`, {}).catch(() => {})
  }

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
          <span className="text-xs text-text-muted ml-2">(все новости)</span>
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
              onClick={() => { setActiveTagId(null); setActiveTagName(null); loadArticles(null) }}
              className="px-4 py-2 rounded-full text-sm transition-colors"
              style={{
                backgroundColor: !activeTagId ? 'rgba(0, 212, 255, 0.15)' : '#161616',
                border: `1px solid ${!activeTagId ? '#00D4FF' : '#222222'}`,
                color: !activeTagId ? '#00D4FF' : '#9CA3AF',
              }}
            >
              Все
            </button>
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => { setActiveTagId(tag.id); setActiveTagName(tag.tag_name); loadArticles(tag.id) }}
                className="px-4 py-2 rounded-full text-sm transition-colors"
                style={{
                  backgroundColor: activeTagId === tag.id ? 'rgba(0, 212, 255, 0.15)' : '#161616',
                  border: `1px solid ${activeTagId === tag.id ? '#00D4FF' : '#222222'}`,
                  color: activeTagId === tag.id ? '#00D4FF' : '#9CA3AF',
                }}
              >
                {tag.tag_name}
              </button>
            ))}
          </div>
        )}

        {/* Tag enrichment card — показываем когда выбран тег */}
        {activeTagName && <TagEnrichment tagName={activeTagName} />}

        {/* News grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((article, i) => (
              <div key={article.id} onClick={() => handleCardClick(article.id)} className="cursor-pointer">
                <NewsCard article={article} index={i} tagLabel={article.tag} />
              </div>
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
