import { useEffect, useRef, useState } from 'react'
import { useAuthModal } from '@/contexts/AuthModalContext'
import { logAnalyticsEvent } from '@/lib/analytics'

/**
 * Видео-баннер «Суперсила инвестора — знать» (TZ_HOME_SUPERPOWER_VIDEO_BANNER).
 * Самый низ неавторизованной главной, после Features / календаря.
 *
 * Поведение:
 *  - видео ленивое: src выставляется через IntersectionObserver (rootMargin 200px),
 *    без скролла до баннера сетевого запроса нет (preload=none до выставления src);
 *  - уход секции из viewport → pause(), возврат → play();
 *  - ошибка загрузки → <video> удаляется из DOM, остаётся градиент-заглушка;
 *  - prefers-reduced-motion → видео не грузится и не играет, бейдж без пульса;
 *  - ролик №2: график заходит в левую треть кадра → вуаль слева усилена (ТЗ 7.2).
 * CTA открывает существующую модалку регистрации (роута /register в проекте нет).
 */
const VIDEO_SRC = '/media/hero-video-2.mp4'

export default function SuperpowerVideoBanner() {
  const sectionRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [srcLoaded, setSrcLoaded] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [analyticsSent, setAnalyticsSent] = useState(false)
  const { open: openAuthModal } = useAuthModal()

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting) {
          if (!analyticsSent) {
            logAnalyticsEvent('home_superpower_view')
            setAnalyticsSent(true)
          }
          if (!reducedMotion && !srcLoaded && !videoError) setSrcLoaded(true)
          if (!reducedMotion) videoRef.current?.play().catch(() => {})
        } else {
          videoRef.current?.pause()
        }
      },
      { rootMargin: '200px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [srcLoaded, videoError, analyticsSent])

  const handleCta = () => {
    logAnalyticsEvent('home_superpower_cta_click')
    openAuthModal()
  }

  return (
    <section
      ref={sectionRef}
      aria-label="Суперсила инвестора — знать"
      className="relative overflow-hidden w-full min-h-[260px] md:min-h-[360px]"
      style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', backgroundColor: '#0A0A0A' }}
    >
      {/* Градиент-заглушка под видео: видна до загрузки, при ошибке и под reduced-motion */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(600px 300px at 20% 30%, rgba(0,212,255,.14), transparent 60%),' +
            'radial-gradient(500px 260px at 80% 80%, rgba(0,212,255,.10), transparent 60%),' +
            '#0A0A0A',
        }}
      />

      {/* Видео — маунтится только после приближения к viewport */}
      {srcLoaded && !videoError && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.9 }}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          src={VIDEO_SRC}
          onError={() => setVideoError(true)}
        />
      )}

      {/* Вуаль — читаемость текста на любом кадре. Ролик №2: график в левой трети → левый край .92 */}
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden md:block"
        style={{
          background:
            'linear-gradient(90deg, rgba(6,6,6,.92) 0%, rgba(6,6,6,.7) 40%, rgba(6,6,6,.25) 100%),' +
            'linear-gradient(0deg, rgba(6,6,6,.6), transparent 40%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 md:hidden"
        style={{ background: 'linear-gradient(0deg, rgba(6,6,6,.85), rgba(6,6,6,.35))' }}
      />

      {/* Контент */}
      <div className="relative flex flex-col justify-center max-w-[620px] p-[28px] md:p-[48px] min-h-[260px] md:min-h-[360px]">
        <span
          className="inline-flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wider mb-4"
          style={{ color: '#00D4FF', border: '1px solid rgba(0,212,255,.35)', borderRadius: 999, padding: '5px 12px', width: 'fit-content' }}
        >
          <i
            className="svb-pulse inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: '#00D4FF', boxShadow: '0 0 8px rgba(0,212,255,.8)' }}
          />
          Live · пульс рынка
        </span>

        <h2
          className="font-bold"
          style={{ fontSize: 'clamp(26px, 4vw, 40px)', letterSpacing: '-0.02em', lineHeight: 1.1, color: '#FFFFFF' }}
        >
          Суперсила инвестора —<br />
          <b style={{ color: '#00D4FF' }}>знать</b>
        </h2>

        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: '#9CA3AF', maxWidth: 460 }}>
          Что случилось, что это значит, как отреагировал рынок — за 2 минуты, без шума.
        </p>

        <button
          onClick={handleCta}
          className="svb-cta mt-6 inline-flex items-center gap-2 font-semibold transition-all hover:-translate-y-px"
          style={{
            backgroundColor: '#00D4FF',
            color: '#04141A',
            fontSize: 14,
            borderRadius: 10,
            padding: '12px 22px',
            width: 'fit-content',
            boxShadow: '0 4px 24px rgba(0,212,255,.15)',
          }}
        >
          Получить суперсилу <span>→</span>
        </button>
      </div>

      {/* Пульс точки бейджа + hover-тень CTA (self-contained) */}
      <style>{`
        @keyframes svb-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .45; transform: scale(.8); }
        }
        .svb-pulse { animation: svb-pulse 1.6s ease-in-out infinite; }
        .svb-cta:hover { box-shadow: 0 8px 28px rgba(0,212,255,.35); }
        @media (prefers-reduced-motion: reduce) {
          .svb-pulse { animation: none; }
          .svb-cta { transition: none; }
          .svb-cta:hover { transform: none; }
        }
      `}</style>
    </section>
  )
}
