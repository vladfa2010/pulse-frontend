import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

export type VoteToastVariant = 'sync' | 'balance' | 'contrarian'

interface VoteToastProps {
  variant: VoteToastVariant
  message: string
  icon: string
  withConfetti?: boolean
  onDone?: () => void
}

const WARM_COLORS = ['#E8C547', '#E85D75', '#FFD166', '#F4A261', '#E76F51']
const COOL_COLORS = ['#5DD9C1', '#9B8BF4', '#00D4FF', '#48CAE4', '#5390D9']
const MIX_COLORS = ['#E8C547', '#E85D75', '#5DD9C1', '#9B8BF4', '#00D4FF', '#FFD166', '#F4A261']

export default function VoteToast({ variant, message, icon, withConfetti, onDone }: VoteToastProps) {
  const toastRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const firedRef = useRef(false)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  })

  useEffect(() => {
    if (!withConfetti || !canvasRef.current || firedRef.current) return
    firedRef.current = true

    const rect = toastRef.current?.getBoundingClientRect()
    const originX = rect
      ? (rect.left + rect.width / 2) / window.innerWidth
      : 0.5
    const originY = rect
      ? (rect.top + rect.height / 2) / window.innerHeight
      : 0.58

    const myConfetti = confetti.create(canvasRef.current, {
      resize: true,
      useWorker: true,
    })

    const base = { shapes: ['circle', 'square'] as confetti.Shape[] }

    // Burst 1: up-left, warm
    myConfetti({
      ...base,
      origin: { x: originX - 0.08, y: originY + 0.08 },
      angle: 135,
      spread: 55,
      particleCount: 45,
      startVelocity: 52,
      gravity: 0.7,
      ticks: 280,
      decay: 0.92,
      drift: -0.4,
      scalar: 1.2,
      colors: WARM_COLORS,
    })

    // Burst 2: up-right, cool
    const t2 = setTimeout(() => {
      myConfetti({
        ...base,
        origin: { x: originX + 0.08, y: originY + 0.08 },
        angle: 45,
        spread: 50,
        particleCount: 35,
        startVelocity: 44,
        gravity: 0.75,
        ticks: 260,
        decay: 0.91,
        drift: 0.3,
        scalar: 1.0,
        colors: COOL_COLORS,
      })
    }, 180)

    // Burst 3: straight up, mix
    const t3 = setTimeout(() => {
      myConfetti({
        ...base,
        origin: { x: originX, y: originY + 0.08 },
        angle: 90,
        spread: 70,
        particleCount: 50,
        startVelocity: 58,
        gravity: 0.65,
        ticks: 320,
        decay: 0.93,
        drift: 0,
        scalar: 1.3,
        colors: MIX_COLORS,
      })
    }, 380)

    return () => {
      clearTimeout(t2)
      clearTimeout(t3)
    }
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

  return (
    <div
      ref={toastRef}
      className="relative w-fit mx-auto mt-4 z-10 pointer-events-none"
      onClick={(e) => e.stopPropagation()}
    >
      {withConfetti && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 pointer-events-none z-[1000]"
        />
      )}
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
  )
}
