import { useEffect, useRef, type RefObject } from 'react'
import { pushModal, popModal } from '@/lib/modalStack'

// ТЗ-123 (Android TV): focus-trap для модалок.
// - открытие: фокус на [data-autofocus] или первый focusable внутри панели;
// - Tab/Shift+Tab циклятся внутри панели (только пока модалка верхняя в стеке);
// - закрытие/размонтирование: фокус возвращается на элемент-источник,
//   запомненный при открытии;
// - onClose (опционально): Escape закрывает модалку. Компоненты, которые уже
//   обрабатывают Escape сами (GlassModal, NewsDetailModal — там гард на
//   диалог удаления), onClose не передают — двойного срабатывания нет.
// Модалка регистрируется в глобальном стеке (lib/modalStack) — по нему
// useBackButton решает, закрывать модалку кнопкой «Назад» пульта или идти
// по истории назад.

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface UseModalFocusTrapOptions {
  open: boolean
  containerRef: RefObject<HTMLElement | null>
  onClose?: () => void
}

export function useModalFocusTrap({ open, containerRef, onClose }: UseModalFocusTrapOptions) {
  const modalIdRef = useRef<symbol | null>(null)
  const restoreRef = useRef<Element | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const modalId = Symbol('modal')
    modalIdRef.current = modalId
    restoreRef.current = document.activeElement
    pushModal(modalId)

    // Фокус первого элемента: [data-autofocus] в приоритете, иначе первый
    // focusable. rAF — панель/анимация смонтированы к моменту фокуса.
    const focusTimer = requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      const autofocus = container.querySelector<HTMLElement>('[data-autofocus]')
      const first = autofocus ?? container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      first?.focus({ preventScroll: true })
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      const container = containerRef.current
      if (!container) return

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      cancelAnimationFrame(focusTimer)
      document.removeEventListener('keydown', onKeyDown, true)
      if (modalIdRef.current) {
        popModal(modalIdRef.current)
        modalIdRef.current = null
      }
      // Возвращаем фокус элементу-источнику (карточке/кнопке под модалкой).
      const restore = restoreRef.current as HTMLElement | null
      if (restore && typeof restore.focus === 'function' && document.contains(restore)) {
        restore.focus({ preventScroll: true })
      }
      restoreRef.current = null
    }
  }, [open, containerRef])
}
