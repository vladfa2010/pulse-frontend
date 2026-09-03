import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Рендерит children только когда обёртка впервые приблизилась к вьюпорту.
 * До этого — пустой div-плейсхолдер (нулевой высоты, сдвига раскладки нет,
 * т.к. оба блока — последние на странице).
 *
 * ТЗ-48: one-shot (отписываемся после первого срабатывания), увеличенный
 * rootMargin — данные успевают прийти до появления блока в вьюпорте.
 */
export default function LazyRender({ children, rootMargin = '400px' }: { children: ReactNode; rootMargin?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) { setVisible(true); return }  // fallback: старые браузеры
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible, rootMargin])

  return <div ref={ref}>{visible ? children : null}</div>
}
