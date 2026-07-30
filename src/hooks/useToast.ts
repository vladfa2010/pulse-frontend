import { useCallback } from 'react'
import { useToast as useToastInternal } from '@/components/Toast'

export { ToastProvider } from '@/components/Toast'
export type { ToastType } from '@/components/Toast'

export function useToast() {
  const ctx = useToastInternal()

  const toast = useCallback(
    (message: string, type?: 'info' | 'error' | 'success') => ctx.push(message, type),
    [ctx]
  )

  const toastError = useCallback(
    (message: string) => ctx.pushError(message),
    [ctx]
  )

  return { toast, toastError, push: ctx.push, pushError: ctx.pushError }
}
