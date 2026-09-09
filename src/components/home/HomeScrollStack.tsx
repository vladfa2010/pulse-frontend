import { lazy, Suspense, useMemo } from 'react'
import ScrollStack from '@/components/react-bits/scroll-stack'

// ТЗ-81: BlackHole тянет three.js (~400 КБ gzip) — грузим лениво, код бандла
// подгружается только когда сцена приближается к вьюпорту (гейтинг в ScrollStack).
const BlackHoleLazy = lazy(() => import('@/components/react-bits/black-hole'))

// ТЗ-77: тексты утверждены владельцем 2026-09-09, править только через него.
const ITEMS = [
  { eyebrow: '01', title: 'Первая, а не одиннадцатая',
    body: 'Одно событие — одна новость. Система склеивает перепечатки и показывает первоисточник: вы узнаёте о событии на 20–40 минут раньше тех, кто читает копии.',
    accent: '#00D4FF' },
  { eyebrow: '02', title: 'ДНК новостного потока',
    body: 'Активность новостей в цифрах: тепловая карта фона по вашему портфелю, оценка тональности каждого сюжета и график сантимента. Видно, когда фон закипает, когда затихает и куда он клонит — до того, как это заметит цена.',
    accent: '#A78BFA' },
  { eyebrow: '03', title: 'Знай, что будет сегодня',
    body: 'Календарь событий под ваш портфель: ставка ЦБ, CPI, отчётности. Страница события готовится заранее — прогноз, история реакций, а в момент релиза обновляется сама: факт против прогноза и первое движение рынка.',
    accent: '#34D399' },
  { eyebrow: '04', title: '2 минуты — и вы снова в контексте',
    body: 'Выпали на полдня? Дайджест покажет главное за время отсутствия: «пока вас не было — 4 сюжета, рынок +0,8%». Не 100 непрочитанных, а приготовленная сводка.',
    accent: '#FBBF24' },
  { eyebrow: '05', title: 'Проверено, а не пересказано',
    body: 'Фактчекинг ключевых новостей и аудит «второе мнение» по активам: обе стороны нарратива, подтверждённое и спорное. Аргументы — вам, решение — вам.',
    accent: '#38BDF8' },
]

// ТЗ-78: заголовок hero перенесён внутрь sticky-сцены (pinned под navbar).
// Стили скопированы 1:1 с бывшей hero-секции Home.tsx (framer-motion-вход
// не переносим — заголовок pinned, анимация отыграла бы за пределами экрана).
const HEADING = (
  <h2
    style={{
      fontSize: 'clamp(32px, 5.33vw, 64px)',
      fontWeight: 700,
      lineHeight: 1.05,
      letterSpacing: '-0.04em',
      textAlign: 'center',
      margin: 0,
    }}
  >
    <span className="gradient-text">Ваши </span>
    <span className="italic" style={{ color: '#00D4FF' }}>инструменты</span>
  </h2>
)

// --- ТЗ-85: SDA-прототип (?sda=1) -------------------------------------------------
// Исследовательский флаг: стопка карточек анимируется CSS scroll-driven
// animations (view-timeline --ss-scene на секции, вешается в ScrollStack при
// sdaActive) вместо JS-цикла scroll → rAF → lerp. Без флага / без поддержки
// (Firefox, Safari < 26) / при prefers-reduced-motion — прежний JS-движок.
// Константы ниже дублируют пропы ScrollStack и формулы pose() из
// scroll-stack.tsx — менять синхронно. Keyframes генерируются ОДИН раз при
// монтировании (не покадрово): математика stack-варианта линейна по прогрессу,
// поэтому linear-интерполяция CSS повторяет JS 1:1.
const SDA_COUNT = ITEMS.length
const SDA_SEG = 100 / (SDA_COUNT - 1) // доля ранвея на одну карточку (5 → 25%)
const SDA_CARD_H = 0.324 // = cardHeight
const SDA_PEEK = 26 // = peek, px
const SDA_SCALE_STEP = 0.07 // = scaleStep
const SDA_DIM = 0.28 // = dim
// = формула recipe.enter: ((1 + 1/cardHeight) / 2) * 100 + 3
const SDA_ENTER = ((1 + 1 / SDA_CARD_H) / 2) * 100 + 3

function sdaEnabled(): boolean {
  if (typeof window === 'undefined') return false
  if (!new URLSearchParams(window.location.search).has('sda')) return false
  return (
    typeof CSS !== 'undefined' &&
    CSS.supports('animation-timeline: scroll(root block)') &&
    CSS.supports('view-timeline-name: --ss-scene')
  )
}

const sdaPct = (n: number) => String(Math.round(n * 1000) / 1000)
const sdaTy = (y: string, s: number) => `transform: translate3d(0, ${y}, 0) scale(${s})`

function buildSdaCss(): string {
  const rules: string[] = [
    // Локальный патч PULSE (ТЗ-85)
    '.ss-sda .ss-slot { will-change: transform; }',
  ]
  for (let i = 0; i < SDA_COUNT; i += 1) {
    const enterStart = Math.max(0, i - 1) * SDA_SEG // % таймлайна, где карточка начинает въезд
    const enterEnd = i * SDA_SEG // % таймлайна, где въезд закончился (она на месте)
    const finOff = SDA_COUNT - 1 - i // offset карточки в финале прогресса
    const finTy = -(finOff * SDA_PEEK)
    const finSc = 1 - finOff * SDA_SCALE_STEP
    rules.push(
      `.ss-sda .ss-slot-${i} { animation: ss-card-${i} linear both; animation-timeline: --ss-scene; animation-range: contain 0% contain 100%; }`,
    )
    const kf: string[] = []
    if (i === 0) {
      // Первая карточка не въезжает; JS-движок прячет карточку при offset > depth
      // (= прогресс > 3 → 75% таймлайна), поэтому visibility гасим сразу после.
      kf.push(`0% { ${sdaTy('0%', 1)} }`)
      kf.push(`${sdaPct((SDA_COUNT - 2) * SDA_SEG)}% { visibility: visible }`)
      kf.push(`${sdaPct((SDA_COUNT - 2) * SDA_SEG + 0.1)}% { visibility: hidden }`)
      kf.push(`100% { ${sdaTy(`${sdaPct(finTy)}px`, finSc)}; visibility: hidden }`)
    } else {
      kf.push(`0% { ${sdaTy(`${SDA_ENTER.toFixed(2)}%`, 1)} }`)
      kf.push(`${sdaPct(enterStart)}% { ${sdaTy(`${SDA_ENTER.toFixed(2)}%`, 1)} }`)
      kf.push(`${sdaPct(enterEnd)}% { ${sdaTy('0%', 1)} }`)
      kf.push(`100% { ${sdaTy(`${sdaPct(finTy)}px`, finSc)} }`)
    }
    rules.push(`@keyframes ss-card-${i} { ${kf.join(' ')} }`)

    // Затемнение накрытой карточки — чёрный оверлей (как ТЗ-83, без filter):
    // 0 → dim за сегмент накрытия, дальше держится (кривая min(offset,1)×dim).
    const dimEnd = Math.min(100, (i + 1) * SDA_SEG)
    rules.push(
      `.ss-sda .ss-dim-${i} { animation: ss-dim-${i} linear both; animation-timeline: --ss-scene; animation-range: contain 0% contain 100%; }`,
    )
    rules.push(
      `@keyframes ss-dim-${i} { 0% { opacity: 0 } ${sdaPct(i * SDA_SEG)}% { opacity: 0 } ${sdaPct(dimEnd)}% { opacity: ${SDA_DIM} } 100% { opacity: ${SDA_DIM} } }`,
    )
  }
  // Рейл прогресса: scaleX(0→1) по тому же таймлайну (= clamp(progress/(count−1))).
  rules.push(
    '.ss-sda .ss-rail-fill { animation: ss-rail linear both; animation-timeline: --ss-scene; animation-range: contain 0% contain 100%; }',
  )
  rules.push('@keyframes ss-rail { 0% { transform: scaleX(0) } 100% { transform: scaleX(1) } }')
  return rules.join('\n')
}
// --- /ТЗ-85 ----------------------------------------------------------------------

export default function HomeScrollStack() {
  // ТЗ-85: флаг фиксируется при монтировании (прототип, реактивность не нужна).
  const sda = useMemo(sdaEnabled, [])
  const sdaCss = useMemo(buildSdaCss, [])
  return (
    <>
      <ScrollStack
        background={(
          <Suspense fallback={null}>
            <BlackHoleLazy speed={0.4} />
          </Suspense>
        )}
        header={HEADING}
        items={ITEMS}
        variant="stack"
        scrollLength={1}
        peek={26}
        scaleStep={0.07}
        blur={4}
        dim={0.28}
        smooth={0.35}
        depth={3}
        cardWidth={880}
        cardHeight={0.324}
        borderRadius={16}
        showCounter={false}
        perspective={1400}
        sda={sda}
      />
      {sda && <style data-pulse-sda="scroll-stack">{sdaCss}</style>}
    </>
  )
}
