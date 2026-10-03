import { useEffect, useRef, type RefObject } from 'react'

// ТЗ-123 (Android TV): при фокусе карточки (D-pad/Tab) горизонтальный ряд
// карусели дотягивается до неё — scrollIntoView с nearest по обеим осям
// прокручивает только ближайших скроллящихся предков, поэтому трек сдвигается,
// а вертикальный скролл страницы не дёргается, если карточка уже видна.
//
// Хук возвращает ref — вешать на контейнер трека (NewsCarousel). Слушаем
// focusin (всплывает), реагируем только на .focusable, чтобы инпуты/чипы
// внутри карточек не провоцировали лишних скроллов.
export function useFocusScroll<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.classList?.contains('focusable')) return
      if (!root.contains(target)) return
      target.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    }

    root.addEventListener('focusin', onFocusIn)
    return () => root.removeEventListener('focusin', onFocusIn)
  }, [])

  return ref
}
