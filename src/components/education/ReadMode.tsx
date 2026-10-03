/**
 * =============================================================================
 * ТЗ-132 — Режим чтения: полноэкранная «книжная» читалка конспекта
 * =============================================================================
 *
 * Пагинация — CSS multi-column: контенту задаём column-width равной ширине
 * страницы, число страниц = scrollWidth / step. Листание — translateX с
 * transition (§5.3). Навигация: тап-зоны по кромкам, тап по центру —
 * toggle хрома, клавиатура (←/→/Space/Esc) только пока открыта читалка.
 * Позиция и посещённые страницы живут в LessonPage (на сессию, без localStorage).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const EASE_EXPO = 'cubic-bezier(0.16,1,0.3,1)'

interface ReadModeProps {
  lessonId: string // для сброса пагинации при смене урока (компонент не пересоздаётся)
  title: string
  html: string // санитизированный text_content урока
  open: boolean
  onClose: () => void
  page: number // текущая страница (владеет LessonPage — переживает переоткрытие)
  onPageChange: (page: number) => void
  pages: number
  onPages: (n: number) => void
  readerScale: number // --reader-scale страницы урока (в читалке не меняется)
  allVisited: boolean // посещены ВСЕ страницы (Set живёт в LessonPage)
  hasTest: boolean
  completed: boolean
  canComplete: boolean // записан и не пройден — иначе rm-done скрыта (гость)
  onDone: () => void // «Завершить урок ✓» / «Перейти к тесту →»
}

export default function ReadMode(props: ReadModeProps) {
  const { open, onClose, page, onPageChange, pages, onPages, readerScale } = props
  const rootRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [chromeHidden, setChromeHidden] = useState(false)

  const clampPage = useCallback(
    (p: number, n: number) => Math.min(n, Math.max(1, p)),
    [],
  )

  // ─── Пагинация: multi-column + измерение числа страниц ──────────────────
  const paginate = useCallback(() => {
    const el = contentRef.current
    const pageEl = pageRef.current
    if (!el || !pageEl || !open) return
    // transform на измерение scrollWidth не влияет — не трогаем его здесь,
    // иначе раф-пагинация после layout-эффекта листания обнулит страницу.
    const step = el.clientWidth
    if (step <= 0) return
    el.style.height = '100%'
    el.style.columnWidth = `${step}px`
    el.style.columnGap = '0'
    // §5.3: transition листания задаётся при инициализации пагинации
    el.style.transition = `transform .3s ${EASE_EXPO}`
    const n = Math.max(1, Math.round(el.scrollWidth / step))
    onPages(n)
    onPageChange(clampPage(page, n))
  }, [open, page, onPageChange, onPages, clampPage])

  useLayoutEffect(() => {
    if (!open) return
    // Два кадра: сначала раскладка колонок, потом измерение
    const raf = requestAnimationFrame(() => requestAnimationFrame(paginate))
    return () => cancelAnimationFrame(raf)
  }, [open, props.lessonId, readerScale, paginate])

  // Пересчёт при ресайзе
  useEffect(() => {
    if (!open) return
    const ro = new ResizeObserver(() => paginate())
    if (pageRef.current) ro.observe(pageRef.current)
    return () => ro.disconnect()
  }, [open, paginate])

  // ─── Листание: transform на контенте ─────────────────────────────────────
  useLayoutEffect(() => {
    const el = contentRef.current
    const pageEl = pageRef.current
    if (!el || !pageEl) return
    const step = el.clientWidth
    if (step <= 0) return
    el.style.transform = `translateX(${-(clampPage(page, pages) - 1) * step}px)`
  }, [page, pages, open, clampPage])

  // ─── Хром, body-overflow, fullscreen ─────────────────────────────────────
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const el = rootRef.current
    const tryFs = el?.requestFullscreen?.bind(el)
    if (tryFs) tryFs().catch(() => undefined) // iOS Safari нет — overlay и так fixed
    return () => {
      document.body.style.overflow = ''
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
    }
  }, [open])

  // ─── Клавиатура (только пока открыта читалка) ────────────────────────────
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault() // пробел иначе проскроллит страницу
        onPageChange(clampPage(page + 1, pages))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPageChange(clampPage(page - 1, pages))
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, page, pages, onClose, onPageChange, clampPage])

  const prev = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onPageChange(clampPage(page - 1, pages))
    },
    [page, pages, onPageChange, clampPage],
  )
  const next = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onPageChange(clampPage(page + 1, pages))
    },
    [page, pages, onPageChange, clampPage],
  )

  const pct = pages > 1 ? Math.round(((clampPage(page, pages) - 1) / (pages - 1)) * 100) : 100
  const showDone = props.canComplete || props.completed

  if (!open) return null

  return (
    <div
      ref={rootRef}
      className={`read-mode open ${chromeHidden ? 'hide-chrome' : ''}`}
    >
      <div className="rm-top rm-chrome">
        <button className="rm-close" onClick={onClose} title="Закрыть (Esc)">✕</button>
        <span className="rm-title">Конспект · {props.title}</span>
        <span className="rm-pct">{pct}%</span>
      </div>
      <div className="rm-stage" onClick={() => setChromeHidden(h => !h)}>
        <div className="rm-pages">
          <div
            className="rm-page"
            ref={pageRef}
            style={{ ['--reader-scale' as string]: readerScale }}
          >
            <div
              className="content edu-content"
              ref={contentRef}
              dangerouslySetInnerHTML={{ __html: props.html }}
            />
          </div>
        </div>
        <div className="rm-tap prev" onClick={prev} title="Предыдущая страница" />
        <div className="rm-tap next" onClick={next} title="Следующая страница" />
      </div>
      <div className="rm-bot rm-chrome">
        <span className="rm-page-num">{clampPage(page, pages)} / {pages}</span>
        <input
          type="range"
          min={1}
          max={pages}
          value={clampPage(page, pages)}
          onChange={e => onPageChange(Number(e.target.value))}
        />
        {showDone && (
          <button
            className={`rm-done ${props.allVisited ? 'show' : ''} ${props.completed ? 'done' : ''}`}
            onClick={props.onDone}
          >
            {props.completed ? 'Пройдено ✓' : props.hasTest ? 'Перейти к тесту →' : 'Завершить урок ✓'}
          </button>
        )}
      </div>
    </div>
  )
}
