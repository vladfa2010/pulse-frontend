/**
 * PULSE — Радио: блюр-оверлей колонки ленты до первого запуска эфира (ТЗ-50).
 *
 * Снимается ТОЛЬКО кнопкой play (флаг radio-started-v1, см. RadioPage).
 * Когда нечего читать — блюр остаётся, кнопка собирает эфир из последних
 * новостей (подпись меняется).
 *
 * Адаптация от ТЗ: цвета подписи — прод-токены (text-cyan-400/text-zinc-500);
 * в проде нет CSS-переменных --live/--dim из донора. Поверхность кнопки —
 * Liquid Glass из «итоговой HTML-структуры» ТЗ-50 v2 (не градиент из черновика
 * задачи 3: v2 перешёл на стеклянный диск).
 */
import { BorderGlowButton } from './BorderGlowButton'

interface Props {
  unread: number
  onPlay: () => void
}

/** Liquid Glass поверхность диска (рецепт «Дизайн-система PULSE» §4.2) */
const GLASS_SURFACE =
  'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,255,255,0.10), transparent 60%),' +
  'radial-gradient(ellipse 60% 40% at 50% 108%, rgba(0,212,255,0.12), transparent 62%),' +
  'rgba(255,255,255,0.05)'

export function FeedBlurOverlay({ unread, onPlay }: Props) {
  const hasUnread = unread > 0
  return (
    <div className="radio-blur absolute inset-0 z-20 flex flex-col items-center justify-center gap-6">
      <BorderGlowButton
        surface={GLASS_SURFACE}
        onClick={onPlay}
        className="radio-play-btn"
        title="Запустить эфир"
      >
        <span className="radio-play-tri">▶</span>
      </BorderGlowButton>
      <div className="px-4 text-center">
        <div className="text-[13px] font-bold tracking-[0.3em] text-cyan-400">
          {hasUnread ? `ЭФИР · ${unread} НЕПРОЧИТАННЫХ` : 'ЭФИР · ЛЕНТА'}
        </div>
        <div className="mt-1.5 text-[9px] uppercase tracking-[0.2em] text-zinc-500">
          {hasUnread
            ? 'приветствие + главное по вашим темам'
            : 'соберу эфир из последних новостей'}
        </div>
      </div>
    </div>
  )
}
