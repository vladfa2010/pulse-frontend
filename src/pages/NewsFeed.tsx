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
 *   4. Состояние фильтров синхронизируется с URL:
 *      - ?tag=<имя тега>
 *      - ?q=<поиск>
 *      - ?tag=<имя>&q=<поиск>
 *      Ссылки стали шерабельными, back/forward работают, F5 сохраняет выборку.
 *
 * Отличие от "Это вы ещё не видели":
 *   - Там: ТОЛЬКО непрочитанные (для быстрого просмотра)
 *   - Здесь: ВСЕ новости (для глубокого изучения)
 */

import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { api } from '@/lib/api'
import { logAnalyticsEvent } from '@/lib/analytics'
import { useNewsChartPrefetch } from '@/hooks/useNewsChartPrefetch'
import { buildFeedParams, parseFeedParams } from '@/lib/feedParams'
import { ArrowLeft, Newspaper, Search } from 'lucide-react'
import NewsCard from '@/components/NewsCard'
// ТЗ-214: карусель курсов в выдаче поиска — общий CourseCard с витрины
import CourseCard, { type CourseCardData } from '@/components/CourseCard'
import CascadeStackCard from '@/components/CascadeStackCard'
import CascadeExpandProvider from '@/components/CascadeExpandProvider'
import CascadeExpandContainer from '@/components/cascades/CascadeExpandContainer'
import TagEnrichment from '@/components/TagEnrichment'
import SearchLessonCard from '@/components/SearchLessonCard'
import type { SearchLesson } from '@/components/SearchLessonCard'
import type { NewsArticle } from '@/types/news'

interface TagItem {
  id: string
  tag_id: string
  tag_name: string
}

// ТЗ-213: заголовок раздела выдачи 1:1 по мокапу e434e1b — label + pill-счётчик
// + градиентная линия + заметка (заметка скрыта на ≤640px через hidden sm:block).
function SearchSectionHeader({ label, count, note, cyan }: { label: string; count: number; note: string; cyan?: boolean }) {
  return (
    <div className="flex items-center gap-3" style={{ margin: '0 2px 14px' }}>
      <span
        className="text-[11px] font-bold uppercase"
        style={{ letterSpacing: '.14em', color: cyan ? 'rgba(0,212,255,.85)' : '#9CA3AF' }}
      >
        {label}
      </span>
      <span
        className="text-[10px] font-semibold rounded-full"
        style={{
          padding: '2px 8px',
          color: cyan ? 'rgba(0,212,255,.6)' : '#6B7280',
          border: `1px solid ${cyan ? 'rgba(0,212,255,.2)' : 'rgba(255,255,255,.12)'}`,
          backgroundColor: cyan ? 'rgba(0,212,255,.05)' : 'transparent',
        }}
      >
        {count}
      </span>
      <div
        className="flex-1"
        style={{
          height: 1,
          background: cyan
            ? 'linear-gradient(90deg, rgba(0,212,255,.3), rgba(0,212,255,.04) 60%, transparent)'
            : 'linear-gradient(90deg, rgba(255,255,255,.14), rgba(255,255,255,.03) 70%, transparent)',
        }}
      />
      <span className="hidden sm:block text-[11px]" style={{ color: '#6B7280' }}>{note}</span>
    </div>
  )
}

export default function NewsFeed() {
  const { isLoggedIn } = useAuth()
  const { open: openAuthModal } = useAuthModal()
  const [searchParams, setSearchParams] = useSearchParams()
  const { q: urlQuery } = parseFeedParams(searchParams)

  const [tags, setTags] = useState<TagItem[]>([])
  const [tagsLoaded, setTagsLoaded] = useState(false)
  const [articles, setArticles] = useState<NewsArticle[]>([])
  // ТЗ-213: смысловой раздел поиска — отдельный стейт: сервер отдаёт его
  // своим полем semantic { articles, total, hasMore }, пагинация независима
  // от exact (semantic_offset, квота 6 на порцию).
  const [semantic, setSemantic] = useState<{ articles: NewsArticle[]; total: number; hasMore: boolean } | null>(null)
  const [semanticLoading, setSemanticLoading] = useState(false)
  const [searchTotal, setSearchTotal] = useState<number | null>(null)
  // ТЗ-214: раздел «Курсы по теме» — поле courses ответа поиска;
  // null/пусто → раздел не рендерится. similarity остаётся в API (калибровка порога).
  const [searchCourses, setSearchCourses] = useState<CourseCardData[] | null>(null)
  // ТЗ-215: раздел «Уроки по теме» — поле lessons ответа поиска;
  // клик ведёт на страницу курса (гейт урока 401/403 не обходим).
  const [searchLessons, setSearchLessons] = useState<SearchLesson[] | null>(null)
  const [filter, setFilter] = useState(urlQuery ?? '')
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()

  // ТЗ-3.5: префетч графиков вперёд по вертикальной ленте
  useNewsChartPrefetch(articles, { current: null }, true)

  // ТЗ-122: трекинг просмотра ленты (page_view_feed)
  useEffect(() => {
    if (!isLoggedIn) return
    api.post('/events/page-view', { page: 'feed' }).catch(() => {})
  }, [isLoggedIn])

  // ТЗ-удаление-новости v1.3: NewsFeed живёт на локальном стейте (без React Query) —
  // инвалидация ключей его не обновит. Единственный слушатель события в проекте:
  // при удалении новости админом из NewsDetailModal убираем карточку из списка.
  useEffect(() => {
    const onDeleted = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      if (!id) return
      setArticles(prev => prev.filter(a => a.id !== id))
    }
    window.addEventListener('news:deleted', onDeleted)
    return () => window.removeEventListener('news:deleted', onDeleted)
  }, [])

  // Маппинг tag_id → tag_name для отображения всех тегов
  const tagsMap = useMemo(() => new Map(tags.map(t => [t.tag_id, t.tag_name])), [tags])
  // Имя выбранного тега вычисляем из URL + загруженных тегов — единый источник правды
  const activeTagName = activeTagId ? tagsMap.get(activeTagId) ?? null : null

  // ─── Загрузка тегов пользователя ──────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false)
      return
    }
    api.get('/user/tags')
      .then(data => {
        setTags(data.tags || [])
        setTagsLoaded(true)
      })
      .catch((err) => {
        console.error('[NewsFeed] tags load error:', err)
        setTagsLoaded(true)
      })
  }, [isLoggedIn])

  // ─── Синхронизация URL → state (back/forward, открытие по ссылке) ─────
  useEffect(() => {
    if (!tagsLoaded) return
    const { tag: nextTag, q: nextQ } = parseFeedParams(searchParams)
    const matched = nextTag
      ? tags.find((t: TagItem) => t.tag_name === nextTag || t.tag_id === nextTag) || null
      : null
    setActiveTagId(matched ? matched.tag_id : null)
    setFilter(nextQ ?? '')
  }, [searchParams, tagsLoaded, tags])

  // ─── Fallback: чужой тег → подставляем как поисковый запрос q ─────────
  useEffect(() => {
    if (!tagsLoaded) return
    const { tag: nextTag } = parseFeedParams(searchParams)
    if (!nextTag) return
    const matched = tags.find((t: TagItem) => t.tag_name === nextTag || t.tag_id === nextTag)
    if (!matched) {
      setSearchParams(buildFeedParams(null, nextTag), { replace: true })
    }
  }, [searchParams, tagsLoaded, tags, setSearchParams])

  // ─── Запись q в URL внутри debounce (replace, не засоряет историю) ────
  useEffect(() => {
    if (!isLoggedIn || !tagsLoaded) return
    const timer = setTimeout(() => {
      const currentTag = searchParams.get('tag')?.trim() || null
      const desiredQ = filter.trim() || null
      const desiredParams = buildFeedParams(currentTag, desiredQ)
      if (desiredParams.toString() !== searchParams.toString()) {
        setSearchParams(desiredParams, { replace: true })
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [filter, isLoggedIn, tagsLoaded, searchParams, setSearchParams])

  // ─── Загрузка новостей: поиск или обычная лента ───────────────────────
  // ТЗ-161: debounce 600 мс — семантика дёргает TEI на каждый запрос,
  // частоту запросов держим низкой.
  useEffect(() => {
    if (!isLoggedIn || !tagsLoaded) return

    const timer = setTimeout(() => {
      if (filter.trim()) {
        loadArticlesSearch(filter, activeTagId)
      } else {
        loadArticles(activeTagId)
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [filter, activeTagId, isLoggedIn, tagsLoaded])

  const loadArticles = (tagId: string | null) => {
    setLoading(true)
    setSemantic(null)
    setSearchTotal(null)
    setSearchCourses(null)
    setSearchLessons(null)
    const endpoint = tagId
      ? `/news/tags/${encodeURIComponent(tagId)}`
      : '/news?all=true'
    api.get(endpoint)
      .then(data => setArticles(data.articles || []))
      .catch((err) => { console.error('[NewsFeed] loadArticles error:', err) })
      .finally(() => setLoading(false))
  }

  // ТЗ-214: бэк отдаёт source_title строкой, CourseCard ест source { title }.
  const mapSearchCourses = (raw: any): CourseCardData[] =>
    (raw || []).map((c: any) => ({
      slug: c.slug,
      title: c.title,
      cover_url: c.cover_url ?? null,
      type: c.type,
      size: c.size,
      price: c.price,
      badges: c.badges ?? [],
      category: c.category ?? null,
      source: c.source_title ? { title: c.source_title } : null,
      lessons_count: c.lessons_count ?? 0,
      total_minutes: c.total_minutes ?? 0,
      students_count: c.students_count ?? 0,
    }))

  const loadArticlesSearch = (q: string, tagId: string | null) => {
    setLoading(true)
    setSemantic(null)
    setSemanticLoading(false)
    setSearchCourses(null)
    setSearchLessons(null)
    const params = new URLSearchParams({ q: q.trim(), limit: '50' })
    if (tagId) params.set('tag', tagId)
    api.get(`/news/search?${params.toString()}`)
      .then(data => {
        setArticles(data.articles || [])
        setSearchTotal(typeof data.total === 'number' ? data.total : null)
        // ТЗ-213: semantic == null (SQLite/q<4/TEI недоступен/0 кандидатов) —
        // раздел целиком не рендерится.
        setSemantic(data.semantic ?? null)
        // ТЗ-214: курсы приходят вместе с семантикой (общий query-вектор);
        // при её фолбэке поля courses нет — раздел скрыт.
        setSearchCourses(data.courses?.length ? mapSearchCourses(data.courses) : null)
        // ТЗ-215: уроки приходят вместе с семантикой/курсами (общий
        // query-вектор); при её фолбэке поля lessons нет — раздел скрыт.
        setSearchLessons(data.lessons?.length ? data.lessons : null)
      })
      .catch((err) => { console.error('[NewsFeed] loadArticlesSearch error:', err) })
      .finally(() => setLoading(false))
  }

  // ТЗ-213: «Ещё по смыслу» — следующая порция по semantic_offset; точные
  // не перезапрашиваются. Клиентский дедуп appended-порции против уже
  // показанных (сервер дедупит vs exact, но не vs предыдущие смысловые).
  const loadMoreSemantic = () => {
    if (!semantic?.hasMore || semanticLoading || !filter.trim()) return
    setSemanticLoading(true)
    const params = new URLSearchParams({
      q: filter.trim(),
      limit: '50',
      semantic_offset: String(semantic.articles.length),
    })
    if (activeTagId) params.set('tag', activeTagId)
    api.get(`/news/search?${params.toString()}`)
      .then(data => {
        const next = data.semantic
        if (!next) return
        setSemantic(prev => {
          if (!prev) return null
          const seen = new Set(prev.articles.map(a => a.id))
          return {
            articles: [...prev.articles, ...(next.articles as NewsArticle[]).filter((a: NewsArticle) => !seen.has(a.id))],
            total: next.total,
            hasMore: next.hasMore,
          }
        })
      })
      .catch((err) => { console.error('[NewsFeed] loadMoreSemantic error:', err) })
      .finally(() => setSemanticLoading(false))
  }

  // ─── Открыть детальную карточку и отметить как прочитанную ──────────
  const handleCardClick = (article: NewsArticle) => {
    logAnalyticsEvent('select_content', { content_type: 'news', item_id: article.id, title: article.title_ru || article.title_original || '' })
    api.post(`/news/${article.id}/read`, {}).catch(() => {})
    navigate(`/news/${article.slug}`, { state: { background: location } })
  }

  // ТЗ-101: клик по стопке/чипу каскада — разъезд панели под сеткой ленты
  // (контекст CascadeExpandProvider ниже; обработчик — в провайдере).

  // ─── Обработчики фильтров ─────────────────────────────────────────────
  const handleTagClick = (tag: TagItem) => {
    setActiveTagId(tag.tag_id)
    setFilter('')
    setSearchParams(buildFeedParams(tag.tag_name, null), { replace: false })
  }

  const handleAllClick = () => {
    setActiveTagId(null)
    setSearchParams(buildFeedParams(null, filter), { replace: false })
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center">
        <div className="text-center">
          <Newspaper className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="mb-4 text-text-secondary">Войдите, чтобы увидеть ленту новостей</p>
          <button
            onClick={() => openAuthModal('login')}
            className="text-[#00D4FF] hover:underline"
          >
            Войти
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <CascadeExpandProvider>
      <div className="max-w-[1200px] mx-auto px-4 py-8">
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
              onClick={handleAllClick}
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
                onClick={() => handleTagClick(tag)}
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
          <>
            {/* ТЗ-213: раздел «Прямое сходство» — точные совпадения, сетка без изменений */}
            {filter.trim() && (
              <SearchSectionHeader
                label="Прямое сходство"
                count={searchTotal ?? articles.length}
                note="слова запроса есть в тексте · подсвечены"
              />
            )}
            <div className="news-feed-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {articles.map((article, i) => (
                <CascadeStackCard
                  key={article.id}
                  flipId={article.id}
                  article={article}
                  onCardClick={() => handleCardClick(article)}
                  dataAttrs={{ 'data-newsfeed-card': article.id }}
                  className="cursor-pointer"
                >
                  <NewsCard article={article} index={i} tagsMap={tagsMap} showChart={true} highlightQuery={filter.trim() ? filter : undefined} />
                </CascadeStackCard>
              ))}
            </div>
          </>
        ) : semantic?.articles.length ? null : (
          <div className="text-center py-12 text-text-muted">
            <Newspaper size={32} className="mx-auto mb-3 opacity-40" />
            <p>{filter.trim() ? 'Ничего не найдено' : 'Новостей пока нет'}</p>
          </div>
        )}

        {/* ТЗ-213: раздел «По смыслу» — только при наличии смысловых результатов;
            пагинация кнопкой «Ещё по смыслу» (semantic_offset), точные не трогаем */}
        {!loading && filter.trim() && semantic && semantic.articles.length > 0 && (
          <div className="mt-8">
            <SearchSectionHeader
              label="По смыслу"
              count={semantic.total}
              note="найдено векторным поиском · слов запроса в тексте может не быть"
              cyan
            />
            <div className="news-feed-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {semantic.articles.map((article, i) => (
                <CascadeStackCard
                  key={article.id}
                  flipId={article.id}
                  article={article}
                  onCardClick={() => handleCardClick(article)}
                  dataAttrs={{ 'data-newsfeed-card': article.id }}
                  className="cursor-pointer"
                >
                  <NewsCard article={article} index={i} tagsMap={tagsMap} showChart={true} />
                </CascadeStackCard>
              ))}
            </div>
            {semantic.hasMore && (
              <div className="flex justify-center mt-4">
                <button
                  type="button"
                  onClick={loadMoreSemantic}
                  disabled={semanticLoading}
                  className="transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(0,212,255,.35)',
                    color: '#00D4FF',
                    borderRadius: 999,
                    padding: '8px 18px',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {semanticLoading ? 'Загрузка…' : 'Ещё по смыслу'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ТЗ-214: раздел «Курсы по теме» — карусель CourseCard 1:1 с витриной
            (паттерн .row-scroll); пусто → раздел скрыт целиком */}
        {!loading && filter.trim() && searchCourses && searchCourses.length > 0 && (
          <div className="mt-8">
            <SearchSectionHeader
              label="Курсы по теме"
              count={searchCourses.length}
              note="из образовательной платформы PULSE"
              cyan
            />
            <div className="row-scroll">
              {searchCourses.map((course, i) => (
                <CourseCard
                  key={course.slug}
                  course={course}
                  index={i}
                  // поисковый контекст: фильтра витрины нет — пилюля ведёт на витрину
                  onSelectCategory={() => navigate('/education')}
                />
              ))}
            </div>
          </div>
        )}

        {/* ТЗ-215: раздел «Уроки по теме» — компактные карточки уроков;
            клик → страница КУРСА (гейт урока не обходим); пусто → скрыт целиком */}
        {!loading && filter.trim() && searchLessons && searchLessons.length > 0 && (
          <div className="mt-8">
            <SearchSectionHeader
              label="Уроки по теме"
              count={searchLessons.length}
              note="конкретные материалы из курсов · открывается страница курса"
              cyan
            />
            <div className="row-scroll lessons">
              {searchLessons.map((lesson, i) => (
                <SearchLessonCard key={lesson.lesson_id} lesson={lesson} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* ТЗ-101: панель каскада разворачивается под сеткой ленты */}
        <CascadeExpandContainer />
      </div>
      </CascadeExpandProvider>
    </div>
  )
}
