import type { CSSProperties, ReactNode } from 'react'
import type { NewsArticle } from '@/types/news'
import { getStackLayout, getLayerGeom, getStackMarginBottom } from '@/lib/cascadeStack'
import { useCascadeExpand } from '@/components/CascadeExpandProvider'

/**
 * ТЗ-100 — обёртка карточки-стопки каскада (навигация — ТЗ-101).
 *
 * Архитектура клика (ТЗ-100 §2.4, ТЗ-101 задача 1):
 * - NewsCard НЕ получает собственный onClick — хозяин клика снаружи (карусель);
 * - слои-стопка рендерятся здесь, ВНУТРИ того же <div data-flip-id> — FLIP не трогаем;
 * - первоисточник (cluster_position === 1): клик по обёртке ведёт на каскад
 *   ВМЕСТО handleCardClick (NewsDetailModal для первоисточника из карусели
 *   недоступен — новость открывается из списка панели каскада);
 * - поздняя новость: обычный handleCardClick, чип внутри NewsCard ловит свой
 *   клик со stopPropagation.
 *
 * Обработчик каскада: проп onCascadeClick, а при его отсутствии — контекст
 * разъезда ТЗ-101 (провайдер в NewsCarousel/NewsFeed): разъезд панели под
 * каруселью, либо interim-navigate '/cascades?cluster=<id>' при
 * VITE_CASCADE_EXPAND=false. Открытая стопка получает класс --open — её
 * слои улетают вниз (анимация из мокапа, CSS в index.css).
 */
interface CascadeStackCardProps {
  article: NewsArticle
  variant?: 'portrait' | 'landscape'
  /** Обычный клик по карточке (NewsDetailModal). */
  onCardClick: () => void
  /** Клик по элементам каскада (обёртка первоисточника / чип поздней новости). */
  onCascadeClick?: (clusterId: string) => void
  /** id для data-flip-id (FLIP-анимация useFlipAnimation). */
  flipId: string
  /** Дополнительные data-* атрибуты на корневой элемент (напр. data-newsfeed-card). */
  dataAttrs?: Record<string, string>
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export default function CascadeStackCard({
  article,
  variant = 'portrait',
  onCardClick,
  onCascadeClick: onCascadeClickProp,
  flipId,
  dataAttrs,
  className = '',
  style,
  children,
}: CascadeStackCardProps) {
  const cascadeCtx = useCascadeExpand()
  // ТЗ-101: проп в приоритете, fallback — контекст разъезда (карусели/лента
  // больше не пробрасывают проп — обработчик живёт в провайдере)
  const onCascadeClick = onCascadeClickProp ?? cascadeCtx?.handleCascadeClick
  const isExpanded =
    !!cascadeCtx?.expandedClusterId && cascadeCtx.expandedClusterId === article.cluster_id
  const layout = getStackLayout(article, variant, Date.now(), !!onCascadeClick)

  const handleClick = layout.wrapperClick === 'cascade'
    ? () => onCascadeClick!(article.cluster_id!)
    : onCardClick

  return (
    <div
      data-flip-id={flipId}
      {...dataAttrs}
      className={`cascade-stack-host relative ${layout.showLayers ? 'cascade-stack-host--stacked ' : ''}${isExpanded ? 'cascade-stack-host--open ' : ''}${className}`}
      style={{ marginBottom: getStackMarginBottom(layout.layersCount), ...style }}
    >
      <div className="cascade-card-wrap relative z-[1] cursor-pointer" onClick={handleClick}>
        {/* Слои-стопка под карточкой каскада (ТЗ-105: у всех карт каскада size>1,
            только портрет). pointer-events отключены — клик ловит обёртка, поэтому
            клик по хвосту поздней карточки открывает новость, а не каскад.
            ТЗ-109: слои привязаны к низу КАРТОЧКИ (top считается от этого div),
            а не к низу host — flex-stretch ряда их не отрывает (чёрный зазор).
            zIndex −1: внутри z-[1]-контекста слой за <motion.article> (фон у неё
            только внутри border-box), но выше ::before-свечения ТЗ-108/111
            (перенесено на эту обёртку, z −2 — свечение обнимает карточку, а не
            растянутый host). Порядок: свечение → слои → карточка. ⚠️ если у этой
            обёртки появится свой фон — слои спрячутся за него. */}
        {Array.from({ length: layout.layersCount }, (_, l) => {
          // ТЗ-103: getLayerGeom 1-based (как в мокапе) — верхний слой l+1 = 1
          const g = getLayerGeom(l + 1)
          return (
            <div
              key={l}
              className="cascade-stack-layer"
              style={{
                top: 'calc(100% - 14px)',
                left: g.inset,
                right: g.inset,
                height: g.height,
                opacity: g.opacity,
                // ТЗ-105: градация прозрачности — финальный кадр keyframes больше
                // не перекрывает инлайн opacity (см. --cascade-op в index.css)
                ['--cascade-op' as string]: String(g.opacity),
                zIndex: -1,
                // hover-веер: transform задаётся через CSS-переменные
                ['--cascade-ty' as string]: `${g.hoverShift}px`,
                ['--cascade-rot' as string]: `${g.hoverRotate}deg`,
              }}
            />
          )
        })}
        {children}
      </div>
    </div>
  )
}
