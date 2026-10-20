/**
 * =============================================================================
 * PULSE — Вкладка «Аналитика» страницы «Каскады» (ТЗ-185, задача 5)
 * =============================================================================
 *
 * Ночной LLM-разбор топ-20 по числу перепечаток (каскады за 24ч, сюжеты за 7д,
 * темы последнего прогона): синтез «что провоцирует на виральность». Ручного
 * обновления нет (решение владельца, §1 ТЗ-185) — отчёт живёт до ночного прогона
 * 05:30 МСК; staleTime хука совпадает с серверным TTL 15 мин.
 *
 * Состав: нейтральный дисклеймер смещения выборки (§4 ТЗ-185) + три секции-
 * карточки по скоупам (Каскады · 24ч / Сюжеты · 7д / Темы): топ тем (нумерованный
 * список), триггеры-чипсы, первоисточники, темпо, итог курсивом внизу.
 * null-скоуп — «Первый отчёт появится после ночного прогона»; на сборке без
 * VITE_TOPICS_ENABLED темы отвечают «недоступно на этой сборке».
 */

import { Info, Loader2 } from 'lucide-react'
import { useVirality, type ViralityPayload } from '@/lib/cascadesApi'
import { TOPICS_ENABLED } from '@/lib/cascadeParams'
import { formatMskDateTime } from '@/lib/cascadeFormat'

const EMPTY_STATE = 'Первый отчёт появится после ночного прогона'
const TOPICS_DISABLED_STATE = 'недоступно на этой сборке'

type ViralityScopeKey = 'cascades_24h' | 'stories_7d' | 'topics'

const SCOPES: Array<{ key: ViralityScopeKey; title: string }> = [
  { key: 'cascades_24h', title: 'Каскады · 24ч' },
  { key: 'stories_7d', title: 'Сюжеты · 7д' },
  { key: 'topics', title: 'Темы' },
]

function ScopeSection({
  title,
  payload,
  generatedAt,
}: {
  title: string
  payload: ViralityPayload | null
  generatedAt: string
}) {
  return (
    <section className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-4 flex flex-col">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {/* Дата последнего прогона — только когда отчёт по скоупу есть (ТЗ-185) */}
        {payload && (
          <span className="shrink-0 text-[10px] text-text-muted">{formatMskDateTime(generatedAt)}</span>
        )}
      </div>

      {!payload ? (
        <p className="text-xs text-text-muted py-6 text-center">
          {title === 'Темы' && !TOPICS_ENABLED ? TOPICS_DISABLED_STATE : EMPTY_STATE}
        </p>
      ) : (
        <>
          {/* Топ тем: 3–5 пунктов, title + takeaway одним предложением */}
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Топ тем</div>
            <ol className="flex flex-col gap-2">
              {payload.top_topics.map((t, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="shrink-0 text-xs font-semibold text-accent-primary">{i + 1}.</span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-text-primary leading-snug">{t.title}</div>
                    <p className="text-xs text-text-secondary leading-snug">{t.takeaway}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Общие триггеры виральности — чипсы-облако */}
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Триггеры виральности</div>
            <div className="flex flex-wrap gap-1.5">
              {payload.virality_triggers.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.04] text-[11px] text-text-secondary"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Кто чаще первоисточник в топе */}
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Первоисточники</div>
            <p className="text-xs text-text-secondary leading-snug mb-1">{payload.ignition.sources.join(' · ')}</p>
            <p className="text-xs text-text-muted leading-snug">{payload.ignition.takeaway}</p>
          </div>

          {/* Темпо: всплески vs долгие каскады */}
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Темпо</div>
            <p className="text-xs text-text-secondary leading-snug mb-1">{payload.tempo.fast_vs_slow}</p>
            <p className="text-xs text-text-muted leading-snug">{payload.tempo.takeaway}</p>
          </div>

          {/* Итог LLM-разбора — курсивом внизу карточки */}
          <p className="mt-auto text-xs text-text-muted italic leading-snug border-t border-white/[0.06] pt-2.5">
            {payload.summary}
          </p>
        </>
      )}
    </section>
  )
}

export default function AnalyticsTab() {
  const { data, isLoading, isError, refetch } = useVirality(true)

  return (
    <div>
      {/* Дисклеймер смещения выборки (§4 ТЗ-185): топ по размеру — «что разгоняют
          редакции», не «что читают люди»; нейтральный цвет, как разделитель */}
      <div className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 mb-5">
        <Info size={16} className="text-text-muted shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary leading-relaxed">
          Топ по числу перепечаток в подключённых источниках — «что разгоняют редакции», не репосты из соцсетей.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-accent-primary" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-6 py-10 text-center">
          <p className="text-sm text-text-secondary mb-4">Не удалось загрузить аналитику. Попробуйте ещё раз.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary text-[#060606] hover:opacity-90 transition-opacity"
          >
            Повторить
          </button>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SCOPES.map((scope) => (
            <ScopeSection
              key={scope.key}
              title={scope.title}
              payload={data.scopes[scope.key]}
              generatedAt={data.generated_at}
            />
          ))}
        </div>
      )}
    </div>
  )
}
