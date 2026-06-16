import { useEffect } from 'react'
import {
  Tag,
  Search,
  Database,
  Lightbulb,
  AlertCircle,
  ChevronRight,
  Layers,
  Brain,
  Filter,
} from 'lucide-react'

/* =============================================================================
   PULSE — Instructions Page
   How tags work: tag ≠ category, matching logic, personal feed
   ============================================================================= */

const SECTIONS = [
  {
    id: 'tag-vs-category',
    icon: AlertCircle,
    title: 'Тег — это не категория',
    accent: '#EF4444',
    content: [
      {
        subtitle: 'Точечный тег',
        text: 'Когда вы создаете тег «Сбер», система ищет ТОЛЬКО новости про Сбербанк. Новость про ВТБ, Альфа-Банк или Тинькофф НЕ попадет в вашу ленту.',
        example: 'Тег «Сбер» → только «Сбербанк», «Сбер», «SBER"',
      },
      {
        subtitle: 'Широкий тег',
        text: 'Если вы хотите видеть ВСЕ банковские новости — создайте тег «банк». Тогда в ленту попадут и Сбер, и ВТБ, и Альфа, и ЦБ.',
        example: 'Тег «банк» → «Сбербанк», «ВТБ», «Альфа-Банк», «ставка ЦБ»',
      },
    ],
  },
  {
    id: 'granularity',
    icon: Layers,
    title: 'Гранулярность: выбирайте сами',
    accent: '#00D4FF',
    content: [
      {
        subtitle: 'Узко',
        text: 'Один эмитент, одна компания. Максимально релевантные новости, но мало объема.',
        example: '«Apple» — только про Apple',
      },
      {
        subtitle: 'Средне',
        text: 'Сектор или индустрия. Баланс релевантности и объема.',
        example: '«tech» — Apple, Google, Microsoft, NVIDIA и т.д.',
      },
      {
        subtitle: 'Широко',
        text: 'Макро-тема или тренд. Много новостей, но разнородных.',
        example: '«AI» — все новости про искусственный интеллект',
      },
    ],
  },
  {
    id: 'matching',
    icon: Brain,
    title: 'Как система находит новости',
    accent: '#34D399',
    content: [
      {
        subtitle: 'Метод 1: Keyword Matching',
        text: 'Система проверяет, входят ли ключевые слова вашего тега в заголовок или текст новости. Быстро, точно, локально.',
        example: 'Тег «Сбер» → keywords: ["сбер", "сбербанк", "sber"] → ищем в тексте',
      },
      {
        subtitle: 'Метод 2: LLM Smart Matching',
        text: 'Нейросеть (Kimi) анализирует новость и определяет, какие теги из базы ей релевантны — даже если ключевых слов нет в тексте напрямую.',
        example: 'Новость: «SoftBank инвестирует в чипы для ML» → LLM: ["nvidia", "ai", "tech"]',
      },
    ],
  },
  {
    id: 'global-vs-personal',
    icon: Database,
    title: 'Общая база vs Персональная лента',
    accent: '#A78BFA',
    content: [
      {
        subtitle: 'Общая база тегов',
        text: 'Все теги ВСЕХ пользователей хранятся в одном месте. Когда приходит новость, система проверяет ее против ВСЕХ тегов — не только ваших.',
        example: 'Пользователь А создал «lukoil», Пользователь Б — «apple». Новость про Лукойл получит тег «lukoil» для обоих.',
      },
      {
        subtitle: 'Персональная лента (Карусели 1 и 2)',
        text: 'Вы видите только новости по ВАШИМ тегам. Если у вас нет тега «lukoil» — новость про Лукойл не появится в вашей персональной ленте.',
        example: 'У вас: ["sber", "apple"]. Новость с тегами ["lukoil", "oil"] — НЕ в вашей ленте.',
      },
      {
        subtitle: 'Общая лента (Карусель 3)',
        text: 'Все новости со всеми тегами. Вы видите, что у новости есть тег «lukoil», и можете подумать: «А может мне тоже создать этот тег?»',
        example: 'Видите новость «Лукойл отчитался» с тегом lukoil → создаете тег → он появляется в вашей ленте.',
      },
    ],
  },
]

const TIPS = [
  {
    icon: Search,
    title: 'Начните с 1 тега',
    text: 'На бесплатном тарифе у вас 1 тег. Выберите самый важный для вас эмитент или тему.',
  },
  {
    icon: Tag,
    title: 'Тип определяется автоматически',
    text: 'При создании тега система через LLM определяет тип: компания, тикер, сектор, тренд, персона, сырье, индекс или валюта.',
  },
  {
    icon: Lightbulb,
    title: 'Создавайте несколько тегов',
    text: 'На Premium (25 тегов) создайте и узкий («Сбер»), и широкий («банк») — так вы не пропустите ничего важного.',
  },
  {
    icon: Filter,
    title: 'Backfill работает автоматически',
    text: 'Когда вы создаете новый тег, система мгновенно сканирует ВСЮ базу новостей и привязывает подходящие к вашему тегу.',
  },
]

/* ─── Liquid Glass Card ─── */
function GlassCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl p-6 md:p-8 ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {children}
    </div>
  )
}

/* ─── Section Block ─── */
function SectionBlock({
  section,
  index,
}: {
  section: (typeof SECTIONS)[number]
  index: number
}) {
  const Icon = section.icon

  return (
    <section
      id={section.id}
      className="mb-16 md:mb-20"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${section.accent}15`, border: `1px solid ${section.accent}30` }}
        >
          <Icon size={24} style={{ color: section.accent }} />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
          {section.title}
        </h2>
      </div>

      {/* Content cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {section.content.map((item, i) => (
          <GlassCard key={i}>
            <h3
              className="text-lg font-semibold mb-3 flex items-center gap-2"
              style={{ color: section.accent }}
            >
              <ChevronRight size={18} />
              {item.subtitle}
            </h3>
            <p className="text-[#9CA3AF] text-sm leading-relaxed mb-4">
              {item.text}
            </p>
            <div
              className="rounded-lg px-4 py-3 text-sm font-mono"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                color: '#D1D5DB',
              }}
            >
              {item.example}
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  )
}

/* ─── Main Page ─── */
export default function Instructions() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      {/* ═══════ Hero ═══════ */}
      <div
        className="pt-28 pb-16 md:pt-36 md:pb-20 px-6 md:px-12"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 212, 255, 0.08), transparent)',
        }}
      >
        <div className="max-w-[1000px] mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
            style={{
              backgroundColor: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              color: '#00D4FF',
            }}
          >
            <Tag size={14} />
            Как работает PULSE
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-5">
            Как работают{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #00D4FF, #34D399)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              теги
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[#9CA3AF] max-w-[680px] mx-auto leading-relaxed">
            Поймите разницу между тегом и категорией, настройте свою
            персональную ленту и не пропустите важные новости.
          </p>
        </div>
      </div>

      {/* ═══════ Content ═══════ */}
      <div className="max-w-[1000px] mx-auto px-6 md:px-12 pb-20">
        {SECTIONS.map((section, i) => (
          <SectionBlock key={section.id} section={section} index={i} />
        ))}

        {/* ═══════ Tips ═══════ */}
        <section className="mb-16">
          <div className="flex items-center gap-4 mb-8">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: 'rgba(52, 211, 153, 0.1)',
                border: '1px solid rgba(52, 211, 153, 0.2)',
              }}
            >
              <Lightbulb size={24} style={{ color: '#34D399' }} />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Практические советы
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TIPS.map((tip, i) => {
              const TipIcon = tip.icon
              return (
                <GlassCard key={i}>
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        backgroundColor: 'rgba(0, 212, 255, 0.08)',
                      }}
                    >
                      <TipIcon size={20} style={{ color: '#00D4FF' }} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white mb-2">
                        {tip.title}
                      </h3>
                      <p className="text-sm text-[#9CA3AF] leading-relaxed">
                        {tip.text}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        </section>

        {/* ═══════ Summary ═══════ */}
        <GlassCard className="text-center">
          <h3
            className="text-xl font-bold mb-4"
            style={{
              background: 'linear-gradient(135deg, #00D4FF, #34D399)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Главное правило
          </h3>
          <p className="text-[#D1D5DB] text-lg leading-relaxed max-w-[600px] mx-auto">
            Тег — это <strong className="text-white">точный поисковый запрос</strong>, а не
            категория. Вы контролируете гранулярность: хотите узко — создайте
            тег «Сбер», хотите широко — создайте тег «банк».
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
