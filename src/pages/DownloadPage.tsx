import { useState, useEffect, useRef, type ReactNode } from 'react'
import {
  Download,
  Smartphone,
  Zap,
  Activity,
  RefreshCw,
  AlertTriangle,
  Brain,
} from 'lucide-react'
import PhoneSlideshow from '@/components/PhoneSlideshow'

// ─── Platform detection ────────────────────────────────────────────────────
function getPlatform() {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

// ─── API ────────────────────────────────────────────────────────────────────
const API_BASE = 'https://pulse-api-bsov.onrender.com/api'

interface VersionInfo {
  version: string
  apkUrl: string
  releaseUrl: string
}

async function fetchVersion(): Promise<VersionInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/app/version`, {
      headers: { 'User-Agent': 'pulse-web' },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ─── Particle Canvas ────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      size: number
      alpha: number
    }> = []

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.3 + 0.1,
      })
    }

    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas!.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas!.height) p.vy *= -1

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(0, 212, 255, ${p.alpha})`
        ctx!.fill()
      })

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 150) {
            ctx!.beginPath()
            ctx!.moveTo(particles[i].x, particles[i].y)
            ctx!.lineTo(particles[j].x, particles[j].y)
            ctx!.strokeStyle = `rgba(0, 212, 255, ${0.06 * (1 - dist / 150)})`
            ctx!.lineWidth = 0.5
            ctx!.stroke()
          }
        }
      }

      animId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  )
}

// ─── Feature Card ───────────────────────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  description,
  gradient,
}: {
  icon: ReactNode
  title: string
  description: string
  gradient: string
}) {
  return (
    <div
      className="rounded-2xl p-6 md:p-8 transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(0,212,255,0.25)'
        e.currentTarget.style.boxShadow =
          '0 20px 40px rgba(0,0,0,0.4), 0 0 60px rgba(0,212,255,0.06)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
        style={{ background: gradient }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: '#9CA3AF' }}>
        {description}
      </p>
    </div>
  )
}

// ─── Step ───────────────────────────────────────────────────────────────────
function Step({
  num,
  title,
  description,
}: {
  num: number
  title: string
  description: string
}) {
  return (
    <div
      className="rounded-2xl p-6 flex items-start gap-5"
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
        style={{
          background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
          color: '#060606',
        }}
      >
        {num}
      </div>
      <div>
        <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: '#9CA3AF' }}>
          {description}
        </p>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function DownloadPage() {
  const platform = getPlatform()
  const isDesktop = platform === 'desktop'
  const isAndroid = platform === 'android'
  const isIOS = platform === 'ios'

  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)

  useEffect(() => {
    fetchVersion().then((data) => {
      setVersionInfo(data)
    })
  }, [])

  const apkUrl =
    versionInfo?.apkUrl ??
    'https://github.com/vladfa2010/pulse-frontend/releases/latest/download/PULSE-debug.apk'

  const handleDownload = () => {
    window.location.href = apkUrl
  }

  return (
    <div className="min-h-screen" style={{ background: '#060606' }}>
      {/* Mesh gradient bg */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,212,255,0.08), transparent),' +
            'radial-gradient(ellipse 60% 40% at 80% 60%, rgba(0,153,204,0.04), transparent)',
          zIndex: 0,
        }}
      />

      {/* Particles */}
      <ParticleCanvas />

      <div className="relative z-10">
        {/* ─── HERO ──────────────────────────────────────────────────── */}
        <section className="min-h-screen flex items-center">
          <div className="max-w-[1400px] mx-auto px-6 w-full py-12 md:py-0">
            <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left: text */}
              <div className="order-2 md:order-1">
                {/* Badge */}
                <div className="flex justify-center md:justify-start mb-6">
                  <span
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider"
                    style={{
                      background: 'rgba(0,212,255,0.08)',
                      color: '#00D4FF',
                      border: '1px solid rgba(0,212,255,0.15)',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#00D4FF' }}
                    />
                    Android-приложение
                  </span>
                </div>

                {/* Title */}
                <h1
                  className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
                  style={{ letterSpacing: '-0.02em', color: '#FFFFFF' }}
                >
                  Инвестиционный
                  <br />
                  контекст
                  <br />
                  <span
                    style={{
                      background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      textShadow: '0 0 40px rgba(0,212,255,0.3)',
                    }}
                  >
                    в кармане
                  </span>
                </h1>

                {/* Description */}
                <p
                  className="text-base md:text-lg mb-8 max-w-[440px]"
                  style={{ color: '#9CA3AF', lineHeight: 1.7 }}
                >
                  Следите за портфелем в реальном времени. Push-уведомления о
                  важных событиях. ИИ-аналитика новостного фона. Персональные
                  новости и реал-тайм индекс настроения сообщества.
                </p>

                {/* Buttons: platform-specific */}
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {/* Desktop: button + QR below */}
                  {isDesktop && (
                    <div className="flex flex-col items-center gap-6 w-full">
                      <button
                        onClick={handleDownload}
                        className="liquid-glass-btn relative flex items-center justify-center gap-3 h-14 px-8 rounded-2xl text-base font-semibold"
                        style={{
                          background: 'rgba(0, 212, 255, 0.08)',
                          backdropFilter: 'blur(16px) saturate(180%)',
                          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                          border: '1px solid rgba(0, 212, 255, 0.25)',
                          color: '#00D4FF',
                          boxShadow:
                            '0 0 20px rgba(0, 212, 255, 0.1), inset 0 0 20px rgba(0, 212, 255, 0.05)',
                          transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            'rgba(0, 212, 255, 0.15)'
                          e.currentTarget.style.borderColor =
                            'rgba(0, 212, 255, 0.5)'
                          e.currentTarget.style.boxShadow =
                            '0 0 40px rgba(0, 212, 255, 0.2), inset 0 0 30px rgba(0, 212, 255, 0.1)'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            'rgba(0, 212, 255, 0.08)'
                          e.currentTarget.style.borderColor =
                            'rgba(0, 212, 255, 0.25)'
                          e.currentTarget.style.boxShadow =
                            '0 0 20px rgba(0, 212, 255, 0.1), inset 0 0 20px rgba(0, 212, 255, 0.05)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.transform =
                            'translateY(0) scale(0.98)'
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                        }}
                      >
                        <Download size={20} strokeWidth={2.5} />
                        Скачать APK
                      </button>

                      {/* QR */}
                      <div className="flex flex-col items-center gap-2 mt-6">
                        <div
                          className="flex items-center justify-center rounded-2xl"
                          style={{
                            background: '#FFFFFF',
                            padding: 12,
                            width: 140,
                            height: 140,
                          }}
                        >
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                              typeof window !== 'undefined'
                                ? window.location.href
                                : 'https://pulse.inside-trade.ru'
                            )}`}
                            alt="QR"
                            className="w-full h-full"
                            style={{ imageRendering: 'auto' }}
                          />
                        </div>
                        <p
                          className="text-xs font-medium text-center"
                          style={{ color: '#9CA3AF' }}
                        >
                          Отсканируйте телефоном
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Android */}
                  {isAndroid && (
                    <button
                      onClick={handleDownload}
                      className="liquid-glass-btn relative flex items-center justify-center gap-3 h-14 px-8 rounded-2xl text-base font-semibold"
                      style={{
                        background: 'rgba(0, 212, 255, 0.08)',
                        backdropFilter: 'blur(16px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                        border: '1px solid rgba(0, 212, 255, 0.25)',
                        color: '#00D4FF',
                        boxShadow:
                          '0 0 20px rgba(0, 212, 255, 0.1), inset 0 0 20px rgba(0, 212, 255, 0.05)',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          'rgba(0, 212, 255, 0.15)'
                        e.currentTarget.style.borderColor =
                          'rgba(0, 212, 255, 0.5)'
                        e.currentTarget.style.boxShadow =
                          '0 0 40px rgba(0, 212, 255, 0.2), inset 0 0 30px rgba(0, 212, 255, 0.1)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          'rgba(0, 212, 255, 0.08)'
                        e.currentTarget.style.borderColor =
                          'rgba(0, 212, 255, 0.25)'
                        e.currentTarget.style.boxShadow =
                          '0 0 20px rgba(0, 212, 255, 0.1), inset 0 0 20px rgba(0, 212, 255, 0.05)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform =
                          'translateY(0) scale(0.98)'
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                    >
                      <Download size={20} strokeWidth={2.5} />
                      Скачать APK
                    </button>
                  )}

                  {/* iOS */}
                  {isIOS && (
                    <div
                      className="flex items-center gap-3 px-5 py-3 rounded-2xl"
                      style={{
                        background: 'rgba(245,158,11,0.06)',
                        border: '1px solid rgba(245,158,11,0.15)',
                      }}
                    >
                      <Smartphone
                        size={20}
                        style={{ color: '#F59E0B' }}
                        className="flex-shrink-0"
                      />
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: '#F59E0B' }}
                        >
                          iOS в разработке
                        </p>
                        <p className="text-xs" style={{ color: '#9CA3AF' }}>
                          Веб-версия адаптирована для Safari
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Meta */}
                <p
                  className="mt-4 text-xs text-center"
                  style={{ color: '#6B7280' }}
                >
                  7.8 MB · Требуется Android 8.0+
                </p>
              </div>

              {/* Right: phone mockup */}
              <div className="order-1 md:order-2 flex justify-center">
                <div
                  className="relative"
                  style={{ animation: 'float 6s ease-in-out infinite' }}
                >
                  {/* Glow */}
                  <div
                    className="absolute inset-0 rounded-[40px]"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(0,212,255,0.15), transparent 70%)',
                      transform: 'scale(1.3)',
                      filter: 'blur(40px)',
                    }}
                  />

                  {/* Gradient ring */}
                  <div
                    className="absolute rounded-[48px]"
                    style={{
                      inset: -15,
                      background:
                        'conic-gradient(from 0deg, transparent, rgba(0,212,255,0.4), transparent, rgba(0,153,204,0.3), transparent)',
                      padding: 2,
                      opacity: 0.35,
                      animation: 'pendulum 20s ease-in-out infinite',
                    }}
                  >
                    <div
                      className="w-full h-full rounded-[46px]"
                      style={{ background: '#060606' }}
                    />
                  </div>

                  {/* Phone frame */}
                  <div
                    className="relative w-[260px] h-[520px] md:w-[280px] md:h-[560px] rounded-[40px] overflow-hidden"
                    style={{
                      border: '2px solid rgba(255,255,255,0.1)',
                      background: '#0E0E0E',
                      boxShadow: '0 0 60px rgba(0,212,255,0.08)',
                    }}
                  >
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 z-10"
                      style={{
                        width: 120,
                        height: 28,
                        background: '#0E0E0E',
                        borderRadius: '0 0 20px 20px',
                      }}
                    />
                    <PhoneSlideshow />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FEATURES ──────────────────────────────────────────────── */}
        <section className="py-24 md:py-32">
          <div className="max-w-[1400px] mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Возможности приложения
              </h2>
              <p className="text-base" style={{ color: '#9CA3AF' }}>
                Всё, что есть на сайте — теперь на вашем телефе
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-[900px] mx-auto">
              <FeatureCard
                icon={
                  <Brain
                    size={22}
                    strokeWidth={2}
                    style={{ color: '#F59E0B' }}
                  />
                }
                title="Инвестиционный интеллект"
                description="Сокращаем новостной спам на 99% без потери понимания ситуации."
                gradient="linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.1))"
              />
              <FeatureCard
                icon={<Zap size={22} strokeWidth={2} style={{ color: '#00D4FF' }} />}
                title="Push-уведомления"
                description="Мгновенные алерты по компаниям из вашего портфеля. Ничего важного не пропустите."
                gradient="linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,153,204,0.1))"
              />
              <FeatureCard
                icon={
                  <Activity
                    size={22}
                    strokeWidth={2}
                    style={{ color: '#34D399' }}
                  />
                }
                title="Sentiment-анализ"
                description="Автоматическая оценка тональности новостей. Поймите настроение рынка за секунды."
                gradient="linear-gradient(135deg, rgba(52,211,153,0.15), rgba(34,197,94,0.1))"
              />
              <FeatureCard
                icon={
                  <RefreshCw
                    size={22}
                    strokeWidth={2}
                    style={{ color: '#A78BFA' }}
                  />
                }
                title="Автообновление"
                description="Приложение само предложит установить новую версию. Одна кнопка — и вы на актуальном релизе."
                gradient="linear-gradient(135deg, rgba(167,139,250,0.15), rgba(139,92,246,0.1))"
              />
            </div>
          </div>
        </section>

        {/* ─── INSTALL STEPS ─────────────────────────────────────────── */}
        <section
          className="py-24 md:py-32"
          style={{
            background:
              'linear-gradient(180deg, transparent, rgba(0,212,255,0.02), transparent)',
          }}
        >
          <div className="max-w-[800px] mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Как установить
              </h2>
              <p className="text-base" style={{ color: '#9CA3AF' }}>
                Три простых шага — меньше минуты
              </p>
            </div>

            <div className="space-y-6">
              <Step
                num={1}
                title="Скачайте APK"
                description="Нажмите кнопку «Скачать» выше или отсканируйте QR-код. Файл загрузится на устройство."
              />
              <Step
                num={2}
                title="Разрешите установку"
                description="При первой установке система попросит разрешение «Установка из неизвестных источников» — подтвердите. Это стандартная процедура."
              />
              <Step
                num={3}
                title="Откройте файл"
                description="Нажмите «Открыть» в уведомлении о загрузке или найдите файл в папке «Загрузки». Подтвердите установку."
              />
            </div>

            {/* iOS notice */}
            {!isAndroid && (
              <div
                className="mt-10 rounded-2xl p-6 flex items-start gap-4"
                style={{
                  background: 'rgba(245,158,11,0.03)',
                  border: '1px solid rgba(245,158,11,0.15)',
                }}
              >
                <AlertTriangle
                  size={20}
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: '#F59E0B' }}
                />
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: '#F59E0B' }}
                  >
                    Версия для iOS в разработке
                  </p>
                  <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
                    Сейчас PULSE доступен только для Android 8.0 и выше.
                    iPhone-пользователи могут использовать веб-версию — она
                    полностью адаптирована для мобильных устройств.
                  </p>
                </div>
              </div>
            )}

            {/* Second download button — desktop only */}
            {isDesktop && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={handleDownload}
                  className="liquid-glass-btn relative flex items-center justify-center gap-3 h-14 px-8 rounded-2xl text-base font-semibold"
                  style={{
                    background: 'rgba(0, 212, 255, 0.08)',
                    backdropFilter: 'blur(16px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                    border: '1px solid rgba(0, 212, 255, 0.25)',
                    color: '#00D4FF',
                    boxShadow:
                      '0 0 20px rgba(0, 212, 255, 0.1), inset 0 0 20px rgba(0, 212, 255, 0.05)',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      'rgba(0, 212, 255, 0.15)'
                    e.currentTarget.style.borderColor =
                      'rgba(0, 212, 255, 0.5)'
                    e.currentTarget.style.boxShadow =
                      '0 0 40px rgba(0, 212, 255, 0.2), inset 0 0 30px rgba(0, 212, 255, 0.1)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      'rgba(0, 212, 255, 0.08)'
                    e.currentTarget.style.borderColor =
                      'rgba(0, 212, 255, 0.25)'
                    e.currentTarget.style.boxShadow =
                      '0 0 20px rgba(0, 212, 255, 0.1), inset 0 0 20px rgba(0, 212, 255, 0.05)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform =
                      'translateY(0) scale(0.98)'
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                >
                  <Download size={20} strokeWidth={2.5} />
                  Скачать APK
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes pendulum {
          0%, 100% { transform: rotate(2deg) scale(1); }
          25% { transform: rotate(0deg) scale(1.02); }
          50% { transform: rotate(-2deg) scale(1); }
          75% { transform: rotate(0deg) scale(1.02); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 212, 255, 0.1), inset 0 0 20px rgba(0, 212, 255, 0.05); }
          50% { box-shadow: 0 0 40px rgba(0, 212, 255, 0.25), inset 0 0 30px rgba(0, 212, 255, 0.12); }
        }
        .liquid-glass-btn {
          animation: glowPulse 3s ease-in-out infinite;
        }
        .liquid-glass-btn svg {
          transition: transform 0.3s ease;
        }
        .liquid-glass-btn:hover svg {
          transform: translateY(2px);
        }
      `}</style>
    </div>
  )
}
