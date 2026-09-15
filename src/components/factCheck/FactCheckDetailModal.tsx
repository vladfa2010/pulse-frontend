/**
 * PULSE — Модалка детали ad-hoc проверки / проверенной новости
 *
 * Порт модалки из мокапа de3adad: бейджи вердикта (+ «Новость PULSE»),
 * заголовок, ссылка (url), «Проверяемый текст», заметка с замком для своих
 * частных проверок, ResultTabs (Анализ / Источники / Оценка).
 *
 * Данные: полная запись тянется GET /api/fact-check/:id (owner; для новостей
 * из ленты — по id новости). При недоступности endpoint'а показываем то,
 * что уже есть в карточке.
 */

import { useEffect, useState, useRef } from 'react'
import { X, Link2, Lock, ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react'
import { api } from '@/lib/api'
import { ResultTabs } from './ResultTabs'
import type { FactCheckListItem, FactCheckResultV4 } from '@/types/factCheck'
import { verdictColor } from '@/lib/factCheckInput'

interface Props {
  item: FactCheckListItem | null
  onClose: () => void
}

const VerdictIcon = ({ label }: { label?: string }) => {
  const Icon = label === 'Высокая' ? ShieldCheck : label === 'Критическая' ? ShieldOff : ShieldAlert
  return <Icon size={13} />
}

export function FactCheckDetailModal({ item, onClose }: Props) {
  const [detail, setDetail] = useState<FactCheckListItem | null>(null)
  const [extractedText, setExtractedText] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // При смене карточки сбрасываем и подгружаем полную запись
  useEffect(() => {
    setDetail(item)
    setExtractedText(item?.extracted_text ?? null)
    if (!item) return

    let cancelled = false
    api
      .get(`/fact-check/${encodeURIComponent(item.id)}`)
      .then((data) => {
        if (cancelled || !data) return
        setDetail((prev) =>
          prev ? { ...prev, ...data, result: data.result || prev.result } : prev
        )
        if (typeof data.extracted_text === 'string' && data.extracted_text) {
          setExtractedText(data.extracted_text)
        }
      })
      .catch(() => {
        // 403 у чужих частных / сетевые ошибки — показываем то, что есть в карточке
      })
    return () => {
      cancelled = true
    }
  }, [item])

  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [item, onClose])

  if (!item || !detail) return null

  const result: FactCheckResultV4 | null = detail.result || item.result || null
  const label = result?.assessment?.credibility_label
  const score = result?.assessment?.credibility_score
  const color = verdictColor(label, score)
  const url = detail.url
  const inputRaw = (detail as any).input_raw as string | undefined
  const link = url || (detail.input_type === 'url' ? inputRaw : undefined)

  return (
    <div
      ref={overlayRef}
      onClick={e => {
        if (e.target === overlayRef.current) onClose()
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-[720px] max-h-[85vh] overflow-y-auto rounded-[20px] p-6 relative"
        style={{ background: '#0E0E0E', border: '1px solid #222' }}
      >
        {/* Шапка */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {result?.assessment && (
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ color, background: `${color}1F` }}
                >
                  <VerdictIcon label={label} />
                  {label} · {score}/100
                </span>
              )}
              {detail.kind === 'news' && (
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-normal"
                  style={{ color: '#6B7280', background: 'rgba(255,255,255,0.06)' }}
                >
                  Новость PULSE
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold leading-snug" style={{ color: '#FFFFFF' }}>
              {detail.title}
            </h3>
            {link && /^https?:\/\//.test(link) && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs mt-1 hover:opacity-80"
                style={{ color: '#60A5FA' }}
              >
                <Link2 size={12} />
                <span className="truncate">{link}</span>
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex p-1 transition-colors shrink-0"
            style={{ color: '#6B7280' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        {/* Проверяемый текст */}
        {(extractedText || detail.snippet) && (
          <details
            className="mb-4 rounded-xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <summary className="text-xs cursor-pointer select-none" style={{ color: '#6B7280' }}>
              Проверяемый текст
            </summary>
            <p
              className="text-sm mt-2 whitespace-pre-wrap leading-relaxed"
              style={{ color: '#9CA3AF' }}
            >
              {extractedText || detail.snippet}
            </p>
          </details>
        )}

        {/* Частная проверка — заметка с замком (свои ad-hoc; v1 все частные) */}
        {detail.kind === 'request' && (
          <div
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#6B7280' }}
          >
            <Lock size={13} />
            Частная проверка — видна только вам
          </div>
        )}

        {/* Результат */}
        {result ? (
          <ResultTabs result={result} />
        ) : (
          <p className="text-sm py-4" style={{ color: '#6B7280' }}>
            {detail.status === 'queued' || detail.status === 'in_progress'
              ? 'Проверка ещё выполняется — результат появится в «Моих проверках».'
              : 'Результат недоступен.'}
          </p>
        )}
      </div>
    </div>
  )
}
