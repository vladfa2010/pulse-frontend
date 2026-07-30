import { createContext, useContext, useCallback, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export type ToastType = 'info' | 'error' | 'success'

export interface ToastMessage {
  id: string
  message: string
  type: ToastType
}

interface ToastCtx {
  push(message: string, type?: ToastType): void
  pushError(message: string): void
}

const ToastContext = createContext<ToastCtx | null>(null)

let toastId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${++toastId}-${Date.now()}`
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const pushError = useCallback((message: string) => push(message, 'error'), [push])

  return (
    <ToastContext.Provider value={{ push, pushError }}>
      {children}
      {createPortal(<ToastStack toasts={toasts} onRemove={remove} />, document.body)}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}

function ToastStack({ toasts, onRemove }: { toasts: ToastMessage[]; onRemove: (id: string) => void }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3"
      aria-live="polite"
    >
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), 3200)
    const cleanup = setTimeout(() => onRemove(toast.id), 3500)
    return () => {
      clearTimeout(timer)
      clearTimeout(cleanup)
    }
  }, [toast.id, onRemove])

  const borderColor = toast.type === 'error'
    ? 'rgba(239, 68, 68, 0.35)'
    : toast.type === 'success'
      ? 'rgba(52, 211, 153, 0.35)'
      : 'rgba(0, 212, 255, 0.3)'

  const shadowColor = toast.type === 'error'
    ? 'rgba(239, 68, 68, 0.25)'
    : toast.type === 'success'
      ? 'rgba(52, 211, 153, 0.25)'
      : 'rgba(0, 212, 255, 0.25)'

  return (
    <div
      className="flex items-center gap-3 rounded-[14px] px-4 py-3 text-sm text-white"
      style={{
        background: '#0E0E0E',
        border: `1px solid ${borderColor}`,
        boxShadow: `0 8px 32px -8px ${shadowColor}`,
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateY(8px)' : 'translateY(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => {
          setExiting(true)
          setTimeout(() => onRemove(toast.id), 300)
        }}
        className="text-[#6B7280] hover:text-white transition-colors"
        aria-label="Закрыть"
      >
        <X size={14} />
      </button>
    </div>
  )
}
