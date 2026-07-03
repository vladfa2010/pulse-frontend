import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type TagPeriod = '24h' | '7d' | '30d'

export interface PopularTag {
  tag_id: string
  tag_name: string
  tag_type: 'company' | 'sector' | 'person' | 'trend'
  news_count: number
  articles_24h: number
  articles_7d: number
  articles_30d: number
}

interface PopularTagsResponse {
  tags: PopularTag[]
}

const PERIOD_COUNT_FIELD: Record<TagPeriod, keyof PopularTag> = {
  '24h': 'articles_24h',
  '7d': 'articles_7d',
  '30d': 'articles_30d',
}

const fetchPopularTags = async (period: TagPeriod): Promise<PopularTag[]> => {
  const data = (await api.get(
    `/news/tags/popular?period=${period}&limit=15`
  )) as PopularTagsResponse
  return data.tags.map((tag) => ({
    ...tag,
    news_count: (tag[PERIOD_COUNT_FIELD[period]] as number) || 0,
  }))
}

export function usePopularTags(period: TagPeriod) {
  return useQuery({
    queryKey: ['popularTags', period],
    queryFn: () => fetchPopularTags(period),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
  })
}
