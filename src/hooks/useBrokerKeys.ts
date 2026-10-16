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

const brokerKeyErrorMessage = (err: any, fallback: string): string => {
  const code = err?.code || err?.message || ''
  if (code === 'broker_key_invalid') return 'Ключ недействителен — перевыпустите токен в кабинете Финам'
  if (code === 'broker_unavailable') return 'Финам недоступен, повторите через пару минут'
  if (code === 'broker_timeout') return 'Финам не отвечает, повторите позже'
  if (code === 'broker_maintenance') return 'Финам на техобслуживании (05:00–05:15 МСК), попробуйте позже'
  return err?.message || fallback
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
    onError: (err: any) => toastError(brokerKeyErrorMessage(err, 'Не удалось сохранить ключ')),
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
    onError: (err: any) => toastError(brokerKeyErrorMessage(err, 'Не удалось обновить ключ')),
  })

  const deleteBrokerKey = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/broker-keys/${id}`)
    },
    onSuccess: () => {
      invalidate()
      toast('Ключ и портфель удалены', 'info')
    },
    onError: (err: any) => toastError(brokerKeyErrorMessage(err, 'Не удалось удалить ключ')),
  })

  const testBrokerKey = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/broker-keys/${id}/test`, {})
    },
    onSuccess: () => {
      invalidate()
      toast('Подключение проверено', 'success')
    },
    onError: (err: any) => toastError(brokerKeyErrorMessage(err, 'Не удалось проверить ключ')),
  })

  return { createBrokerKey, updateBrokerKey, deleteBrokerKey, testBrokerKey }
}
