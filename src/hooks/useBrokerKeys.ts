import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import type { BrokerKey } from '@/types/portfolio'

const brokerKeysKey = () => ['broker-keys']

export function useBrokerKeys() {
  return useQuery<BrokerKey[]>({
    queryKey: brokerKeysKey(),
    queryFn: async () => {
      const data = await api.get('/broker-keys')
      return (data.keys || data) as BrokerKey[]
    },
  })
}

export function useBrokerKeyMutations() {
  const queryClient = useQueryClient()
  const { toastError, toast } = useToast()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: brokerKeysKey() })
    queryClient.invalidateQueries({ queryKey: ['portfolio'] })
  }

  const createBrokerKey = useMutation({
    mutationFn: async (body: { broker: string; label: string; token: string }) => {
      return api.post('/broker-keys', body)
    },
    onSuccess: () => {
      invalidate()
      toast('Ключ проверен и сохранён', 'success')
    },
    onError: (err: any) => toastError(err.message || 'Не удалось сохранить ключ'),
  })

  const updateBrokerKey = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string
      body: { label?: string; token?: string }
    }) => {
      return api.patch(`/broker-keys/${id}`, body)
    },
    onSuccess: () => {
      invalidate()
      toast('Ключ обновлён', 'success')
    },
    onError: (err: any) => toastError(err.message || 'Не удалось обновить ключ'),
  })

  const deleteBrokerKey = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/broker-keys/${id}`)
    },
    onSuccess: () => {
      invalidate()
      toast('Ключ удалён', 'info')
    },
    onError: (err: any) => toastError(err.message || 'Не удалось удалить ключ'),
  })

  const testBrokerKey = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/broker-keys/${id}/test`, {})
    },
    onSuccess: () => {
      invalidate()
      toast('Подключение проверено', 'success')
    },
    onError: (err: any) => toastError(err.message || 'Не удалось проверить ключ'),
  })

  return { createBrokerKey, updateBrokerKey, deleteBrokerKey, testBrokerKey }
}
