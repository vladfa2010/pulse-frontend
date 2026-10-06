/**
 * =============================================================================
 * ТЗ-132 — Режим чтения: полноэкранная «книжная» читалка конспекта
 * =============================================================================
 *
 * Пагинация — CSS multi-column: контенту задаём column-width равной ширине
 * страницы, число страниц = scrollWidth / step. Листание — программный
 * scrollLeft ленты .rm-strip (ТЗ-146: transform на предке мультиколонки
 * пробивал клипы движков — протечка соседних страниц). Навигация: тап-зоны
 * по кромкам, тап по центру — toggle хрома, клавиатура (←/→/Space/Esc)
 * только пока открыта читалка.
 * Позиция и посещённые страницы живут в LessonPage (на сессию, без localStorage).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { Check } from 'lucide-react'
import { resolveMediaHtml } from '@/lib/media'
import type { LessonContent } from '@/lib/educationApi'
import LessonChartBlock, { readChartBlockAttrs, type ChartBlockAttrs } from './LessonChartBlock'
import NextLessonCta from './NextLessonCta'

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
  canComplete: boolean // записан и не пройден — иначе пилюля «Завершить урок» скрыта (гость)
  onDone: () => void // «Завершить урок ✓» / «Перейти к тесту →»
  /** ТЗ-147: CTA «Следующий урок» внизу читалки (показывается, когда урок засчитан). */
  nextLesson: LessonContent['next_lesson']
  courseSlug: string
}

export default function ReadMode(props: ReadModeProps) {
  const { open, onClose, page, onPageChange, pages, onPages, readerScale } = props
  const rootRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const stripRef = useRef<HTMLDivElement | null>(null) // ТЗ-146: лента — скролл-контейнер листания
  const navigate = useNavigate()

  // ТЗ-149: «вперёд» с последней страницы = нажатие CTA «Следующий урок».
  // drip — не ведём (карточка-заглушка); next === null — некуда.
  const goNextLesson = useCallback(() => {
    const n = props.nextLesson
    if (!n || n.access === 'drip') return
    // ТЗ-151: keepReader — цепочка бесшовного чтения; LessonPage держит
    // читалку открытой поверх загрузки следующего урока.
    navigate(`/education/lesson/${n.id}`, { state: { keepReader: true } })
  }, [props.nextLesson, navigate])
  const [chromeHidden, setChromeHidden] = useState(false)

  // ТЗ-144: chart-блоки конспекта в читалке — та же портальная монтировка,
  // что на странице урока (LessonPage). Эффект на open+html: overlay
  // создаётся при открытии (createPortal в body), до этого
  // contentRef.current === null.
  const [chartMounts, setChartMounts] = useState<{ el: HTMLElement; attrs: ChartBlockAttrs }[]>([])
  useEffect(() => {
    if (!open) { setChartMounts([]); return }
    const root = contentRef.current
    if (!root) return
    const els = Array.from(root.querySelectorAll<HTMLElement>('div.chart-block'))
    setChartMounts(els.map((el) => ({ el, attrs: readChartBlockAttrs(el) })))
  }, [open, props.html])

  const clampPage = useCallback(
    (p: number, n: number) => Math.min(n, Math.max(1, p)),
    [],
  )

  // ─── Пагинация: multi-column + измерение числа страниц ──────────────────
  const paginate = useCallback(() => {
    const el = contentRef.current
    const strip = stripRef.current
    const pageEl = pageRef.current
    if (!el || !strip || !pageEl || !open) return
    const step = el.clientWidth
    if (step <= 0) return
    el.style.height = '100%'
    el.style.columnWidth = `${step}px`
    el.style.columnGap = '0'
    const n = Math.max(1, Math.round(el.scrollWidth / step))
    onPages(n)
    const p = clampPage(page, n)
    onPageChange(p)
    // Перепагинация (открытие, ресайз) не должна анимироваться —
    // позицию восстанавливаем мгновенно, ДО кадра раскраски
    strip.scrollTo({ left: (p - 1) * step, behavior: 'instant' as ScrollBehavior })
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

  // ─── Листание: скролл ленты (ТЗ-146), НЕ transform ─────────────────────
  // transform на ЛЮБОМ предке мультиколонки пробивает клипы движков
  // (Chromium/WebKit рисуют соседние колонки поверх видимой области).
  // Скролл клипуется корректно; smooth — анимация листания.
  useLayoutEffect(() => {
    const strip = stripRef.current
    const el = contentRef.current
    const pageEl = pageRef.current
    if (!strip || !el || !pageEl) return
    const step = el.clientWidth
    if (step <= 0) return
    strip.scrollTo({ left: (clampPage(page, pages) - 1) * step, behavior: 'smooth' })
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
        // ТЗ-149: последняя страница → след. урок (как кнопка CTA)
        if (page >= pages) goNextLesson()
        else onPageChange(clampPage(page + 1, pages))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPageChange(clampPage(page - 1, pages))
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, page, pages, onClose, onPageChange, clampPage, goNextLesson])

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
      if (page >= pages) goNextLesson() // ТЗ-149: последняя страница → след. урок
      else onPageChange(clampPage(page + 1, pages))
    },
    [page, pages, onPageChange, clampPage, goNextLesson],
  )

  const pct = pages > 1 ? Math.round(((clampPage(page, pages) - 1) / (pages - 1)) * 100) : 100
  const showDone = props.canComplete || props.completed
  // ТЗ-149: CTA «Следующий урок» в читалке — после засчитывания (или гостю,
  // дочитавшему все страницы — бэк сам ответит вилкой доступности)
  const showNextCta = props.completed || (props.allVisited && !props.canComplete)

  // ТЗ-149 (сцена 3 мокапа): «Урок засчитан» — строка под прогресс-баром ~3 с.
  // Триггер — фактический переход completed false→true при открытой читалке
  // (по rmDone сразу после «Завершить урок ✓» или по reload). При повторном
  // открытии уже пройденного урока заметка не вспыхивает (prev-реф).
  const [justCompleted, setJustCompleted] = useState(false)
  const prevCompletedRef = useRef(props.completed) // инициализация: открытие уже пройденного урока — не «засчитывание»
  useEffect(() => {
    if (props.completed && !prevCompletedRef.current && open) setJustCompleted(true)
    prevCompletedRef.current = props.completed
  }, [props.completed, open])
  useEffect(() => {
    if (!justCompleted) return
    const t = setTimeout(() => setJustCompleted(false), 3000)
    return () => clearTimeout(t)
  }, [justCompleted])

  if (!open) return null

  // ТЗ-134: portal в body — <main> имеет transform (gpu-content), который
  // делает себя containing block для fixed и запирает читалку в своём stacking
  // context ниже z-50 шапки. В body z-index:200 реально поверх всего.
  return createPortal(
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
            {/* ТЗ-146: лента — скролл-контейнер (overflow:hidden), листание —
                программный scrollLeft. transform здесь ЗАПРЕЩЁН: на предке
                мультиколонки он пробивает клипы движков (протечка страниц) */}
            <div className="rm-strip" ref={stripRef}>
              <div
                className="content edu-content"
                ref={contentRef}
                dangerouslySetInnerHTML={{ __html: resolveMediaHtml(props.html) }}
              />
            </div>
          </div>
        </div>
        <div className="rm-tap prev" onClick={prev} title="Предыдущая страница" />
        <div className="rm-tap next" onClick={next} title="Следующая страница" />
      </div>
      {chartMounts.map((m, i) => createPortal(
        <LessonChartBlock key={`${m.attrs.ticker}-${m.attrs.exchange}-${i}`} {...m.attrs} />,
        m.el,
      ))}
      <div className="rm-bot rm-chrome">
        {/* строка 1: прогресс */}
        <div className="rm-progress">
          <span className="rm-page-num">{clampPage(page, pages)} / {pages}</span>
          <input
            type="range"
            className="rm-slider"
            min={1}
            max={pages}
            value={clampPage(page, pages)}
            onChange={e => onPageChange(Number(e.target.value))}
          />
        </div>
        {/* строка 2: действия — рендерится только на последней странице,
            когда есть что показать (статус/CTA); иначе панель однострочная.
            «Завершить урок ✓» кликабелен, только когда все страницы посещены
            (прежний гейт allVisited у rm-done — логика не меняется). */}
        {clampPage(page, pages) >= pages && (showDone || showNextCta) && (
          <div className="rm-actions">
            {showDone && (props.completed
              ? <span className="rm-status">Уже пройден ✓</span>
              : props.allVisited && (
                <button className={`nl-cta-btn reader ${props.hasTest ? '' : 'done'}`} onClick={props.onDone}>
                  {props.hasTest ? 'Перейти к тесту →' : 'Завершить урок ✓'}
                </button>
              ))}
            {/* ТЗ-147: после засчитывания — CTA к следующему уроку (или «Курс
                пройден»). ТЗ-149: только на последней странице (гейт строки выше). */}
            {showNextCta && (
              <NextLessonCta next={props.nextLesson} courseSlug={props.courseSlug} />
            )}
          </div>
        )}
        {/* ТЗ-149: подтверждение засчитывания — строка под баром, ~3 с,
            БЕЗ глобального тоста (сцена 3 мокапа) */}
        {justCompleted && (
          <div className="rm-note"><Check size={14} /> Урок засчитан</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
