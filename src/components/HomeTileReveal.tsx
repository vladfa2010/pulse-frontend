import { useState, useRef, useCallback } from 'react'
import TileReveal from '@/components/react-bits/tile-reveal'
import BorderGlow from '@/components/BorderGlow'
import { useAuthModal } from '@/contexts/AuthModalContext'

const IMAGES = Array.from({ length: 9 }, (_, i) => `/media/tile-reveal/life-${i + 1}.jpg`)

export default function HomeTileReveal() {
  const { open: openAuthModal } = useAuthModal()
  // ТЗ-71: кнопка смонтирована всегда — плавное появление даёт opacity самого
  // TileReveal (как в мокапе). Пробег свечения BorderGlow запускаем внешним
  // сигналом в финале сцены; защёлка finaleRef даёт новый пробег при каждом
  // возврате к финалу после отскролла назад (< 0.9).
  const [sweepCount, setSweepCount] = useState(0)
  const finaleRef = useRef(false)
  // ТЗ-72: ссылка на onProgress обязана быть стабильной — иначе ре-рендер
  // от setSweepCount меняет инлайн-проп, перезапускает эффект TileReveal,
  // и settle() мгновенно догоняет прогресс (скачок текста в финале).
  const handleProgress = useCallback((p: number) => {
    if (!finaleRef.current && p >= 0.98) {
      finaleRef.current = true
      setSweepCount(c => c + 1) // пробег свечения — кнопка уже на виду
    } else if (finaleRef.current && p < 0.9) {
      finaleRef.current = false // отскроллили назад — следующий финал даст новый пробег
    }
  }, [])

  return (
    <TileReveal
      images={IMAGES}
      columns={3}
      gap={20}
      gridWidth={760}
      tileAspect={1}
      tileRadius={16}
      grayscale={false}
      direction="alternate"
      stagger={0.06}
      overlap={0.6}
      zoom={2.2}
      spread={0.4}
      scrollLength={4}
      endBuffer={4.5} // ТЗ-74: буфер после финала — инерция скролла не уводит CTA, этап держится ещё ~4.5 экрана
      scrub={0.08}
      contentGap={28}
      onProgress={handleProgress}
      headline={
        <h2 className="text-[clamp(30px,5vw,60px)] font-bold tracking-[-0.03em] leading-[1.08] max-w-[820px]">
          Освободите время <em className="italic text-accent-primary">для жизни</em>,<br />
          а не сидите в смартфоне
        </h2>
      }
    >
      <div className="flex flex-col items-center gap-[22px]">
        <p className="text-[17px] leading-[1.65] text-text-secondary max-w-[520px]">
          Pulse уже прочитал тысячи новостей за вас и оставил только то, что движет ценой.
          Пять минут в день — и вы в курсе всего.
        </p>
        <BorderGlow sweepSignal={sweepCount}>
          <button
            onClick={() => openAuthModal('register')}
            className="px-[30px] py-[15px] text-[21px] font-medium text-text-primary"
          >
            Бесплатная регистрация
          </button>
        </BorderGlow>
      </div>
    </TileReveal>
  )
}
