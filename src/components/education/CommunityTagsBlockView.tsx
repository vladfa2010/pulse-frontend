/**
 * =============================================================================
 * ТЗ-202 — CommunityTagsBlockView: блок «Теги сообщества» в уроке
 * =============================================================================
 *
 * Монтируется порталом в пустой div.community-tags-block (атом, как chart-block
 * ТЗ-143 и tag-select-block ТЗ-201). Данные — публичный /news/tags/popular,
 * поэтому гость видит РЕАЛЬНЫЕ теги (в отличие от демо-заглушки ТЗ-201), клик
 * по карточке ведёт в модалку логина (механика внутри PopularTagsSlider).
 * Ошибка загрузки → блок скрывается целиком (нет пустой рамки посреди урока).
 * ТЗ-203: glow — подсветка BorderGlow; при ней карточка во frameless.
 * ТЗ-203 v2: после завершения пробега подсветки вкладка периода сама
 * переключается 24ч → 7д (показ интерактивности; только пока юзер сам
 * не выбрал период — см. switchSignal в PopularTagsSlider).
 */

import { useCallback, useState } from 'react'
import PopularTagsSlider from '@/components/PopularTagsSlider'
import { usePopularTags } from '@/hooks/usePopularTags'
import GlowBlock from '@/components/education/GlowBlock'

export default function CommunityTagsBlockView({ glow = false }: { glow?: boolean }) {
  const { isError } = usePopularTags('24h', 10)
  // ТЗ-203 v2: каждый завершённый пробег свечения инкрементит сигнал —
  // слайдер переключает вкладку с дефолтного 24ч на 7д.
  const [sweepTick, setSweepTick] = useState(0)
  const onSweepEnd = useCallback(() => setSweepTick((t) => t + 1), [])

  if (isError) return null

  return (
    <GlowBlock enabled={glow} onSweepEnd={onSweepEnd}>
      <div
        style={{
          background: glow ? 'transparent' : '#101010',
          border: glow ? 'none' : '1px solid #222222',
          borderRadius: 12,
          padding: '12px 14px',
          margin: glow ? 0 : '12px 0',
        }}
      >
        <PopularTagsSlider
          variant="embedded"
          limit={10}
          autoScroll={false}
          analyticsSource="lesson_block"
          switchSignal={glow ? sweepTick : 0}
        />
      </div>
    </GlowBlock>
  )
}
