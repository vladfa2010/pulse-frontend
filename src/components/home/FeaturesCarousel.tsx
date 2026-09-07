/**
 * =============================================================================
 * PULSE — Карусель «Что Pulse делает вместо вас» (гостевая главная)
 * =============================================================================
 *
 * ТЗ-57: горизонтальная карусель из 7 карточек поверх общей оболочки
 * NewsCarousel (стрелки по 450px, нативный скролл/свайп, боковые затемнения).
 * Первые 3 карточки — «убойная тройка», видна без скролла; порядок — часть
 * смысла, не сортировать. Блок рендерится только гостям (гейт в Home.tsx).
 */

import NewsCarousel from '@/components/NewsCarousel'
import { Layers, CandlestickChart, ShieldCheck, Sparkles, TrendingUp, Tag, Calendar } from 'lucide-react'

const CARDS = [
  { icon: Layers,           title: 'Хватит читать перепечатки',  desc: 'Одно событие разлетается по десяткам СМИ. Pulse собирает их в одну карточку и показывает, кто написал первым.' },
  { icon: CandlestickChart, title: 'Цена уже здесь',             desc: 'Новость про Сбер — и рядом свеча: как бумага отреагировала. Терминал не нужен.' },
  { icon: ShieldCheck,      title: 'Не верьте заголовку на слово', desc: 'Pulse проверяет громкие заявления и ставит вердикт с источниками — прямо в карточке новости.' },
  { icon: Sparkles,         title: 'Саммари дня за 30 секунд',   desc: 'AI собирает главное по вашим темам за день: один абзац вместо часа чтения ленты.' },
  { icon: TrendingUp,       title: 'Тональность каждой новости', desc: 'Позитив, негатив или нейтралитет — видно сразу, не дочитывая текст до конца.' },
  { icon: Tag,              title: 'Лента только по вашим темам', desc: 'Компании, сектора, личности, тренды — подписываетесь на темы, получаете только их.' },
  { icon: Calendar,         title: 'Календарь инвестора',        desc: 'Дивиденды, отчётности и события по вашим бумагам — в одном месте, без гугления.' },
]

export default function FeaturesCarousel() {
  return (
    <NewsCarousel title="Что Pulse делает вместо вас" subtitle="листайте" count={7}>
      {CARDS.map(({ icon: Icon, title, desc }) => (
        <div key={title} className="w-[210px] flex-shrink-0 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <div className="mb-4"><Icon size={24} className="text-accent-primary" /></div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
          <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
        </div>
      ))}
    </NewsCarousel>
  )
}
