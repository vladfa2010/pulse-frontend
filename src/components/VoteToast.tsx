import { useEffect, useRef } from 'react'

export type VoteToastVariant = 'sync' | 'balance' | 'contrarian'

interface VoteToastProps {
  variant: VoteToastVariant
  message: string
  icon: string
  withConfetti?: boolean
  onDone?: () => void
}

function createConfetti() {
  const colors = ['#10b981', '#34d399', '#6ee7b7', '#00D4FF', '#fbbf24', '#f59e0b', '#ffffff', '#a7f3d0']
  const shapes = ['rect', 'circle', 'star']
  const count = 40
  let svgHTML = '<svg class="vote-confetti-wrap" viewBox="0 0 240 120">'

  svgHTML += '<circle class="vote-confetti-glow" cx="120" cy="90" r="22" fill="url(#voteGlowGrad)" />'
  svgHTML +=
    '<defs><radialGradient id="voteGlowGrad"><stop offset="0%" stop-color="#10b981" stop-opacity="0.8"/><stop offset="100%" stop-color="#10b981" stop-opacity="0"/></radialGradient></defs>'

  for (let i = 0; i < count; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)]
    const shape = shapes[Math.floor(Math.random() * shapes.length)]
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 1.0
    const dist1 = 40 + Math.random() * 60
    const dist2 = 90 + Math.random() * 100
    const tx = Math.cos(angle) * dist1
    const ty = -Math.abs(Math.sin(angle) * dist1) - 15
    const tx2 = Math.cos(angle) * dist2
    const ty2 = Math.sin(angle) * dist2 * 0.6 + 60
    const rot = Math.random() * 720 - 360
    const rot2 = rot + Math.random() * 360 - 180
    const size = 4 + Math.random() * 6
    const delay = Math.random() * 0.2

    let shapeSVG = ''
    if (shape === 'rect') {
      shapeSVG = `<rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size * 0.65}" rx="1.5" fill="${color}" />`
    } else if (shape === 'circle') {
      shapeSVG = `<circle cx="0" cy="0" r="${size / 2}" fill="${color}" />`
    } else {
      shapeSVG = `<polygon points="0,${-size / 2} ${size * 0.3},${-size * 0.1} ${size / 2},0 ${size * 0.3},${size * 0.1} 0,${size / 2} ${-size * 0.3},${size * 0.1} ${-size / 2},0 ${-size * 0.3},${-size * 0.1}" fill="${color}" />`
    }

    svgHTML += `<g class="vote-confetti-particle" style="--tx:${tx}px; --ty:${ty}px; --tx2:${tx2}px; --ty2:${ty2}px; --rot:${rot}deg; --rot2:${rot2}deg; animation-delay:${delay}s">${shapeSVG}</g>`
  }

  svgHTML += '</svg>'
  return svgHTML
}

export default function VoteToast({ variant, message, icon, withConfetti, onDone }: VoteToastProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const animateTimer = setTimeout(() => {
      wrapRef.current?.querySelectorAll('.vote-confetti-particle, .vote-confetti-glow').forEach(p => {
        p.classList.add('animate')
      })
    }, 100)

    const doneTimer = setTimeout(() => {
      onDone?.()
    }, 3500)

    return () => {
      clearTimeout(animateTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

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
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none flex flex-col items-center gap-2">
      <div
        ref={wrapRef}
        className="relative flex items-center gap-3 px-7 py-4 rounded-2xl text-base font-semibold text-white bg-[rgba(11,15,25,0.95)] backdrop-blur-xl border border-white/10"
        style={{
          borderColor,
          boxShadow,
          animation: 'toastIn 0.4s cubic-bezier(0.4, 0, 0.2, 1), toastOut 0.4s ease 3s forwards',
        }}
      >
        <span className="text-lg">{icon}</span>
        <span>{message}</span>
        {withConfetti && (
          <div
            className="vote-confetti-host"
            dangerouslySetInnerHTML={{ __html: createConfetti() }}
          />
        )}
      </div>
    </div>
  )
}
