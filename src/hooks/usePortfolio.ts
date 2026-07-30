import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import type { PortfolioSummary, RecommendedTag, RecommendedTagsResponse, TagLimit } from '@/types/portfolio'

export type PortfolioMode = 'by-broker' | 'consolidated'

const summaryKey = (mode: PortfolioMode) => ['portfolio', 'summary', mode]
const recommendedKey = () => ['portfolio', 'recommended-tags']

export function usePortfolioSummary(mode: PortfolioMode) {
  return useQuery<PortfolioSummary>({
    queryKey: summaryKey(mode),
    queryFn: async () => {
      const data = await api.get(`/portfolio/summary?mode=${mode}`)
      return data as PortfolioSummary
    },
  })
}

export function useRecommendedTags() {
  return useQuery<RecommendedTagsResponse>({
    queryKey: recommendedKey(),
    queryFn: async () => {
      const data = await api.get('/portfolio/recommended-tags')
      return {
        tags: (data.tags || []) as RecommendedTag[],
        tagLimit: (data.tagLimit || { used: 0, limit: 0 }) as TagLimit,
      }
    },
  })
}

export function usePortfolioMutations() {
  const queryClient = useQueryClient()
  const { toastError, toast } = useToast()

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    queryClient.invalidateQueries({ queryKey: ['broker-keys'] })
  }

  const createPortfolio = useMutation({
    mutationFn: async (body: { broker: string; name?: string; brokerKeyId: string }) => {
      return api.post('/portfolio', body)
    },
    onSuccess: () => {
      invalidateAll()
      toast('Портфель подключен и синхронизирован', 'success')
    },
    onError: (err: any) => toastError(err.message || 'Не удалось создать портфель'),
  })

  const deletePortfolio = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/portfolio/${id}`)
    },
    onSuccess: () => {
      invalidateAll()
      toast('Портфель удалён', 'info')
    },
    onError: (err: any) => toastError(err.message || 'Не удалось удалить портфель'),
  })

  const syncPortfolio = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/portfolio/${id}/sync`, {})
    },
    onSuccess: () => {
      invalidateAll()
      toast('Синхронизация завершена', 'success')
    },
    onError: (err: any) => toastError(err.message || 'Не удалось синхронизировать портфель'),
  })

  const subscribeRecommendedTag = useMutation({
    mutationFn: async (body: { ticker: string; exchange?: string }) => {
      return api.post('/portfolio/recommended-tags/subscribe', body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recommendedKey() })
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    },
    onError: (err: any, variables) => {
      toastError(err.message || `Не удалось подписаться на #${variables.ticker}`)
      queryClient.invalidateQueries({ queryKey: recommendedKey() })
    },
  })

  return { createPortfolio, deletePortfolio, syncPortfolio, subscribeRecommendedTag }
}

export function useCreateBrokerKeyForPortfolio() {
  const queryClient = useQueryClient()
  const { toastError } = useToast()

  return useMutation({
    mutationFn: async (body: { broker: string; label: string; token: string }) => {
      return api.post('/broker-keys', body) as Promise<{ id: string }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broker-keys'] })
    },
    onError: (err: any) => toastError(err.message || 'Не удалось сохранить ключ брокера'),
  })
}
