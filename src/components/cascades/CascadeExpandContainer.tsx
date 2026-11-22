/**
 * =============================================================================
 * PULSE — Контейнер разъезда панели каскада (ТЗ-101, задача 1)
 * =============================================================================
 *
 * Самостоятельный блок под треком карусели / сеткой ленты: grid-rows 0fr→1fr,
 * transition .5s cubic-bezier(.22,1,.36,1) (значения из мокапа stack-feed.html,
 * режим «А · Разъезд вниз»). Рендерит переиспользуемый CascadeDetailPanel
 * (ТЗ-93) — та же форма каскада, что на /cascades.
 *
 * Инварианты ТЗ-101:
 * - вне провайдера или при VITE_CASCADE_EXPAND=false не монтируется вовсе;
 * - график грузится только при раскрытии — панель монтируется по клику,
 *   useCascadeChart стреляет сам (enabled: Boolean(clusterId), ничего не добавляем);
 * - при сворачивании панель удерживается (retainedClusterId) до конца transition,
 *   затем размонтируется через onContainerTransitionEnd.
 */

import CascadeDetailPanel from '@/components/cascades/CascadeDetailPanel'
import { useCascadeExpand } from '@/components/CascadeExpandProvider'

export default function CascadeExpandContainer() {
  const ctx = useCascadeExpand()
  // Откат/вне охвата: контейнер не монтируется (инвариант §4 ТЗ-101)
  if (!ctx || !ctx.expandEnabled) return null

  // ТЗ-218: контентная панель (бакет) имеет приоритет над кластерной;
  // при сворачивании размонтируется сразу (retained не нужен)
  const contentOpen = ctx.expandedContent != null
  const panelId = ctx.expandedClusterId ?? ctx.retainedClusterId
  if (!contentOpen && !panelId) return null

  return (
    <div
      className={contentOpen || ctx.expandedClusterId ? 'cascade-expand cascade-expand--open' : 'cascade-expand'}
      onTransitionEnd={(e) => {
        // grid-template-rows анимируется только на самом контейнере;
        // transition дочерних элементов (список, график) игнорируем
        if (e.target === e.currentTarget && e.propertyName === 'grid-template-rows') {
          ctx.onContainerTransitionEnd()
        }
      }}
    >
      <div className="cascade-expand__inner">
        {contentOpen ? ctx.expandedContent : <CascadeDetailPanel clusterId={panelId!} onClose={ctx.close} />}
      </div>
    </div>
  )
}
