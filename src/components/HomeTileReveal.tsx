import { useState } from 'react'
import TileReveal from '@/components/react-bits/tile-reveal'
import BorderGlow from '@/components/BorderGlow'
import { useAuthModal } from '@/contexts/AuthModalContext'

const IMAGES = Array.from({ length: 9 }, (_, i) => `/media/tile-reveal/life-${i + 1}.jpg`)

export default function HomeTileReveal() {
  const { open: openAuthModal } = useAuthModal()
  // CTA монтируем только в финале сцены — тогда IntersectionObserver
  // внутри BorderGlow запускает пробег свечения именно когда кнопка видна
  // (иначе он срабатывает при входе sticky-сцены во вьюпорт, пока кнопка
  // ещё прозрачная, и пробег проходит вхолостую).
  const [ctaVisible, setCtaVisible] = useState(false)

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
      scrub={0.08}
      contentGap={28}
      onProgress={p => {
        // гистерезис: показать в самом финале, скрыть при отскролле назад —
        // пробег свечения перезапустится при каждом возврате к финалу
        if (!ctaVisible && p >= 0.98) setCtaVisible(true)
        else if (ctaVisible && p < 0.9) setCtaVisible(false)
      }}
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
        {ctaVisible && (
          <BorderGlow>
            <button
              onClick={() => openAuthModal('register')}
              className="px-[30px] py-[15px] text-[21px] font-medium text-text-primary"
            >
              Бесплатная регистрация
            </button>
          </BorderGlow>
        )}
      </div>
    </TileReveal>
  )
}
