import { useEffect, useRef, useState } from 'react'

interface TextTypeProps {
  text: string | string[]
  typingSpeed?: number
  deletingSpeed?: number
  pauseDuration?: number
  loop?: boolean
  initialDelay?: number
  showCursor?: boolean
  startOnVisible?: boolean
  /** При true компонент ничего не рендерит и останавливает таймеры */
  stopped?: boolean
}

/**
 * Порт react-bits TextType без gsap (мигание курсора — CSS keyframes pulse-caret).
 * Движок: setTimeout-автомат печать/стирание по кругу.
 */
export default function TextType({
  text,
  typingSpeed = 40,
  deletingSpeed = 20,
  pauseDuration = 2000,
  loop = true,
  initialDelay = 0,
  showCursor = true,
  startOnVisible = false,
  stopped = false,
}: TextTypeProps) {
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const [hasStarted, setHasStarted] = useState(!startOnVisible)

  const containerRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<number | null>(null)
  const initialDelayUsedRef = useRef(false)

  const texts = Array.isArray(text) ? text : [text]

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  // Старт по видимости (IntersectionObserver, threshold 0.1)
  useEffect(() => {
    if (!startOnVisible || hasStarted) return
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setHasStarted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [startOnVisible, hasStarted])

  // Автомат печати/стирания
  useEffect(() => {
    if (stopped || !hasStarted || texts.length === 0) return

    const currentText = texts[currentTextIndex % texts.length]

    const schedule = (fn: () => void, delay: number) => {
      clearTimer()
      timerRef.current = window.setTimeout(fn, delay)
    }

    if (!isDeleting && currentCharIndex < currentText.length) {
      // Печать (перед самым первым символом — initialDelay, один раз)
      const delay = !initialDelayUsedRef.current ? initialDelay : typingSpeed
      initialDelayUsedRef.current = true
      schedule(() => setCurrentCharIndex(i => i + 1), delay)
    } else if (!isDeleting && currentCharIndex === currentText.length) {
      if (texts.length > 1) {
        // Многострочный режим: пауза → следующая фраза (или стирание, если не loop и последняя)
        if (currentTextIndex < texts.length - 1 || loop) {
          schedule(() => {
            setCurrentCharIndex(0)
            setCurrentTextIndex(i => (i + 1) % texts.length)
          }, pauseDuration)
        }
      } else if (loop) {
        // Одна фраза: пауза → стирание
        schedule(() => setIsDeleting(true), pauseDuration)
      }
    } else if (isDeleting && currentCharIndex > 0) {
      // Стирание
      schedule(() => setCurrentCharIndex(i => i - 1), deletingSpeed)
    } else if (isDeleting && currentCharIndex === 0) {
      // Стёрли — начинаем печать заново
      setIsDeleting(false)
    }

    return clearTimer
  }, [stopped, hasStarted, currentCharIndex, isDeleting, currentTextIndex, texts, typingSpeed, deletingSpeed, pauseDuration, loop, initialDelay])

  // Cleanup при анмаунте
  useEffect(() => clearTimer, [])

  if (stopped) return null

  const currentText = texts[currentTextIndex % texts.length]

  return (
    <span ref={containerRef} aria-hidden="true">
      <span>{currentText.substring(0, currentCharIndex)}</span>
      {showCursor && (
        <span
          className="inline-block"
          style={{
            color: '#00D4FF',
            animation: 'pulse-caret 1s step-end infinite',
          }}
        >
          |
        </span>
      )}
    </span>
  )
}
