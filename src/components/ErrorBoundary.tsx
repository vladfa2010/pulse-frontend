/**
 * =============================================================================
 * PULSE Frontend — Error Boundary
 * =============================================================================
 *
 * Вторая линия обороны: если при рендере или в эффекте всплывает ошибка,
 * показываем дружелюбный экран вместо пустой страницы. Особенно важно при
 * заблокированном localStorage и других runtime-ошибках инициализации.
 */

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center"
          style={{ backgroundColor: '#060606' }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
          >
            <AlertTriangle size={32} style={{ color: '#EF4444' }} />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Что-то пошло не так</h1>
          <p className="text-sm mb-8 max-w-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Не удалось загрузить приложение. Попробуйте перезагрузить страницу.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: '#00D4FF', color: '#060606' }}
          >
            <RotateCcw size={18} />
            Перезагрузить
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
