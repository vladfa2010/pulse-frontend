import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type VoteToastVariant = 'sync' | 'balance' | 'contrarian'

interface VoteToastProps {
  variant: VoteToastVariant
  message: string
  icon: string
  withConfetti?: boolean
  onDone?: () => void
}

const CONFETTI_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b', '#ffffff', '#a7f3d0']
const SHAPES = ['rect', 'circle', 'star'] as const

interface Particle {
  id: number
  shape: typeof SHAPES[number]
  color: string
  size: number
  tx: number
  ty: number
  tx2: number
  ty2: number
  rot: number
  rot2: number
  delay: number
}

function generateParticles(count = 24): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI * 2
    const dist1 = 30 + Math.random() * 50
    const dist2 = 60 + Math.random() * 80
    return {
      id: i,
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 4 + Math.random() * 6,
      tx: Math.cos(angle) * dist1,
      ty: Math.sin(angle) * dist1 - 20,
      tx2: Math.cos(angle) * dist2,
      ty2: Math.sin(angle) * dist2 + 20,
      rot: (Math.random() - 0.5) * 720,
      rot2: (Math.random() - 0.5) * 1440,
      delay: Math.random() * 150,
    }
  })
}

export default function VoteToast({ variant, message, icon, withConfetti, onDone }: VoteToastProps) {
  const toastRef = useRef<HTMLDivElement>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const [toastRect, setToastRect] = useState<DOMRect | null>(null)
  const [animate, setAnimate] = useState(false)
  const firedRef = useRef(false)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  })

  useEffect(() => {
    if (!withConfetti || firedRef.current) return
    firedRef.current = true
    setParticles(generateParticles())
    const t1 = setTimeout(() => {
      setToastRect(toastRef.current?.getBoundingClientRect() ?? null)
      const t2 = setTimeout(() => setAnimate(true), 50)
      return () => clearTimeout(t2)
    }, 100)
    return () => clearTimeout(t1)
  }, [withConfetti])

  useEffect(() => {
    const doneTimer = setTimeout(() => {
      onDoneRef.current?.()
    }, 4000)
    return () => clearTimeout(doneTimer)
  }, [])

  const borderColor =
    variant === 'sync'
      ? 'rgba(16, 185, 129, 0.3)'
      : variant === 'contrarian'
        ? 'rgba(168, 85, 247, 0.3)'
        : 'rgba(255, 255, 255, 0.1)'

  const boxShadow =
    variant === 'sync'
      ? '0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(16, 185, 129, 0.2)'
      : variant === 'contrarian'
        ? '0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(168, 85, 247, 0.2)'
        : '0 20px 50px rgba(0,0,0,0.5)'

  const confettiHost =
    withConfetti && particles.length > 0 && toastRect
      ? createPortal(
          <div
            className="pointer-events-none overflow-visible"
            style={{
              position: 'fixed',
              zIndex: 1001,
              left: toastRect.left + toastRect.width / 2,
              top: toastRect.top + toastRect.height / 2,
              width: 300,
              height: 300,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <svg className="vote-confetti-wrap" viewBox="-150 -150 300 300">
              <defs>
                <radialGradient id="confettiGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle
                className={`vote-confetti-glow ${animate ? 'animate' : ''}`}
                cx="0"
                cy="0"
                r="60"
                fill="url(#confettiGlow)"
              />
              {particles.map((p) => (
                <g
                  key={p.id}
                  className={`vote-confetti-particle ${animate ? 'animate' : ''}`}
                  style={{
                    '--tx': `${p.tx}px`,
                    '--ty': `${p.ty}px`,
                    '--tx2': `${p.tx2}px`,
                    '--ty2': `${p.ty2}px`,
                    '--rot': `${p.rot}deg`,
                    '--rot2': `${p.rot2}deg`,
                    '--delay': `${p.delay}ms`,
                  } as any}
                >
                  {p.shape === 'circle' && (
                    <circle cx="0" cy="0" r={p.size / 2} fill={p.color} />
                  )}
                  {p.shape === 'rect' && (
                    <rect
                      x={-p.size / 2}
                      y={-p.size / 2}
                      width={p.size}
                      height={p.size * 0.6}
                      fill={p.color}
                      rx={2}
                    />
                  )}
                  {p.shape === 'star' && (
                    <polygon
                      points={`0,${-p.size / 2} ${p.size * 0.22},${-p.size * 0.05} ${p.size / 2},0 ${p.size * 0.22},${p.size * 0.05} 0,${p.size / 2} ${-p.size * 0.22},${p.size * 0.05} ${-p.size / 2},0 ${-p.size * 0.22},${-p.size * 0.05}`}
                      fill={p.color}
                    />
                  )}
                </g>
              ))}
            </svg>
          </div>,
          document.body
        )
      : null

  return (
    <>
      {confettiHost}
      <div
        ref={toastRef}
        className="relative w-fit mx-auto mt-4 z-10 pointer-events-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative flex items-center gap-3 px-7 py-4 rounded-2xl text-base font-semibold text-white bg-[rgba(11,15,25,0.95)] backdrop-blur-xl border border-white/10"
          style={{
            borderColor,
            boxShadow,
            animation: 'toastIn 0.4s cubic-bezier(0.4, 0, 0.2, 1), toastOut 0.4s ease 3.5s forwards',
          }}
        >
          <span className="text-lg">{icon}</span>
          <span>{message}</span>
        </div>
      </div>
    </>
  )
}
