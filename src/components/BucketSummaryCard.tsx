/**
 * =============================================================================
 * PULSE — Карточка и панель бакета «Пока вас не было» (ТЗ-218)
 * =============================================================================
 *
 * Карточка бакета в треке карусели (клик → разъезд панели через слот
 * expandedContent контекста ТЗ-101) и корешок «Вчера» (narrow, 113px).
 * Fallback при VITE_CASCADE_EXPAND=false: саммари целиком на карточке +
 * кнопка «Отметить прочитанными» на месте (мёртвых контролов нет).
 * Буллеты (3) — из top_news; саммари LLM — из поля summary (null → буллеты).
 */

import { useContext, useEffect, useRef } from 'react'
import { BucketMarkContext } from '@/components/UnreadNewsCarousel' // ТЗ-225: контекст пробивает frozen node
import { Moon, Sun, Sunrise, Sunset, Archive, Flame, ChevronRight, Check, Loader2 } from 'lucide-react'
import { useCascadeExpand } from '@/components/CascadeExpandProvider'
import type { BucketPayload } from '@/types/news'

const PERIOD_ICONS: Record<string, typeof Moon> = {
  night: Moon,
  morning: Sunrise,
  day: Sun,
  evening: Sunset,
  older: Archive,
}

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

interface Props {
  bucket: BucketPayload
  /** Оптимистичное состояние после «Отметить прочитанными» / «Прочитать всё». */
  done?: boolean
  onMarkRead?: (key: string) => void
  onOpenArticle?: (item: { id: string; slug: string | null }) => void
}

export default function BucketSummaryCard({ bucket, done = false, onMarkRead, onOpenArticle }: Props) {
  const ctx = useCascadeExpand()
  // ТЗ-226: deep link /?bucket=<key> — приёмник (выше провайдера) кладёт ключ в
  // BucketMarkContext; раскрытие делаем мы, т.к. наш ctx — настоящий (внутри провайдера)
  const { pendingOpenKey, clearPendingOpen } = useContext(BucketMarkContext)
  useEffect(() => {
    if (!ctx?.expandEnabled || pendingOpenKey !== bucket.key) return
    // уже открыт этот бакет (или только что открыли) — не тоглить повторно
    if (ctx.expandedBucketKey === bucket.key) return
    ctx.setExpandedBucket(
      bucket.key,
      <BucketPanel bucket={bucket} onMarkRead={() => onMarkRead?.(bucket.key)} onOpenArticle={onOpenArticle} onClose={ctx.close} />,
    )
    clearPendingOpen()
  }, [ctx, pendingOpenKey, bucket, onMarkRead, onOpenArticle, clearPendingOpen])
  const narrow = bucket.key === 'older'
  const Icon = PERIOD_ICONS[bucket.key] || Sun

  const markRead = () => onMarkRead?.(bucket.key)
  const openPanel = () => {
    if (!ctx?.expandEnabled) return
    // повторный клик по ТОЙ ЖЕ карточке — закрытие; по другой — переключение (аудит ТЗ-219)
    ctx.setExpandedBucket(
      bucket.key,
      <BucketPanel bucket={bucket} onMarkRead={markRead} onOpenArticle={onOpenArticle} onClose={ctx.close} />
    )
  }

  // Fallback без разъезда: саммари целиком + кнопка на карточке
  const inlineFallback = ctx && !ctx.expandEnabled
  // fallback у корешка: показываем саммари целиком вместо мёртвой ссылки (аудит ТЗ-219)
  const narrowFallback = narrow && inlineFallback
  // ТЗ-222 правило 4 (DESIGN_SYSTEM §4.1): цвет доминирующего сентимента окна;
  // равенство или 0/0 — линии не рендерятся
  const sentimentColor = !narrow && bucket.sentiment.pos > bucket.sentiment.neg
    ? '#34D399'
    : !narrow && bucket.sentiment.neg > bucket.sentiment.pos
      ? '#EF4444'
      : null
  const bullets = bucket.top_news.slice(0, 3)
  const sentimentLine =
    (bucket.sentiment.pos > 0 || bucket.sentiment.neg > 0) && !narrow ? (
      <span className="text-[10px] font-semibold" style={{ color: '#6B7280' }}>
        ▲ <span style={{ color: '#34D399' }}>{bucket.sentiment.pos}</span>
        {' · '}
        ▼ <span style={{ color: '#EF4444' }}>{bucket.sentiment.neg}</span>
        {bucket.viral_stories > 0 && (
          <>
            {' · '}
            <Flame size={11} className="inline -mt-0.5" style={{ color: '#F59E0B' }} /> {bucket.viral_stories}
          </>
        )}
      </span>
    ) : null

  return (
    <div
      onClick={inlineFallback ? undefined : openPanel}
      className="liquid-glass bucket-card"
      style={{
        width: narrow ? 113 : 'min(340px, 84vw)',
        height: 225,
        borderRadius: 12,
        padding: 16,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        // ТЗ-222 правило 5: glass-стили из класса .liquid-glass (DESIGN_SYSTEM §5.2),
        // инлайн background/border/backdrop убраны
        opacity: done ? 0.45 : 1,
        pointerEvents: done ? 'none' : undefined,
        cursor: inlineFallback || done ? undefined : 'pointer',
        transition: `transform .3s ${EASE}, box-shadow .3s ${EASE}`,
        flexShrink: 0,
        // 'backwards', не 'both': иначе финальный ключфрейм анимации (transform в to:)
        // с fill-режимом перекрывает inline-hover бесконечно (аудит UI)
        animation: 'newsSlideIn .5s ease-out backwards',
      }}
      onMouseEnter={(e) => {
        if (done || inlineFallback) return
        e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
      }}
    >
      {/* ТЗ-222 правило 4 (§4.1 дословно): линии — реальные span (::before/::after заняты glass).
          Рендер первыми в DOM → под glass-бликом, pointer-events none. */}
      {sentimentColor && (
        <>
          <span aria-hidden className="bucket-line-top" style={{ background: `linear-gradient(90deg, transparent, ${sentimentColor}, transparent)` }} />
          <span aria-hidden className="bucket-line-bottom" style={{ background: `linear-gradient(90deg, transparent, ${sentimentColor}, transparent)` }} />
        </>
      )}
      {done && <Check size={18} className="absolute" style={{ top: 12, right: 12, color: '#34D399' }} />}
      <div className="flex items-center gap-2">
        <span
          className="flex items-center justify-center"
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: done
              ? 'rgba(52,211,153,.1)'
              : narrow
                ? 'rgba(255,255,255,.04)'
                : 'rgba(0,212,255,.08)',
            border: `1px solid ${done ? 'rgba(52,211,153,.3)' : narrow ? 'rgba(255,255,255,.08)' : 'rgba(0,212,255,.2)'}`,
          }}
        >
          <Icon size={17} style={{ color: done ? '#34D399' : narrow ? '#6B7280' : '#00D4FF' }} />
        </span>
        <div className="min-w-0">
          <div
            className="font-semibold"
            style={{ fontSize: narrow ? 19 : 20, letterSpacing: '.05em', color: narrow ? '#9CA3AF' : '#FFFFFF', lineHeight: 1.1 }}
          >
            {bucket.label}
          </div>
          <div className="text-muted" style={{ fontSize: narrow ? 14 : 11, lineHeight: 1.4 }}>
            {narrow
              ? `${bucket.count} новостей`
              : bucket.range_start
                ? `${fmtRange(bucket.range_start, bucket.range_end)}`
                : `до ${fmtTime(bucket.range_end)}`}
          </div>
        </div>
        {!narrow && (
          <span className="ml-auto whitespace-nowrap" style={{ fontSize: 15, color: '#00D4FF', fontWeight: 600 }}>
            {bucket.count}
          </span>
        )}
      </div>

      {/* Буллеты / саммари */}
      {narrowFallback && bucket.summary ? (
        <p className="text-secondary" style={{ fontSize: 11, lineHeight: 1.45, overflow: 'hidden' }}>
          {bucket.summary}
        </p>
      ) : narrow ? null : inlineFallback && bucket.summary ? (
        <p className="text-secondary" style={{ fontSize: 12.5, lineHeight: 1.45, overflow: 'hidden' }}>
          {bucket.summary}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 m-0 p-0 list-none" style={{ flex: 1, minHeight: 0 }}>
          {bullets.map((n) => (
            <li
            key={n.id}
            className="text-secondary line-clamp-2"
            style={{
              fontSize: 12.5,
              lineHeight: 1.45,
              position: 'relative',
              paddingLeft: 14,
              // ТЗ-222 правило 1: обрезка на 2 строки — наложения на нижнюю строку недопустимы
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
              <span
                className="absolute rounded-full"
                style={{ left: 0, top: 6, width: 5, height: 5, background: 'rgba(0,212,255,.6)' }}
              />
              {n.title}
            </li>
          ))}
        </ul>
      )}
      {narrow && !inlineFallback && (
        <div className="mt-auto text-muted" style={{ fontSize: 10.5 }}>
          Саммари ›
        </div>
      )}

      <div className="mt-auto flex items-center gap-2" style={narrow ? { display: 'none' } : undefined}>
        {sentimentLine}
        {!inlineFallback && (
          <span className="ml-auto flex items-center" style={{ fontSize: 11.5, color: '#00D4FF' }}>
            Саммари <ChevronRight size={12} />
          </span>
        )}
      </div>

      {inlineFallback && !done && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); markRead() }}
          className="rounded-full px-4 py-2 text-xs font-semibold"
          style={{ border: '1px solid rgba(0,212,255,.45)', color: '#00D4FF', background: 'transparent' }}
        >
          Отметить прочитанными ({bucket.count})
        </button>
      )}
    </div>
  )
}

// ─── Панель бакета (разъезд) ────────────────────────────────────────────────

function fmtTime(iso: string): string {
  const d = new Date(iso)
  // ТЗ-222 правило 2: подписи окон ВСЕГДА по МСК, независимо от TZ браузера
  return d.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtRange(startIso: string, endIso: string): string {
  return `${fmtTime(startIso)} — ${fmtTime(endIso)}`
}

interface PanelProps {
  bucket: BucketPayload
  onMarkRead: () => void
  onOpenArticle?: (item: { id: string; slug: string | null }) => void
  onClose: () => void
}

export function BucketPanel({ bucket, onMarkRead, onOpenArticle, onClose }: PanelProps) {
  // ТЗ-225: фидбек — из BucketMarkContext (пропсы в frozen node не доходят).
  // Закрытие делаем сами: при markDone показываем галочку 350мс и зовём onClose —
  // он замкнут на правильный CascadeExpandProvider при создании панели.
  const { marking, markDone, markAllSignal } = useContext(BucketMarkContext)
  // ТЗ-225: фидбек «готово» 350мс → закрытие
  useEffect(() => {
    if (!markDone) return
    const t = window.setTimeout(() => onClose(), 350)
    return () => window.clearTimeout(t)
  }, [markDone, onClose])
  // ТЗ-225 доп.: «Прочитать всё» в шапке закрывает открытую панель (с анимаццией)
  const prevSignalRef = useRef(markAllSignal)
  useEffect(() => {
    if (markAllSignal !== prevSignalRef.current) {
      prevSignalRef.current = markAllSignal
      onClose()
    }
  }, [markAllSignal, onClose])
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.08)' }}>
      {/* Шапка */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="font-semibold" style={{ fontSize: 22, letterSpacing: '.05em' }}>
            {bucket.label}
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            {bucket.range_start ? fmtRange(bucket.range_start, bucket.range_end) : `до ${fmtTime(bucket.range_end)} · ${bucket.count} новостей`}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="flex items-center justify-center transition-colors"
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-subtle, rgba(255,255,255,.12))', color: '#6B7280' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#00D4FF')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
        >
          ✕
        </button>
      </div>

      {/* Виральные сюжеты */}
      {bucket.viral_stories > 0 && (
        <div className="flex items-center gap-1.5 mb-3" style={{ fontSize: 11, fontWeight: 600, color: '#F59E0B' }}>
          <Flame size={12} /> {bucket.viral_stories} виральных сюжетов (5+ источников) за период
        </div>
      )}

      {/* Саммари */}
      {bucket.summary && (
        <p className="text-secondary" style={{ fontSize: 13, lineHeight: 1.6, maxWidth: '95ch', whiteSpace: 'pre-line' }}>
          {bucket.summary}
        </p>
      )}
      {!bucket.summary && bucket.top_news.length > 0 && (
        <p className="text-muted" style={{ fontSize: 13 }}>
          Саммари готовится — пока главное из окна:
        </p>
      )}

      {/* Топ новостей */}
      <ul className="flex flex-col gap-2 m-0 p-0 list-none mt-3">
        {bucket.top_news.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onOpenArticle?.({ id: n.id, slug: n.slug })}
              className="w-full flex items-center gap-2 text-left transition-colors"
              style={{ padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,.02)', border: '1px solid transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(0,212,255,.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
            >
              <span className="flex-1 text-sm" style={{ color: '#E5E7EB' }}>{n.title}</span>
              {n.source && <span className="text-muted whitespace-nowrap" style={{ fontSize: 11 }}>{n.source}</span>}
              <span
                style={{
                  fontSize: 11,
                  color: n.sentiment === 'positive' ? '#34D399' : n.sentiment === 'negative' ? '#EF4444' : '#6B7280',
                }}
              >
                {n.sentiment === 'positive' ? '▲' : n.sentiment === 'negative' ? '▼' : '•'}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Футер */}
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          type="button"
          onClick={onMarkRead}
          disabled={marking}
          className="flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-70"
          style={{
            border: `1px solid ${markDone ? 'rgba(52,211,153,.45)' : 'rgba(0,212,255,.45)'}`,
            color: markDone ? '#34D399' : '#00D4FF',
            background: 'transparent',
          }}
        >
          {marking && <Loader2 size={13} className="animate-spin" />}
          {markDone && <Check size={13} />}
          Отметить прочитанными ({bucket.count})
        </button>
        <span className="text-muted" style={{ fontSize: 11 }}>
          Новости бакета уйдут из непрочитанного, саммари останется доступным
        </span>
      </div>
    </div>
  )
}
