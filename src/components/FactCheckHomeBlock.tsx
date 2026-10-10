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
        // ТЗ-141: платформенный паттерн headerAction (1:1 с «Прочитать всё», UnreadNewsCarousel)
        <Link
          to="/factcheck"
          className="flex items-center gap-1.5 h-7 sm:h-6 px-3 sm:px-2.5 mr-0 sm:mr-2 rounded-full border transition-colors
            whitespace-nowrap flex-shrink-0
            bg-[#00D4FF]/10 hover:bg-[#00D4FF]/25 border-[#00D4FF]/30"
        >
          <ShieldCheck size={11} className="text-[#00D4FF]" />
          <span className="text-xs sm:text-[11px] font-medium text-[#00D4FF]">Проверить самому</span>
          <ArrowRight size={11} className="text-[#00D4FF]" />
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
