/**
 * PULSE — Радио: BorderGlow-кнопка (ТЗ-50, задача 2).
 *
 * Порт BorderGlow (reactbits) с мокапа главной (features.html):
 * mesh-рамка + внешнее свечение, авто-пробег при появлении во вьюпорте,
 * дальше — следит за курсором. Параметры: edgeSensitivity=40,
 * glowIntensity=1.4, coneSpread=25, glowColor HSL фирменного #00D4FF.
 * Реализация 1:1 с мокапом — визуал должен совпадать с кнопкой регистрации.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

const COLORS = ['#00D4FF', '#34D399', '#A78BFA']
const GLOW_HSL = '192 100 50'
const EDGE = 40
const INTENSITY = 1.4
const CONE = 25
const GLOW_R = 40
const GRAD_POS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%']
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1]

function parseHSL(s: string): { h: number; s: number; l: number } {
  const m = s.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/)
  return m ? { h: +m[1], s: +m[2], l: +m[3] } : { h: 40, s: 80, l: 80 }
}

function buildBoxShadow(intensity: number): string {
  const c = parseHSL(GLOW_HSL)
  const base = `${c.h}deg ${c.s}% ${c.l}%`
  const layers: [number, number, number, number, number][] = [
    [0, 0, 1, 0, 60],
    [0, 0, 3, 0, 50],
    [0, 0, 6, 0, 40],
    [0, 0, 15, 0, 30],
    [0, 0, 25, 2, 20],
    [0, 0, 50, 2, 10],
  ]
  return layers
    .map((l) => {
      const a = Math.min(l[4] * intensity, 100)
      return `${l[0]}px ${l[1]}px ${l[2]}px ${l[3]}px hsl(${base} / ${a}%)`
    })
    .join(', ')
}

function mesh(): string[] {
  const g: string[] = []
  for (let i = 0; i < 7; i++) {
    g.push(
      `radial-gradient(at ${GRAD_POS[i]}, ${COLORS[Math.min(COLOR_MAP[i], COLORS.length - 1)]} 0px, transparent 50%)`,
    )
  }
  return g
}

function easeOut(x: number): number {
  return 1 - Math.pow(1 - x, 3)
}
function easeIn(x: number): number {
  return x * x * x
}
function animateValue(o: {
  start?: number
  end?: number
  duration?: number
  delay?: number
  ease?: (x: number) => number
  onUpdate: (v: number) => void
  onEnd?: () => void
}) {
  const start = o.start || 0
  const end = o.end === undefined ? 100 : o.end
  const dur = o.duration || 1000
  const delay = o.delay || 0
  const ease = o.ease || easeOut
  const t0 = performance.now() + delay
  setTimeout(() => {
    requestAnimationFrame(function tick() {
      const t = Math.min((performance.now() - t0) / dur, 1)
      o.onUpdate(start + (end - start) * ease(t))
      if (t < 1) requestAnimationFrame(tick)
      else if (o.onEnd) o.onEnd()
    })
  }, delay)
}

function edgeProximity(el: HTMLElement, x: number, y: number): number {
  const cx = el.offsetWidth / 2
  const cy = el.offsetHeight / 2
  const dx = x - cx
  const dy = y - cy
  const kx = dx !== 0 ? cx / Math.abs(dx) : Infinity
  const ky = dy !== 0 ? cy / Math.abs(dy) : Infinity
  return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1)
}

function cursorAngle(el: HTMLElement, x: number, y: number): number {
  const dx = x - el.offsetWidth / 2
  const dy = y - el.offsetHeight / 2
  if (dx === 0 && dy === 0) return 0
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  return deg < 0 ? deg + 360 : deg
}

interface Props {
  onClick?: () => void
  /** css-фон поверхности кнопки (заливка) */
  surface: string
  className?: string
  style?: CSSProperties
  title?: string
  children: ReactNode
}

export function BorderGlowButton({ onClick, surface, className = '', style, title, children }: Props) {
  const elRef = useRef<HTMLButtonElement>(null)
  const st = useRef({ hovered: false, sweep: false, prox: 0, angle: 45, running: false })

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const border = el.querySelector<HTMLElement>('.bg-border')
    const glow = el.querySelector<HTMLElement>('.bg-glow')
    const glowInner = el.querySelector<HTMLElement>('.bg-glow-inner')
    if (!border || !glow || !glowInner) return

    const meshG = mesh()
    el.style.background = surface

    border.style.border = '1px solid transparent'
    border.style.background = [surface + ' padding-box', 'linear-gradient(rgb(255 255 255 / 0%) 0% 100%) border-box']
      .concat(meshG.map((g) => g + ' border-box'))
      .join(', ')
    glow.style.inset = -GLOW_R + 'px'
    glowInner.style.inset = GLOW_R + 'px'
    glowInner.style.boxShadow = buildBoxShadow(INTENSITY)

    const render = () => {
      const { hovered, sweep: sw, prox, angle } = st.current
      const vis = hovered || sw
      const bOp = vis ? Math.max(0, (prox * 100 - (EDGE + 20)) / (100 - (EDGE + 20))) : 0
      const gOp = vis ? Math.max(0, (prox * 100 - EDGE) / (100 - EDGE)) : 0
      const a = angle.toFixed(3) + 'deg'
      border.style.opacity = String(bOp)
      border.style.transition = vis ? 'opacity .25s ease-out' : 'opacity .75s ease-in-out'
      border.style.maskImage = border.style.webkitMaskImage =
        `conic-gradient(from ${a} at center, black ${CONE}%, transparent ${CONE + 15}%, transparent ${100 - CONE - 15}%, black ${100 - CONE}%)`
      glow.style.opacity = String(gOp)
      glow.style.transition = border.style.transition
      glow.style.mixBlendMode = 'plus-lighter'
      glow.style.maskImage = glow.style.webkitMaskImage =
        `conic-gradient(from ${a} at center, black 2.5%, transparent 10%, transparent 90%, black 97.5%)`
    }

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      st.current.prox = edgeProximity(el, e.clientX - r.left, e.clientY - r.top)
      st.current.angle = cursorAngle(el, e.clientX - r.left, e.clientY - r.top)
      render()
    }
    const onEnter = () => {
      st.current.hovered = true
      render()
    }
    const onLeave = () => {
      st.current.hovered = false
      render()
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointerleave', onLeave)

    // автоанимация пробега — при появлении кнопки во вьюпорте (повторяется при каждом входе)
    const sweepRun = () => {
      if (st.current.running || st.current.hovered) return
      st.current.running = true
      const aS = 110
      const aE = 465
      st.current.sweep = true
      st.current.angle = aS
      animateValue({ duration: 500, onUpdate: (v) => { st.current.prox = v / 100; render() } })
      animateValue({ ease: easeIn, duration: 1500, end: 50, onUpdate: (v) => { st.current.angle = ((aE - aS) * v) / 100 + aS; render() } })
      animateValue({ ease: easeOut, delay: 1500, duration: 2250, start: 50, end: 100, onUpdate: (v) => { st.current.angle = ((aE - aS) * v) / 100 + aS; render() } })
      animateValue({
        ease: easeIn,
        delay: 2500,
        duration: 1500,
        start: 100,
        end: 0,
        onUpdate: (v) => { st.current.prox = v / 100; render() },
        onEnd: () => { st.current.sweep = false; st.current.running = false; render() },
      })
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) sweepRun() }),
      { threshold: 0.6 },
    )
    io.observe(el)
    render()

    return () => {
      io.disconnect()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [surface])

  return (
    <button
      ref={elRef}
      type="button"
      onClick={onClick}
      title={title}
      className={`bgbtn ${className}`}
      style={style}
    >
      <span className="bg-border" />
      <span className="bg-glow">
        <span className="bg-glow-inner" />
      </span>
      <span className="bg-content">{children}</span>
    </button>
  )
}
