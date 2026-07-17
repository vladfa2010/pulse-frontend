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
 *   3. Поиск по словам через backend: GET /api/news/search?q=...&tag=...
 *      Ищет по title_ru, title_original, summary_ru, summary_original.
 *      Если выбран тег — ограничивает поиск статьями с этим тегом.
 *   4. При клике на тег на главной → ?tag=tagname показывает только этот тег
 *
 * Отличие от "Это вы ещё не видели":
 *   - Там: ТОЛЬКО непрочитанные (для быстрого просмотра)
 *   - Здесь: ВСЕ новости (для глубокого изучения)
 */

import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { logAnalyticsEvent } from '@/lib/analytics'
import { ArrowLeft, Newspaper, Search } from 'lucide-react'
import NewsCard from '@/components/NewsCard'
import TagEnrichment from '@/components/TagEnrichment'
import type { NewsArticle } from '@/types/news'

interface TagItem {
  id: string
  tag_id: string
  tag_name: string
}

export default function NewsFeed() {
  const { isLoggedIn } = useAuth()
  const [searchParams] = useSearchParams()
  const urlTag = searchParams.get('tag')  // ← ?tag=Сбербанк из URL

  const [tags, setTags] = useState<TagItem[]>([])
  const [tagsLoaded, setTagsLoaded] = useState(false)
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [filter, setFilter] = useState('')
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [activeTagName, setActiveTagName] = useState<string | null>(urlTag)
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()

  // Маппинг tag_id → tag_name для отображения всех тегов
  const tagsMap = useMemo(() => new Map(tags.map(t => [t.tag_id, t.tag_name])), [tags])

  // ─── Загрузка тегов пользователя ──────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return }

    api.get('/user/tags')
      .then(data => {
        const t = data.tags || []
        setTags(t)
        if (urlTag && t.length > 0) {
          const matched = t.find((tag: TagItem) => tag.tag_name === urlTag || tag.tag_id === urlTag)
          if (matched) {
            setActiveTagId(matched.tag_id)
            setActiveTagName(matched.tag_name)
          }
        }
        setTagsLoaded(true)
      })
      .catch((err) => {
        console.error('[NewsFeed] tags load error:', err)
        setTagsLoaded(true)
      })
  }, [isLoggedIn, urlTag])

  // ─── Загрузка новостей: поиск или обычная лента ───────────────────────
  useEffect(() => {
    if (!isLoggedIn || !tagsLoaded) return

    const timer = setTimeout(() => {
      if (filter.trim()) {
        loadArticlesSearch(filter, activeTagId)
      } else {
        loadArticles(activeTagId)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [filter, activeTagId, isLoggedIn, tagsLoaded])

  const loadArticles = (tagId: string | null) => {
    setLoading(true)
    const endpoint = tagId
      ? `/news/tags/${encodeURIComponent(tagId)}`
      : '/news?all=true'
    api.get(endpoint)
      .then(data => setArticles(data.articles || []))
      .catch((err) => { console.error('[NewsFeed] loadArticles error:', err) })
      .finally(() => setLoading(false))
  }

  const loadArticlesSearch = (q: string, tagId: string | null) => {
    setLoading(true)
    const params = new URLSearchParams({ q: q.trim(), limit: '50' })
    if (tagId) params.set('tag', tagId)
    api.get(`/news/search?${params.toString()}`)
      .then(data => setArticles(data.articles || []))
      .catch((err) => { console.error('[NewsFeed] loadArticlesSearch error:', err) })
      .finally(() => setLoading(false))
  }

  // ─── Открыть детальную карточку и отметить как прочитанную ────────────
  const handleCardClick = (article: NewsArticle) => {
    logAnalyticsEvent('select_content', { content_type: 'news', item_id: article.id, title: article.title_ru || article.title_original || '' })
    api.post(`/news/${article.id}/read`, {}).catch(() => {})
    navigate(`/news/${article.slug}`, { state: { background: location } })
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
              onClick={() => { setActiveTagId(null); setActiveTagName(null) }}
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
                key={tag.tag_id}
                onClick={() => { setActiveTagId(tag.tag_id); setActiveTagName(tag.tag_name); setFilter('') }}
                className="px-4 py-2 rounded-full text-sm transition-colors"
                style={{
                  backgroundColor: activeTagId === tag.tag_id ? 'rgba(0, 212, 255, 0.15)' : '#161616',
                  border: `1px solid ${activeTagId === tag.tag_id ? '#00D4FF' : '#222222'}`,
                  color: activeTagId === tag.tag_id ? '#00D4FF' : '#9CA3AF',
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
        ) : articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article, i) => (
              <div key={article.id} onClick={() => handleCardClick(article)} className="cursor-pointer">
                <NewsCard article={article} index={i} tagsMap={tagsMap} />
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
