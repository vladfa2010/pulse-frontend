/**
 * PULSE — Блок «Фактчекинг» на главной странице
 *
 * После GlobalNewsCarousel (§3 TZ): NewsCarousel с акцентом #34D399,
 * подзаголовок «Проверенные новости и материалы», CTA-пилюля
 * «Проверить самому →» → /factcheck. Блок скрывается при пустой ленте.
 *
 * Источник данных: GET /api/fact-check/feed (публичный; v1 — только
 * проверенные новости PULSE). Клик по карточке — deeplink /factcheck?r=<id>.
 */

import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import NewsCarousel from '@/components/NewsCarousel'
import { FactCheckRequestCard } from '@/components/factCheck/FactCheckRequestCard'
import type { FactCheckFeedItem, FactCheckListItem } from '@/types/factCheck'

function toListItem(raw: FactCheckFeedItem): FactCheckListItem {
  return {
    id: raw.id,
    kind: 'news',
    title: raw.title || 'Без названия',
    snippet: raw.snippet,
    url: raw.url,
    status: raw.status || 'checked',
    result: raw.result || null,
    created_at: raw.created_at || new Date().toISOString(),
  }
}

export default function FactCheckHomeBlock() {
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['factCheckFeed'],
    queryFn: async () => {
      const res = await api.get('/fact-check/feed?limit=15&offset=0')
      return ((res.items || res.feed || []) as FactCheckFeedItem[]).map(toListItem)
    },
    staleTime: 60 * 1000,
    retry: 1,
  })

  // Пустая лента (или ещё грузится) — блок не показываем
  if (!data || data.length === 0) return null

  return (
    <NewsCarousel
      title="Фактчекинг"
      accentColor="#34D399"
      subtitle="Проверенные новости и материалы"
      count={data.length}
      headerAction={
        <Link
          to="/factcheck"
          className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full mr-2 transition-all hover:brightness-115"
          style={{
            background: 'rgba(52,211,153,0.12)',
            color: '#34D399',
            border: '1px solid rgba(52,211,153,0.25)',
          }}
        >
          <ShieldCheck size={13} />
          Проверить самому
          <ArrowRight size={12} />
        </Link>
      }
    >
      {data.map(item => (
        <FactCheckRequestCard
          key={item.id}
          item={item}
          onClick={() => {
            // Детальная модалка живёт на странице фактчекинга — открываем через deeplink
            navigate(`/factcheck?r=${encodeURIComponent(item.id)}`)
          }}
        />
      ))}
    </NewsCarousel>
  )
}
