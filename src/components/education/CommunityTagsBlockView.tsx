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
 */

import PopularTagsSlider from '@/components/PopularTagsSlider'
import { usePopularTags } from '@/hooks/usePopularTags'
import GlowBlock from '@/components/education/GlowBlock'

export default function CommunityTagsBlockView({ glow = false }: { glow?: boolean }) {
  const { isError } = usePopularTags('24h', 10)

  if (isError) return null

  return (
    <GlowBlock enabled={glow}>
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
        />
      </div>
    </GlowBlock>
  )
}
