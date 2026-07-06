import { useEffect, useRef } from 'react'

// ─── Assets ───────────────────────────────────────────────────────────────
const SCREEN_IMAGES = [
  '/screenshots/screen1.jpg',
  '/screenshots/screen2.jpg',
  '/screenshots/screen3.jpg',
]

// ─── Colors ─────────────────────────────────────────────────────────────────
const COLORS = {
  bgCenter: '#0a1628',
  bgEdge: '#050a12',
  phoneBody: '#181818',
  phoneScreen: '#080808',
  phoneBorder: 'rgba(255,255,255,0.2)',
  wave: '#00D4FF',
  positive: '#34D399',
  negative: '#EF4444',
  neutral: '#9CA3AF',
}

// ─── Word dictionaries ──────────────────────────────────────────────────────
const WORDS: { text: string; sentiment: 'positive' | 'negative' | 'neutral' }[] = [
  { text: 'рост', sentiment: 'positive' },
  { text: 'падение', sentiment: 'negative' },
  { text: 'отчёт', sentiment: 'neutral' },
  { text: 'прибыль', sentiment: 'positive' },
  { text: 'убыток', sentiment: 'negative' },
  { text: 'рали', sentiment: 'positive' },
  { text: 'санкции', sentiment: 'negative' },
  { text: 'IPO', sentiment: 'neutral' },
  { text: 'дивиденды', sentiment: 'positive' },
  { text: 'кризис', sentiment: 'negative' },
  { text: 'сделка', sentiment: 'neutral' },
  { text: 'рекорд', sentiment: 'positive' },
  { text: 'инфляция', sentiment: 'negative' },
  { text: 'аналитика', sentiment: 'neutral' },
  { text: 'прогноз', sentiment: 'neutral' },
  { text: 'превысил', sentiment: 'positive' },
  { text: 'снизился', sentiment: 'negative' },
  { text: 'стабильность', sentiment: 'positive' },
  { text: 'волатильность', sentiment: 'negative' },
  { text: 'новости', sentiment: 'neutral' },
]

// ─── Types ──────────────────────────────────────────────────────────────────
interface PhoneLayout {
  x: number
  y: number
  w: number
  h: number
  r: number
  screenPad: number
}

interface WordParticle {
  x: number
  y: number
  vx: number
  vy: number
  text: string
  color: string
  size: number
  dead: boolean
}

interface WavePoint {
  x: number
  y: number
  baseY: number
  vx: number
  amp: number
  freq: number
  phase: number
  life: number
  maxLife: number
}

interface DustParticle {
  x: number
  y: number
  vx: number
  size: number
  alpha: number
}

interface Streak {
  x: number
  y: number
  length: number
  speed: number
  alpha: number
}

export default function HeroAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const c = canvas
    const cnt = container
    const context = ctx

    let rafId = 0
    let isHidden = false
    let frameCount = 0
    let lastTime = performance.now()

    // Load screenshots
    const screens: HTMLImageElement[] = []
    let screensLoaded = 0
    SCREEN_IMAGES.forEach((src) => {
      const img = new Image()
      img.src = src
      img.onload = () => {
        screensLoaded++
      }
      screens.push(img)
    })

    // State
    let width = 0
    let height = 0
    let dpr = 1
    let phone: PhoneLayout = { x: 0, y: 0, w: 0, h: 0, r: 0, screenPad: 0 }
    let absorbX = 0
    let funnelStartX = 0
    let words: WordParticle[] = []
    let waves: WavePoint[] = []
    let dust: DustParticle[] = []
    let streaks: Streak[] = []
    let currentScreen = 0
    let screenAlpha = 0
    let screenTimer = 0
    const screenInterval = 5000 // ms

    // Helpers
    function resize() {
      const rect = cnt.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      c.width = Math.floor(width * dpr)
      c.height = Math.floor(height * dpr)
      c.style.width = `${width}px`
      c.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      const isMobile = width < 768
      const basePhoneH = Math.min(height * 0.7, 348)
      const aspect = 180 / 348
      const pH = basePhoneH
      const pW = pH * aspect
      const pR = Math.max(12, pH * 0.063)
      const screenPad = Math.max(4, pH * 0.017)

      phone = {
        x: width / 2 - pW / 2,
        y: height / 2 - pH / 2,
        w: pW,
        h: pH,
        r: pR,
        screenPad,
      }
      absorbX = phone.x + phone.screenPad
      funnelStartX = absorbX - Math.max(120, width * 0.22)

      // Re-init dust & streaks counts based on size
      const targetDust = isMobile ? 20 : width < 1024 ? 30 : 50
      while (dust.length < targetDust) {
        dust.push(createDust())
      }
      dust.length = targetDust

      if (!isMobile) {
        const targetStreaks = 20
        while (streaks.length < targetStreaks) {
          streaks.push(createStreak())
        }
        streaks.length = targetStreaks
      } else {
        streaks = []
      }
    }

    function createDust(): DustParticle {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0.1 + Math.random() * 0.3,
        size: 0.5 + Math.random() * 1.5,
        alpha: 0.05 + Math.random() * 0.15,
      }
    }

    function createStreak(): Streak {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        length: 20 + Math.random() * 80,
        speed: 2 + Math.random() * 4,
        alpha: 0.02 + Math.random() * 0.08,
      }
    }

    function spawnWord() {
      const isMobile = width < 768
      const speedMult = isMobile ? 0.7 : width < 1024 ? 0.85 : 1
      const dict = WORDS[Math.floor(Math.random() * WORDS.length)]
      const color =
        dict.sentiment === 'positive'
          ? COLORS.positive
          : dict.sentiment === 'negative'
            ? COLORS.negative
            : COLORS.neutral

      words.push({
        x: -60 - Math.random() * 180,
        y: height / 2 + (Math.random() - 0.5) * phone.h * 0.72,
        vx: (2.4 + Math.random() * 1.2) * speedMult,
        vy: (Math.random() - 0.5) * 0.3,
        text: dict.text,
        color,
        size: 10 + Math.random() * 12,
        dead: false,
      })
    }

    function spawnWavePoints(y: number) {
      const isMobile = width < 768
      const speedMult = isMobile ? 0.7 : width < 1024 ? 0.85 : 1
      for (let i = 0; i < 3; i++) {
        waves.push({
          x: absorbX,
          y,
          baseY: y,
          vx: (0.64 + Math.random() * 0.4) * speedMult,
          amp: 6.5 + Math.random() * 11.7,
          freq: 0.011 + Math.random() * 0.009,
          phase: Math.random() * Math.PI * 2,
          life: 0,
          maxLife: width - 80,
        })
      }
    }

    function update(dt: number) {
      const cy = height / 2
      const isMobile = width < 768

      // Spawn words with delay
      if (frameCount > 48 && frameCount % 2 === 0) {
        const maxWords = isMobile ? 50 : 90
        if (words.length < maxWords) spawnWord()
      }

      // Update words
      words.forEach((p) => {
        if (p.dead) return

        // Funnel effect
        if (p.x > funnelStartX && p.x < absorbX) {
          const t = Math.min(1, (p.x - funnelStartX) / (absorbX - funnelStartX))
          const targetY = cy
          p.vy += (targetY - p.y) * t * t * 0.006
          p.vx *= 1 - t * 0.015
        }

        p.x += p.vx
        p.y += p.vy

        // Absorption
        if (p.x >= absorbX) {
          p.dead = true
          const pull = 0.22
          p.x += (absorbX - p.x) * pull
          p.y += (cy - p.y) * pull
          spawnWavePoints(p.y)
        }

        // Cleanup
        if (p.x > width + 60) p.dead = true
      })
      words = words.filter((p) => !p.dead)

      // Update waves
      waves.forEach((w) => {
        w.x += w.vx
        w.life += w.vx
        w.phase += w.freq
        w.y = w.baseY + Math.sin(w.phase) * w.amp
      })
      waves = waves.filter((w) => w.life < w.maxLife)

      // Update dust
      dust.forEach((d) => {
        d.x += d.vx
        if (d.x > width) {
          d.x = -5
          d.y = Math.random() * height
        }
      })

      // Update streaks
      streaks.forEach((s) => {
        s.x += s.speed
        if (s.x > width) {
          s.x = -s.length
          s.y = Math.random() * height
        }
      })

      // Screenshots cycling
      screenTimer += dt
      if (screenTimer >= screenInterval) {
        screenTimer = 0
        currentScreen = (currentScreen + 1) % screens.length
        screenAlpha = 0
      }
      if (screenAlpha < 1) {
        screenAlpha += 0.014
        if (screenAlpha > 1) screenAlpha = 1
      }

      frameCount++
    }

    function drawRoundedRect(
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
      fill?: string,
      stroke?: string
    ) {
      context.beginPath()
      context.moveTo(x + r, y)
      context.lineTo(x + w - r, y)
      context.quadraticCurveTo(x + w, y, x + w, y + r)
      context.lineTo(x + w, y + h - r)
      context.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      context.lineTo(x + r, y + h)
      context.quadraticCurveTo(x, y + h, x, y + h - r)
      context.lineTo(x, y + r)
      context.quadraticCurveTo(x, y, x + r, y)
      context.closePath()
      if (fill) {
        context.fillStyle = fill
        context.fill()
      }
      if (stroke) {
        context.strokeStyle = stroke
        context.stroke()
      }
    }

    function drawPhone() {
      // Glow
      context.save()
      context.shadowColor = COLORS.wave
      context.shadowBlur = 25
      drawRoundedRect(
        phone.x,
        phone.y,
        phone.w,
        phone.h,
        phone.r,
        COLORS.phoneBody,
        COLORS.phoneBorder
      )
      context.restore()

      // Screen
      const sx = phone.x + phone.screenPad
      const sy = phone.y + phone.screenPad
      const sw = phone.w - phone.screenPad * 2
      const sh = phone.h - phone.screenPad * 2
      const sr = Math.max(0, phone.r - phone.screenPad)

      context.save()
      drawRoundedRect(sx, sy, sw, sh, sr, COLORS.phoneScreen)
      context.clip()

      // Screenshot fade cycle
      if (screensLoaded > 0) {
        const img = screens[currentScreen]
        if (img && img.complete) {
          const imgAspect = img.width / img.height
          const screenAspect = sw / sh
          let dw = sw
          let dh = sh
          let dx = sx
          let dy = sy
          if (imgAspect > screenAspect) {
            dh = sh
            dw = sh * imgAspect
            dx = sx - (dw - sw) / 2
          } else {
            dw = sw
            dh = sw / imgAspect
            dy = sy - (dh - sh) / 2
          }
          context.globalAlpha = screenAlpha
          context.drawImage(img, dx, dy, dw, dh)
          context.globalAlpha = 1
        }
      }
      context.restore()
    }

    function drawBackground() {
      const gradient = context.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.7
      )
      gradient.addColorStop(0, COLORS.bgCenter)
      gradient.addColorStop(1, COLORS.bgEdge)
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
    }

    function drawDust() {
      dust.forEach((d) => {
        context.beginPath()
        context.arc(d.x, d.y, d.size, 0, Math.PI * 2)
        context.fillStyle = `rgba(255,255,255,${d.alpha})`
        context.fill()
      })
    }

    function drawStreaks() {
      streaks.forEach((s) => {
        context.beginPath()
        context.moveTo(s.x, s.y)
        context.lineTo(s.x + s.length, s.y)
        context.strokeStyle = `rgba(255,255,255,${s.alpha})`
        context.lineWidth = 1
        context.stroke()
      })
    }

    function drawWords() {
      context.textBaseline = 'middle'
      words.forEach((p) => {
        context.font = `${p.size}px system-ui, -apple-system, sans-serif`
        context.fillStyle = p.color
        context.fillText(p.text, p.x, p.y)
      })
    }

    function drawWave() {
      if (waves.length === 0) return

      // Sort by y for simple depth
      const sorted = [...waves].sort((a, b) => a.y - b.y)

      // Draw glow layer
      context.save()
      context.shadowColor = COLORS.wave
      context.shadowBlur = 25
      context.strokeStyle = COLORS.wave
      context.lineWidth = 6
      context.globalAlpha = 0.25
      drawWavePath(sorted)
      context.restore()

      // Medium layer
      context.save()
      context.strokeStyle = COLORS.wave
      context.lineWidth = 2.5
      context.globalAlpha = 0.55
      drawWavePath(sorted)
      context.restore()

      // Core layer
      context.save()
      context.strokeStyle = '#ffffff'
      context.lineWidth = 1
      context.globalAlpha = 0.9
      drawWavePath(sorted)
      context.restore()
    }

    function drawWavePath(points: WavePoint[]) {
      context.beginPath()
      for (let i = 0; i < points.length; i++) {
        const p = points[i]
        if (i === 0) context.moveTo(p.x, p.y)
        else context.lineTo(p.x, p.y)
      }
      context.stroke()
    }

    function render() {
      context.clearRect(0, 0, width, height)
      drawBackground()
      drawDust()
      if (width >= 768) drawStreaks()
      drawWords()
      drawPhone()
      drawWave()
    }

    function loop(now: number) {
      if (isHidden) {
        rafId = requestAnimationFrame(loop)
        return
      }
      const dt = now - lastTime
      lastTime = now
      update(dt)
      render()
      rafId = requestAnimationFrame(loop)
    }

    function handleVisibility() {
      isHidden = document.hidden
      if (!isHidden) {
        lastTime = performance.now()
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
      className="relative w-full h-[33dvh] min-h-[220px] overflow-hidden"
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </section>
  )
}
