import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type VoteToastVariant = 'sync' | 'balance' | 'contrarian'

interface VoteToastProps {
  variant: VoteToastVariant
  message: string
  icon: string
  withConfetti?: boolean
  onDone?: () => void
}

interface ColorSpec {
  main: string
  light: string
  glow: string
}

const COLORS: ColorSpec[] = [
  { main: '#34D399', light: '#6EE7B7', glow: 'rgba(52,211,153,0.6)' },
  { main: '#10B981', light: '#34D399', glow: 'rgba(16,185,129,0.6)' },
  { main: '#FBBF24', light: '#FCD34D', glow: 'rgba(251,191,36,0.6)' },
  { main: '#F59E0B', light: '#FBBF24', glow: 'rgba(245,158,11,0.6)' },
  { main: '#00D4FF', light: '#67E8F9', glow: 'rgba(0,212,255,0.5)' },
  { main: '#A7F3D0', light: '#D1FAE5', glow: 'rgba(167,243,208,0.5)' },
  { main: '#FFFFFF', light: '#F3F4F6', glow: 'rgba(255,255,255,0.4)' },
]

type ParticleType = 'sphere' | 'cube' | 'ring' | 'star'

interface Particle {
  id: number
  type: ParticleType
  color: ColorSpec
  size: number
  tx: number
  ty: number
  tz: number
  tx2: number
  ty2: number
  tz2: number
  rx: number
  ry: number
  rz: number
  rx2: number
  ry2: number
  rz2: number
  duration: number
  delay: number
}

interface AmbientParticle {
  id: number
  size: number
  color: ColorSpec
  dx: number
  dy: number
  duration: number
  delay: number
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function isMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function createParticle(id: number): Particle {
  const angle = rand(0, Math.PI * 2)
  const elev = rand(-Math.PI / 3, Math.PI / 3)
  const dist1 = rand(30, 90)
  const dist2 = rand(180, 380)
  const color = pick(COLORS)
  const size = rand(6, 18)
  const type = pick<ParticleType>(['sphere', 'cube', 'ring', 'star'])
  const duration = rand(1.8, 2.8)

  const tx = Math.cos(angle) * Math.cos(elev) * dist1
  const ty = Math.sin(angle) * Math.cos(elev) * dist1 - rand(10, 40)
  const tz = Math.sin(elev) * dist1

  const tx2 = Math.cos(angle) * Math.cos(elev) * dist2
  const ty2 = Math.sin(angle) * Math.cos(elev) * dist2 + rand(20, 80)
  const tz2 = Math.sin(elev) * dist2 * 1.5

  const rx = rand(-360, 360)
  const ry = rand(-360, 360)
  const rz = rand(-720, 720)
  const rx2 = rx + rand(-720, 720)
  const ry2 = ry + rand(-720, 720)
  const rz2 = rz + rand(-1440, 1440)

  return {
    id,
    type,
    color,
    size,
    tx,
    ty,
    tz,
    tx2,
    ty2,
    tz2,
    rx,
    ry,
    rz,
    rx2,
    ry2,
    rz2,
    duration,
    delay: rand(0, 150),
  }
}

function createAmbientParticle(id: number): AmbientParticle {
  const size = rand(3, 8)
  const color = pick(COLORS)
  const dx = rand(-150, 150)
  const dy = rand(-200, -50)
  return {
    id,
    size,
    color,
    dx,
    dy,
    duration: rand(2, 4),
    delay: rand(0, 400),
  }
}

export default function VoteToast({ variant, message, icon, withConfetti, onDone }: VoteToastProps) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const [ambient, setAmbient] = useState<AmbientParticle[]>([])
  const [isExiting, setIsExiting] = useState(false)
  const firedRef = useRef(false)
  const onDoneRef = useRef(onDone)
  const reduceMotion = useMemo(() => prefersReducedMotion(), [])
  const mobile = useMemo(() => isMobile(), [])

  useEffect(() => {
    onDoneRef.current = onDone
  })

  useLayoutEffect(() => {
    if (!anchorRef.current) return
    setAnchorRect(anchorRef.current.getBoundingClientRect())

    const handleResize = () => {
      setAnchorRect(anchorRef.current?.getBoundingClientRect() ?? null)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!withConfetti || firedRef.current || reduceMotion) return
    firedRef.current = true
    const count = mobile ? 20 : 40
    setParticles(Array.from({ length: count }, (_, i) => createParticle(i)))
    setAmbient(Array.from({ length: 12 }, (_, i) => createAmbientParticle(i)))
  }, [withConfetti, reduceMotion, mobile])

  useEffect(() => {
    const exitTimer = setTimeout(() => setIsExiting(true), 4800)
    const doneTimer = setTimeout(() => {
      onDoneRef.current?.()
    }, 5300)
    return () => {
      clearTimeout(exitTimer)
      clearTimeout(doneTimer)
    }
  }, [])

  const toastAnimation = useMemo(() => {
    if (reduceMotion) {
      return isExiting
        ? 'toastExit 0.3s ease-out forwards'
        : 'toastEnter 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
    }
    if (isExiting) {
      return 'toastExit 0.6s ease-out forwards'
    }
    if (variant === 'sync') {
      return 'toastEnter 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, glowPulse 2s ease-in-out 0.7s infinite'
    }
    return 'toastEnter 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
  }, [isExiting, reduceMotion, variant])

  const portal = useMemo(() => {
    const centerX = anchorRect
      ? anchorRect.left + anchorRect.width / 2
      : typeof window !== 'undefined'
        ? window.innerWidth / 2
        : 0
    const centerY = anchorRect
      ? anchorRect.top + anchorRect.height / 2
      : typeof window !== 'undefined'
        ? window.innerHeight / 2
        : 0

    const showEffects = withConfetti && particles.length > 0 && !reduceMotion

    return createPortal(
      <div
        className="vote-toast-portal"
        style={{ left: centerX, top: centerY }}
      >
        {showEffects && (
          <div className="vote-toast-effects">
            {/* Shockwave */}
            <div className="confetti-host">
              <div className="shockwave" />
              <div className="shockwave" />
              <div className="shockwave" />
            </div>

            {/* 3D particles */}
            <div className="confetti-host">
              {particles.map((p) => (
                <div
                  key={p.id}
                  className={`particle ${p.type}`}
                  style={{
                    '--tx': `${p.tx}px`,
                    '--ty': `${p.ty}px`,
                    '--tz': `${p.tz}px`,
                    '--tx2': `${p.tx2}px`,
                    '--ty2': `${p.ty2}px`,
                    '--tz2': `${p.tz2}px`,
                    '--rx': `${p.rx}deg`,
                    '--ry': `${p.ry}deg`,
                    '--rz': `${p.rz}deg`,
                    '--rx2': `${p.rx2}deg`,
                    '--ry2': `${p.ry2}deg`,
                    '--rz2': `${p.rz2}deg`,
                    '--size': `${p.size}px`,
                    '--color': p.color.main,
                    '--light-color': p.color.light,
                    '--glow-color': p.color.glow,
                    '--duration': `${p.duration}s`,
                    animation: `particlePop ${p.duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
                    animationDelay: `${p.delay}ms`,
                  } as React.CSSProperties}
                >
                  {(p.type === 'sphere' || p.type === 'ring') && (
                    <div
                      className="particle-inner"
                      style={{
                        width: p.type === 'ring' ? p.size * 1.5 : p.size,
                        height: p.type === 'ring' ? p.size * 1.5 : p.size,
                      }}
                    />
                  )}
                  {p.type === 'cube' && (
                    <div
                      className="particle-inner"
                      style={{ width: p.size, height: p.size }}
                    >
                      {Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className="face" />
                      ))}
                    </div>
                  )}
                  {p.type === 'star' && (
                    <div className="particle-inner" style={{ width: p.size, height: p.size }}>
                      <svg viewBox="0 0 24 24" width="100%" height="100%">
                        <path
                          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                          fill={p.color.main}
                        />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Ambient floaters */}
            {ambient.map((p) => (
              <div
                key={p.id}
                className="ambient-particle"
                style={{
                  width: p.size,
                  height: p.size,
                  background: `radial-gradient(circle at 30% 30%, ${p.color.light}, ${p.color.main})`,
                  boxShadow: `0 0 ${p.size * 2}px ${p.color.glow}`,
                  '--dx': `${p.dx}px`,
                  '--dy': `${p.dy}px`,
                  animation: `ambientFloat ${p.duration}s ease-out forwards`,
                  animationDelay: `${p.delay}ms`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        <div className="vote-toast-layer toast-container">
          <div
            className={`toast ${variant}`}
            style={{ animation: toastAnimation }}
          >
            {!reduceMotion && <span className="toast-shine" />}
            <span className="toast-icon">{icon}</span>
            <span className="toast-text">{message}</span>
          </div>
        </div>
      </div>,
      document.body
    )
  }, [anchorRect, withConfetti, particles, ambient, reduceMotion, variant, message, icon, toastAnimation])

  return (
    <>
      {portal}
      <div ref={anchorRef} className="pointer-events-none absolute inset-0" aria-hidden />
    </>
  )
}
