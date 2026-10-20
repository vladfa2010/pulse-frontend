/**
 * =============================================================================
 * PULSE — Общий SVG-спарклайн (ТЗ-186, задача 5)
 * =============================================================================
 *
 * Вынесен из DailySparkline вкладки «Темы» (TopicsTab.tsx) — тот же рендер
 * барами (#00D4FF, opacity-градиент по высоте), но принимает чистые числа,
 * а не TopicDailyPoint[]: «Темы» маппят daily → n, «Ресерч» (ТЗ-186) передаёт
 * share по ночным срезам. Поведение TopicsTab — регрессионный критерий №7 ТЗ-186.
 */

interface SparklineProps {
  values: number[]
  className?: string
}

export default function Sparkline({ values, className }: SparklineProps) {
  if (values.length === 0) return null
  const W = 100
  const H = 32
  const max = Math.max(1, ...values)
  const bw = W / values.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      {values.map((v, i) => {
        const h = Math.max(1, (v / max) * (H - 2))
        return (
          <rect
            key={i}
            x={i * bw}
            y={H - h}
            width={Math.max(0.6, bw - 0.4)}
            height={h}
            rx={0.5}
            fill="#00D4FF"
            opacity={0.3 + 0.7 * (v / max)}
          />
        )
      })}
    </svg>
  )
}
