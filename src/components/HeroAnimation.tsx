import { useEffect, useRef } from 'react'

// ─── Assets ───────────────────────────────────────────────────────────────
const SCREEN_IMAGES = [
  '/screenshots/screen1.jpg',
  '/screenshots/screen2.jpg',
  '/screenshots/screen3.jpg',
]

// ─── Vocabulary ─────────────────────────────────────────────────────────────
const positiveWords = [
  { text: 'инвестиции', color: '#34D399' },
  { text: 'стартап', color: '#34D399' },
  { text: 'рост', color: '#34D399' },
  { text: 'доход', color: '#34D399' },
  { text: 'прибыль', color: '#34D399' },
  { text: 'успех', color: '#34D399' },
  { text: 'инновации', color: '#34D399' },
  { text: 'технологии', color: '#34D399' },
  { text: 'лидер', color: '#34D399' },
  { text: 'команда', color: '#34D399' },
  { text: 'прогресс', color: '#34D399' },
  { text: 'будущее', color: '#34D399' },
  { text: 'решение', color: '#34D399' },
  { text: 'результат', color: '#34D399' },
  { text: 'подписчик', color: '#34D399' },
  { text: 'качество', color: '#34D399' },
  { text: 'масштаб', color: '#34D399' },
  { text: 'акции', color: '#34D399' },
  { text: 'криптовалюта', color: '#34D399' },
  { text: 'AI', color: '#34D399' },
  { text: 'платформа', color: '#34D399' },
  { text: 'продукт', color: '#34D399' },
  { text: 'тренд', color: '#34D399' },
  { text: 'пульс', color: '#34D399' },
]

const negativeWords = [
  { text: 'кризис', color: '#EF4444' },
  { text: 'обвал', color: '#EF4444' },
  { text: 'спад', color: '#EF4444' },
  { text: 'инфляция', color: '#EF4444' },
  { text: 'санкции', color: '#EF4444' },
  { text: 'дефолт', color: '#EF4444' },
  { text: 'риск', color: '#EF4444' },
  { text: 'падение', color: '#EF4444' },
  { text: 'убыток', color: '#EF4444' },
  { text: 'рецессия', color: '#EF4444' },
  { text: 'долг', color: '#EF4444' },
  { text: 'банкротство', color: '#EF4444' },
  { text: 'кредит', color: '#EF4444' },
  { text: 'нефть', color: '#EF4444' },
  { text: 'валюта', color: '#EF4444' },
  { text: 'банк', color: '#EF4444' },
  { text: 'фонд', color: '#EF4444' },
  { text: 'экономика', color: '#EF4444' },
  { text: 'финансы', color: '#EF4444' },
  { text: 'рынок', color: '#EF4444' },
  { text: 'трейдинг', color: '#EF4444' },
  { text: 'блокчейн', color: '#EF4444' },
]

const neutralWords = [
  { text: 'новости', color: '#9CA3AF' },
  { text: 'контент', color: '#9CA3AF' },
  { text: 'медиа', color: '#9CA3AF' },
  { text: 'видео', color: '#9CA3AF' },
  { text: 'стрим', color: '#9CA3AF' },
  { text: 'подкаст', color: '#9CA3AF' },
  { text: 'звук', color: '#9CA3AF' },
  { text: 'частота', color: '#9CA3AF' },
  { text: 'сигнал', color: '#9CA3AF' },
  { text: 'вещание', color: '#9CA3AF' },
  { text: 'эфир', color: '#9CA3AF' },
  { text: 'голос', color: '#9CA3AF' },
  { text: 'волна', color: '#9CA3AF' },
  { text: 'IT', color: '#9CA3AF' },
  { text: 'код', color: '#9CA3AF' },
  { text: 'данные', color: '#9CA3AF' },
  { text: 'облако', color: '#9CA3AF' },
  { text: 'сеть', color: '#9CA3AF' },
]

const allWords = [...positiveWords, ...negativeWords, ...neutralWords]

// ─── Types ──────────────────────────────────────────────────────────────────
interface WordParticle {
  text: string
  color: string
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  targetOp: number
  state: 'fly' | 'absorb'
  life: number
}

interface WaveDot {
  x: number
  y: number
  baseY: number
  vx: number
  phase: number
  amp: number
  freq: number
  life: number
  opacity: number
  maxOp: number
  size: number
}

interface DustParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
}

interface Streak {
  x: number
  y: number
  vx: number
  len: number
  opacity: number
  width: number
}

interface HeroAnimationProps {
  className?: string
}

export default function HeroAnimation({ className }: HeroAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const context = ctx
    const c = canvas
    const cnt = container

    let rafId = 0
    let isHidden = false
    let frameCount = 0

    // Layout
    let W = 0
    let H = 0
    let cx = 0
    let cy = 0
    let dpr = 1
    let scale = 1

    // Reference phone geometry (px)
    const REF_PW = 180
    const REF_PH = 348
    const REF_PR = 22
    const REF_PAD = 6

    let pW = REF_PW
    let pH = REF_PH
    let pR = REF_PR
    let screenPad = REF_PAD

    const pL = () => cx - pW / 2
    const pRgt = () => pL() + pW
    const pT = () => cy - pH / 2
    const pB = () => pT() + pH
    const screenL = () => pL() + screenPad
    const screenR = () => pRgt() - screenPad
    const screenT = () => pT() + 7 * scale
    const screenB = () => pB() - 7 * scale
    const absorbX = () => screenL() - 3 * scale

    // Screenshots
    const screens: HTMLImageElement[] = []
    let screensLoaded = 0
    SCREEN_IMAGES.forEach((src) => {
      const img = new Image()
      img.onload = () => {
        screensLoaded++
      }
      img.onerror = () => {
        screensLoaded++
      }
      img.src = src
      screens.push(img)
    })

    let currentScreen = 0
    let screenAlpha = 1

    // Particles
    const particles: WordParticle[] = []
    const wavePoints: WaveDot[] = []
    const dust: DustParticle[] = []
    const streaks: Streak[] = []
    let pulseGlow = 0

    function initParticles() {
      dust.length = 0
      for (let i = 0; i < 50; i++) {
        dust.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: 0.2 + Math.random() * 0.6,
          vy: (Math.random() - 0.5) * 0.15,
          size: 0.5 + Math.random() * 1.5,
          opacity: 0.04 + Math.random() * 0.08,
        })
      }

      streaks.length = 0
      for (let i = 0; i < 20; i++) {
        streaks.push({
          x: Math.random() * W,
          y: cy + (Math.random() - 0.5) * pH * 0.5,
          vx: 2.5 + Math.random() * 3.5,
          len: 40 + Math.random() * 100,
          opacity: 0.02 + Math.random() * 0.05,
          width: 0.5 + Math.random() * 1,
        })
      }
    }

    function resize() {
      const rect = cnt.getBoundingClientRect()
      W = rect.width
      H = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      c.width = Math.floor(W * dpr)
      c.height = Math.floor(H * dpr)
      c.style.width = `${W}px`
      c.style.height = `${H}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      cx = W / 2
      cy = H / 2

      // Scale phone to fit container height while keeping reference proportions
      const maxPhoneH = Math.min(H * 0.88, REF_PH)
      scale = maxPhoneH / REF_PH
      pH = REF_PH * scale
      pW = REF_PW * scale
      pR = Math.max(8, REF_PR * scale)
      screenPad = Math.max(2, REF_PAD * scale)

      initParticles()
    }

    function spawnWord() {
      const spread = (Math.random() - 0.5) * (pH * 0.72)
      const w = allWords[Math.floor(Math.random() * allWords.length)]
      particles.push({
        text: w.text,
        color: w.color,
        x: -60 - Math.random() * 180,
        y: cy + spread,
        vx: 2.4 + Math.random() * 1.2,
        vy: (Math.random() - 0.5) * 0.15,
        size: 10 + Math.random() * 12,
        opacity: 0,
        targetOp: 0.5 + Math.random() * 0.5,
        state: 'fly',
        life: 0,
      })
    }

    function spawnWaveDot(dotY?: number) {
      const y = dotY ?? cy + (Math.random() - 0.5) * (pH * 0.6)
      wavePoints.push({
        x: pRgt() + 2,
        y,
        baseY: y,
        vx: 0.64 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        amp: 6.5 + Math.random() * 11.7,
        freq: 0.011 + Math.random() * 0.009,
        life: 0,
        opacity: 0,
        maxOp: 0.7 + Math.random() * 0.3,
        size: 1.5 + Math.random() * 2,
      })
    }

    function updateWords() {
      context.save()
      context.textBaseline = 'middle'
      const right = pRgt()
      const top = pT()
      const bottom = pB()
      const targetX = absorbX()
      let absorbed = false

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++

        if (p.state === 'fly') {
          p.opacity = Math.min(p.opacity + 0.03, p.targetOp)

          // Funnel: words converge toward absorb point as they approach
          if (p.x > targetX - 280 && p.x < targetX + 10) {
            const distToTarget = Math.max(0, targetX - p.x)
            const t = 1 - distToTarget / 280
            const funnelStrength = t * t * 0.16
            const targetY = cy
            const dy = targetY - p.y
            p.y += dy * funnelStrength
            p.x += p.vx * (1 - t * 0.25)
          } else {
            p.x += p.vx
            p.y += p.vy
          }

          // Entered phone area from left
          if (p.x > targetX - 3 && p.x < right - 5 && p.y > top && p.y < bottom) {
            p.state = 'absorb'
          }
        } else if (p.state === 'absorb') {
          // Suck to left edge
          const dx = targetX - p.x
          const targetAbsorbY = cy
          const dy = targetAbsorbY - p.y
          p.x += dx * 0.22
          p.y += dy * 0.18
          p.opacity -= 0.12
          p.size *= 0.9

          if (p.opacity <= 0) {
            spawnWaveDot(p.y)
            spawnWaveDot(p.y - 4)
            spawnWaveDot(p.y + 4)
            absorbed = true
            particles.splice(i, 1)
            continue
          }
        }

        if (p.x > right + 300) {
          p.opacity -= 0.02
          if (p.opacity <= 0) {
            particles.splice(i, 1)
            continue
          }
        }

        context.globalAlpha = Math.max(0, p.opacity)
        context.font = `${p.size}px 'Segoe UI', system-ui, sans-serif`
        context.fillStyle = p.color || '#e0e0e0'
        context.fillText(p.text, p.x, p.y)
      }
      context.restore()

      if (absorbed) pulseGlow = 1
    }

    function drawWaveClipped() {
      const time = Date.now() * 0.0028

      for (let i = wavePoints.length - 1; i >= 0; i--) {
        const d = wavePoints[i]
        d.life++
        d.x += d.vx
        d.y = d.baseY + Math.sin(d.life * d.freq + d.phase) * d.amp * (0.6 + 0.4 * Math.sin(time + d.phase))

        if (d.life < 25) d.opacity = Math.min(d.opacity + 0.05, d.maxOp)
        if (d.x > W - 80) d.opacity -= 0.015
        if (d.opacity <= 0) {
          wavePoints.splice(i, 1)
          continue
        }
      }

      if (wavePoints.length < 2) return

      // Anchor at right edge of phone
      const anchor = {
        x: pRgt() - 1,
        y: cy,
        opacity: 0.6,
        size: 2,
        color: '#00D4FF',
        baseY: cy,
        vx: 0,
        phase: 0,
        amp: 0,
        freq: 0,
        life: 0,
        maxOp: 0.6,
      } as WaveDot
      const sorted = [...wavePoints, anchor].sort((a, b) => a.x - b.x)

      // Clip to area right of phone so wave draws on top of everything
      context.save()
      context.beginPath()
      context.rect(pRgt() - 4, 0, W - pRgt() + 4, H)
      context.clip()

      // Thick glow layer
      context.globalAlpha = 0.2
      context.shadowColor = '#00D4FF'
      context.shadowBlur = 25
      context.strokeStyle = '#00D4FF'
      context.lineWidth = 6
      context.lineCap = 'round'
      drawWavePath(sorted)

      // Medium layer
      context.globalAlpha = 0.35
      context.shadowColor = '#00D4FF'
      context.shadowBlur = 12
      context.strokeStyle = '#00D4FF'
      context.lineWidth = 2.5
      drawWavePath(sorted)

      // Crisp core line
      context.globalAlpha = 0.8
      context.shadowColor = '#00D4FF'
      context.shadowBlur = 0
      context.strokeStyle = '#00D4FF'
      context.lineWidth = 1
      drawWavePath(sorted)

      // Glowing dots
      for (const d of sorted) {
        context.globalAlpha = d.opacity
        context.shadowColor = '#00D4FF'
        context.shadowBlur = 12
        context.fillStyle = '#00D4FF'
        context.beginPath()
        context.arc(d.x, d.y, d.size, 0, Math.PI * 2)
        context.fill()
      }

      context.restore()
    }

    function drawWavePath(points: WaveDot[]) {
      context.beginPath()
      context.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2
        const yc = (points[i].y + points[i + 1].y) / 2
        context.quadraticCurveTo(points[i].x, points[i].y, xc, yc)
      }
      context.lineTo(points[points.length - 1].x, points[points.length - 1].y)
      context.stroke()
    }

    function drawPhoneBody(alpha: number) {
      const x = pL()
      const y = pT()

      // Ambient glow behind
      context.save()
      context.globalAlpha = alpha * 0.05
      context.shadowColor = '#fff'
      context.shadowBlur = 80 + pulseGlow * 40
      context.beginPath()
      context.moveTo(x + pR, y)
      context.lineTo(x + pW - pR, y)
      context.quadraticCurveTo(x + pW, y, x + pW, y + pR)
      context.lineTo(x + pW, y + pH - pR)
      context.quadraticCurveTo(x + pW, y + pH, x + pW - pR, y + pH)
      context.lineTo(x + pR, y + pH)
      context.quadraticCurveTo(x, y + pH, x, y + pH - pR)
      context.lineTo(x, y + pR)
      context.quadraticCurveTo(x, y, x + pR, y)
      context.closePath()
      context.fillStyle = '#fff'
      context.fill()
      context.restore()

      // Body
      context.save()
      context.globalAlpha = alpha
      context.beginPath()
      context.moveTo(x + pR, y)
      context.lineTo(x + pW - pR, y)
      context.quadraticCurveTo(x + pW, y, x + pW, y + pR)
      context.lineTo(x + pW, y + pH - pR)
      context.quadraticCurveTo(x + pW, y + pH, x + pW - pR, y + pH)
      context.lineTo(x + pR, y + pH)
      context.quadraticCurveTo(x, y + pH, x, y + pH - pR)
      context.lineTo(x, y + pR)
      context.quadraticCurveTo(x, y, x + pR, y)
      context.closePath()
      context.fillStyle = '#181818'
      context.fill()
      context.strokeStyle = 'rgba(255,255,255,0.2)'
      context.lineWidth = 2
      context.stroke()

      // Screen area
      context.beginPath()
      context.moveTo(x + pR - 3 * scale, y + 7 * scale)
      context.lineTo(x + pW - pR + 3 * scale, y + 7 * scale)
      context.quadraticCurveTo(x + pW - 3 * scale, y + 7 * scale, x + pW - 3 * scale, y + pR)
      context.lineTo(x + pW - 3 * scale, y + pH - pR)
      context.quadraticCurveTo(x + pW - 3 * scale, y + pH - 7 * scale, x + pW - pR + 3 * scale, y + pH - 7 * scale)
      context.lineTo(x + pR - 3 * scale, y + pH - 7 * scale)
      context.quadraticCurveTo(x + 3 * scale, y + pH - 7 * scale, x + 3 * scale, y + pH - pR)
      context.lineTo(x + 3 * scale, y + pR)
      context.quadraticCurveTo(x + 3 * scale, y + 7 * scale, x + pR - 3 * scale, y + 7 * scale)
      context.closePath()
      context.fillStyle = '#080808'
      context.fill()

      // Buttons
      const pCenterY = pT() + pH / 2
      context.fillStyle = 'rgba(255,255,255,0.12)'
      context.fillRect(x + pW, pCenterY - 28 * scale, 3 * scale, 46 * scale)
      context.fillRect(x - 3 * scale, pCenterY - 46 * scale, 3 * scale, 28 * scale)
      context.fillRect(x - 3 * scale, pCenterY - 8 * scale, 3 * scale, 28 * scale)

      context.restore()
    }

    function drawAppScreen() {
      const img = screens[currentScreen]
      if (!img || !img.complete || img.naturalWidth === 0) return

      // Cycle screens every ~5s (300 frames @ 60fps)
      if (frameCount % 300 === 0) {
        screenAlpha = 0
        currentScreen = (currentScreen + 1) % screens.length
      }
      if (screenAlpha < 1) screenAlpha += 0.014

      const sL = screenL()
      const sT = screenT()
      const sW = screenR() - screenL()
      const sH = screenB() - screenT()

      context.save()
      // Clip to rounded screen area
      context.beginPath()
      context.moveTo(sL + pR - 3 * scale, sT)
      context.lineTo(sL + sW - pR + 3 * scale, sT)
      context.quadraticCurveTo(sL + sW, sT, sL + sW, sT + pR - 5 * scale)
      context.lineTo(sL + sW, sT + sH - pR + 5 * scale)
      context.quadraticCurveTo(sL + sW, sT + sH, sL + sW - pR + 3 * scale, sT + sH)
      context.lineTo(sL + pR - 3 * scale, sT + sH)
      context.quadraticCurveTo(sL, sT + sH, sL, sT + sH - pR + 5 * scale)
      context.lineTo(sL, sT + pR - 5 * scale)
      context.quadraticCurveTo(sL, sT, sL + pR - 3 * scale, sT)
      context.closePath()
      context.clip()

      // Draw current screenshot, cover-fit
      const imgRatio = img.width / img.height
      const screenRatio = sW / sH
      let drawW: number
      let drawH: number
      let drawX: number
      let drawY: number
      if (imgRatio > screenRatio) {
        drawH = sH
        drawW = sH * imgRatio
        drawX = sL - (drawW - sW) / 2
        drawY = sT
      } else {
        drawW = sW
        drawH = sW / imgRatio
        drawX = sL
        drawY = sT - (drawH - sH) / 2
      }
      context.globalAlpha = Math.min(1, screenAlpha)
      context.drawImage(img, drawX, drawY, drawW, drawH)
      context.restore()
    }

    function drawDust() {
      context.save()
      for (const d of dust) {
        d.x += d.vx
        d.y += d.vy
        if (d.x > W) d.x = 0
        context.globalAlpha = d.opacity
        context.fillStyle = '#fff'
        context.beginPath()
        context.arc(d.x, d.y, d.size, 0, Math.PI * 2)
        context.fill()
      }
      context.restore()
    }

    function drawStreaks() {
      context.save()
      for (const s of streaks) {
        s.x += s.vx
        if (s.x > W) {
          s.x = -s.len
          s.y = cy + (Math.random() - 0.5) * pH * 0.5
        }
        context.globalAlpha = s.opacity
        context.strokeStyle = '#fff'
        context.lineWidth = s.width
        context.beginPath()
        context.moveTo(s.x, s.y)
        context.lineTo(s.x + s.len, s.y)
        context.stroke()
      }
      context.restore()
    }

    function animate() {
      context.clearRect(0, 0, W, H)

      // Background — pure black, no radial glow
      context.fillStyle = '#000000'
      context.fillRect(0, 0, W, H)

      drawDust()
      drawStreaks()

      // Spawn words after ~0.8s delay
      frameCount++
      if (frameCount > 48 && frameCount % 2 === 0) spawnWord()

      // Decay pulse
      pulseGlow *= 0.92

      // Draw order: words → phone body → wave (clipped) → app screen (absolute top)
      updateWords()
      drawPhoneBody(1)
      drawWaveClipped()
      drawAppScreen()

      rafId = requestAnimationFrame(animate)
    }

    function handleVisibility() {
      isHidden = document.hidden
    }

    function loop() {
      if (!isHidden) {
        animate()
      } else {
        rafId = requestAnimationFrame(loop)
      }
    }

    resize()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', handleVisibility)
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <section
      ref={containerRef}
      className={`relative w-full overflow-hidden ${className || 'h-[33dvh] min-h-[220px]'}`}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </section>
  )
}
