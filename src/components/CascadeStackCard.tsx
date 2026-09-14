import type { CSSProperties, ReactNode } from 'react'
import type { NewsArticle } from '@/types/news'
import { getStackLayout, getLayerGeom, getStackMarginBottom } from '@/lib/cascadeStack'

/**
 * ТЗ-100 — обёртка карточки-стопки каскада.
 *
 * Архитектура клика (ТЗ-100 §2.4):
 * - NewsCard НЕ получает собственный onClick — хозяин клика снаружи (карусель);
 * - слои-стопка рендерятся здесь, ВНУТРИ того же <div data-flip-id> — FLIP не трогаем;
 * - первоисточник (cluster_position === 1): клик по обёртке ведёт на каскад
 *   ВМЕСТО handleCardClick (NewsDetailModal для первоисточника из карусели
 *   недоступен — новость открывается из списка панели каскада);
 * - поздняя новость: обычный handleCardClick, чип внутри NewsCard ловит свой
 *   клик со stopPropagation.
 *
 * До ТЗ-101 onCascadeClick пробрасывает navigate('/cascades?cluster=<id>'),
 * в ТЗ-101 тот же проп подменится на разъезд — этот компонент не меняется.
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
  onCascadeClick,
  flipId,
  dataAttrs,
  className = '',
  style,
  children,
}: CascadeStackCardProps) {
  const layout = getStackLayout(article, variant, Date.now(), !!onCascadeClick)

  const handleClick = layout.wrapperClick === 'cascade'
    ? () => onCascadeClick!(article.cluster_id!)
    : onCardClick

  return (
    <div
      data-flip-id={flipId}
      {...dataAttrs}
      className={`cascade-stack-host relative ${className}`}
      style={{ marginBottom: getStackMarginBottom(layout.layersCount), ...style }}
    >
      {/* Слои-стопка под карточкой (только портрет первоисточника). pointer-events
          отключены — клик ловит обёртка. Значения геометрии — из мокапа. */}
      {Array.from({ length: layout.layersCount }, (_, l) => {
        const g = getLayerGeom(l)
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
              zIndex: 0,
              // hover-веер: transform задаётся через CSS-переменные
              ['--cascade-ty' as string]: `${g.hoverShift}px`,
              ['--cascade-rot' as string]: `${g.hoverRotate}deg`,
            }}
          />
        )
      })}
      <div className="relative z-[1] cursor-pointer" onClick={handleClick}>
        {children}
      </div>
    </div>
  )
}
