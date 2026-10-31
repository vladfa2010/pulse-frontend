import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, ShieldCheck, TimerOff } from 'lucide-react'
import { api } from '@/lib/api'
import { ResultTabs } from '@/components/factCheck/ResultTabs'
import type { FactCheckResultV4 } from '@/types/factCheck'

// Публичная страница шеринга результата фактчека (ТЗ-209) — доступна без
// авторизации по ссылке /share/factcheck/:token. Ссылка многоразовая, TTL
// 7 дней (просрочка → 410). Результат рендерится готовым ResultTabs — тем же
// пайплайном, что и внутри платформы (санитизированный renderMarkdown).
// noindex: гостевые страницы в выдачу не нужны.

type ShareState =
  | { kind: 'loading' }
  | { kind: 'ok'; title: string; result: FactCheckResultV4 }
  | { kind: 'expired' }
  | { kind: 'notfound' }

export default function ShareFactCheckPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<ShareState>({ kind: 'loading' })

  // noindex
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'robots'
      document.head.appendChild(meta)
    }
    const prev = meta.content
    meta.content = 'noindex'
    return () => { meta.content = prev }
  }, [])

  useEffect(() => {
    if (!token || !/^[0-9a-f]{48}$/.test(token)) {
      setState({ kind: 'notfound' })
      return
    }
    let cancelled = false
    setState({ kind: 'loading' })
    api.get(`/fact-check/shared/${encodeURIComponent(token)}`)
      .then((res) => {
        if (cancelled) return
        setState({ kind: 'ok', title: res.news?.title || 'Проверка новости', result: res.result })
      })
      .catch((err: any) => {
        if (cancelled) return
        if (err?.status === 410) setState({ kind: 'expired' })
        else setState({ kind: 'notfound' })
      })
    return () => { cancelled = true }
  }, [token])

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm mb-6"
          style={{ color: '#6B7280' }}
        >
          <ArrowLeft size={14} /> PULSE
        </Link>

        {state.kind === 'loading' && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {state.kind === 'notfound' && (
          <div className="text-center py-24 space-y-4">
            <ShieldCheck size={40} className="mx-auto" style={{ color: '#6B7280' }} />
            <h1 className="text-xl font-semibold text-gray-100">Ссылка не найдена</h1>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              Возможно, новость удалена или ссылка содержит ошибку.
            </p>
            <Link
              to="/"
              className="inline-block px-6 py-2.5 rounded-xl text-sm font-medium"
              style={{ backgroundColor: '#00D4FF', color: '#050505' }}
            >
              На главную
            </Link>
          </div>
        )}

        {state.kind === 'expired' && (
          <div className="text-center py-24 space-y-4">
            <TimerOff size={40} className="mx-auto" style={{ color: '#F59E0B' }} />
            <h1 className="text-xl font-semibold text-gray-100">Срок действия ссылки истёк</h1>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              Ссылки на результаты проверки живут 7 дней. Попросите отправителя поделиться заново.
            </p>
            <Link
              to="/"
              className="inline-block px-6 py-2.5 rounded-xl text-sm font-medium"
              style={{ backgroundColor: '#00D4FF', color: '#050505' }}
            >
              На главную
            </Link>
          </div>
        )}

        {state.kind === 'ok' && (
          <div className="space-y-5">
            <div>
              <p
                className="text-[10px] uppercase tracking-wider flex items-center gap-1 mb-2"
                style={{ color: '#00D4FF' }}
              >
                <ShieldCheck size={10} /> Результат проверки фактов
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-100 leading-snug">
                {state.title}
              </h1>
              <p className="text-[11px] mt-2" style={{ color: '#6B7280' }}>
                Анализ сгенерирован искусственным интеллектом
              </p>
            </div>

            <ResultTabs result={state.result} />

            <div
              className="mt-8 rounded-2xl p-6 text-center space-y-3"
              style={{ backgroundColor: '#0A0A0A', border: '1px solid #1F1F1F' }}
            >
              <p className="text-sm font-medium text-gray-100">
                Проверяйте новости с PULSE
              </p>
              <p className="text-xs" style={{ color: '#6B7280' }}>
                AI-фактчекинг, веб-поиск по источникам и оценка достоверности — в одном приложении.
              </p>
              <Link
                to="/register"
                className="inline-block px-6 py-2.5 rounded-xl text-sm font-medium"
                style={{ backgroundColor: '#00D4FF', color: '#050505' }}
              >
                Начать бесплатно
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
