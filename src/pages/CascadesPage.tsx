/**
 * =============================================================================
 * PULSE — Страница «Каскады» (ТЗ-93, задача 4)
 * =============================================================================
 *
 * Пять вкладок: «Каскады» (дефолт) / «Сюжеты» / «Граф» / «Ресерч: кто первый» /
 * «Методология». Состояние в URL (?tab=&window=&cluster=) — F5 и шерабельность
 * (паттерн feedParams). Доступ без логина — эндпоинты публичные (как /sentiment).
 *
 * Компоновка по мокапу: строка stat-карточек → вкладки → таблица → деталь-панель
 * каскада под ней (не роут и не модалка). Stat-карточки считаются на клиенте из
 * уже загруженного ответа вкладки — отдельного эндпоинта не нужно.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Loader2 } from 'lucide-react'
import {
  parseCascadesParams,
  buildCascadesParams,
  defaultWindowForTab,
  isWindowValidForTab,
  CASCADE_WINDOWS,
  GRAPH_WINDOWS,
  type CascadesTab,
  type CascadesWindow,
  type CascadesParams,
} from '@/lib/cascadeParams'
import { useCascades, useStories, useCascadeGraph, useCascadeResearch } from '@/lib/cascadesApi'
import CascadesTable from '@/components/cascades/CascadesTable'
import StoriesTable from '@/components/cascades/StoriesTable'
import CascadeDetailPanel from '@/components/cascades/CascadeDetailPanel'
import CascadeGraph from '@/components/cascades/CascadeGraph'
import ResearchTab from '@/components/cascades/ResearchTab'
import MethodologyDoc from '@/docs/methodology'

const TAB_LABELS: Record<CascadesTab, string> = {
  cascades: 'Каскады',
  stories: 'Сюжеты',
  graph: 'Граф',
  research: 'Ресерч: кто первый',
  method: 'Методология',
}

const WINDOW_LABELS: Record<CascadesWindow, string> = { '24h': '24ч', '7d': '7д', '30d': '30д' }

function windowsForTab(tab: CascadesTab): CascadesWindow[] {
  return tab === 'cascades' ? CASCADE_WINDOWS : GRAPH_WINDOWS
}

interface StatCard {
  label: string
  value: string
  hint?: string
}

export default function CascadesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseCascadesParams(searchParams), [searchParams])
  const { tab, window, cluster } = params

  // Вкладки графа монтируем лениво — при первом открытии, дальше держим смонтированными
  const [visitedTabs, setVisitedTabs] = useState<CascadesTab[]>(['cascades'])
  useEffect(() => {
    setVisitedTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]))
  }, [tab])

  const updateParams = (next: CascadesParams, replace = false) => {
    setSearchParams(buildCascadesParams(next), replace ? { replace: true } : undefined)
  }

  // Переключение вкладки закрывает детальную панель (как в мокапе) и нормализует окно
  const switchTab = (nextTab: CascadesTab) => {
    const nextWindow = isWindowValidForTab(nextTab, window) ? window : defaultWindowForTab(nextTab)
    updateParams({ tab: nextTab, window: nextWindow, cluster: null })
  }

  const switchWindow = (nextWindow: CascadesWindow) => {
    updateParams({ tab, window: nextWindow, cluster: null })
  }

  const openCluster = (clusterId: string, targetTab?: CascadesTab) => {
    const nextTab = targetTab ?? tab
    const nextWindow = isWindowValidForTab(nextTab, window) ? window : defaultWindowForTab(nextTab)
    updateParams({ tab: nextTab, window: nextWindow, cluster: clusterId })
  }

  const closeCluster = () => updateParams({ tab, window, cluster: null }, true)

  // ─── Данные вкладок (react-query; enabled — ленивый фетч по первому открытию) ──
  const cascadesQuery = useCascades(window, tab === 'cascades')
  const storiesQuery = useStories(tab === 'stories' || visitedTabs.includes('stories'))
  const graphQuery = useCascadeGraph(window, visitedTabs.includes('graph'))
  const researchQuery = useCascadeResearch(window, visitedTabs.includes('research'))

  // ─── Stat-карточки — на клиенте из уже загруженного ответа ─────────────────
  const statCards: StatCard[] = useMemo(() => {
    if (tab === 'cascades' && cascadesQuery.data) {
      const list = cascadesQuery.data.cascades
      const totalNews = list.reduce((s, c) => s + c.size, 0)
      const biggest = list.reduce((max, c) => (c.size > (max?.size ?? 0) ? c : max), list[0])
      return [
        { label: 'Каскадов в окне', value: String(list.length) },
        { label: 'Новостей в каскадах', value: String(totalNews) },
        {
          label: 'Крупнейший каскад',
          value: biggest ? String(biggest.size) : '—',
          hint: biggest ? `${biggest.first_news?.title ?? ''}`.slice(0, 60) : undefined,
        },
      ]
    }
    if (tab === 'stories' && storiesQuery.data) {
      const stories = storiesQuery.data.stories
      const clusterCount = stories.reduce((s, st) => s + st.clusters.length, 0)
      const newsCount = stories.reduce((s, st) => s + st.clusters.reduce((x, c) => x + c.size, 0), 0)
      return [
        { label: 'Сюжетов', value: String(stories.length) },
        { label: 'Каскадов в сюжетах', value: String(clusterCount) },
        { label: 'Новостей в сюжетах', value: String(newsCount) },
      ]
    }
    if (tab === 'graph' && graphQuery.data) {
      const nodes = graphQuery.data.cascades.reduce((s, c) => s + c.items.length, 0)
      return [
        { label: 'Каскадов на графе', value: String(graphQuery.data.cascades.length) },
        { label: 'Сюжетов', value: String(graphQuery.data.stories.length) },
        { label: 'Новостей-узлов', value: String(nodes) },
        { label: 'Точек фона (вся лента)', value: String(graphQuery.data.feed.length) },
      ]
    }
    if (tab === 'research' && researchQuery.data) {
      const lag = researchQuery.data.speed.median_second_lag_min
      return [
        { label: 'Каскадов окна', value: String(researchQuery.data.clusters_total) },
        { label: 'Источников', value: String(researchQuery.data.sources.length) },
        {
          label: 'Медиана первого дубля',
          value: lag !== null ? `${Math.round(lag)} мин` : '—',
        },
      ]
    }
    return []
  }, [tab, cascadesQuery.data, storiesQuery.data, graphQuery.data, researchQuery.data])

  // Deep link ?cluster=<id>: доскролл до детальной панели после открытия
  const detailAnchorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!cluster) return
    const t = setTimeout(() => {
      detailAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => clearTimeout(t)
  }, [cluster])

  const isLoading =
    (tab === 'cascades' && cascadesQuery.isLoading) ||
    (tab === 'stories' && storiesQuery.isLoading) ||
    (tab === 'graph' && graphQuery.isLoading) ||
    (tab === 'research' && researchQuery.isLoading)
  const isError =
    (tab === 'cascades' && cascadesQuery.isError) ||
    (tab === 'stories' && storiesQuery.isError) ||
    (tab === 'graph' && graphQuery.isError) ||
    (tab === 'research' && researchQuery.isError)

  return (
    <div className="min-h-screen px-4 md:px-6 pt-24 pb-16 max-w-[1200px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Каскады</h1>
        <p className="text-sm text-text-muted">
          Перепечатки одного факта разными источниками: кто первый, как быстро распространяется
          новость и как на неё реагирует цена.
        </p>
      </header>

      {/* Stat-карточки — по данным текущей вкладки */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3.5">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">{card.label}</div>
              <div className="text-xl font-semibold text-text-primary">{card.value}</div>
              {card.hint && <div className="text-[10px] text-text-muted mt-1 truncate">{card.hint}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Вкладки + переключатель окна */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Вкладки страницы Каскады">
          {(Object.keys(TAB_LABELS) as CascadesTab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => switchTab(t)}
              className={`px-4 py-2 rounded-xl text-sm transition-colors ${
                tab === t
                  ? 'bg-white/[0.07] text-text-primary font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
        {tab !== 'stories' && tab !== 'method' && (
          <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
            {windowsForTab(tab).map((w) => (
              <button
                key={w}
                onClick={() => switchWindow(w)}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  window === w
                    ? 'bg-white/[0.08] text-text-primary font-medium'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {WINDOW_LABELS[w]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Содержимое вкладок ─────────────────────────────────────────── */}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-accent-primary" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-6 py-10 text-center">
          <p className="text-sm text-text-secondary mb-4">Не удалось загрузить данные. Попробуйте ещё раз.</p>
          <button
            onClick={() => {
              const active = { cascades: cascadesQuery, stories: storiesQuery, graph: graphQuery, research: researchQuery }[tab]
              active?.refetch()
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary text-[#060606] hover:opacity-90 transition-opacity"
          >
            Повторить
          </button>
        </div>
      )}

      {/* Вкладка «Каскады» */}
      {!isLoading && !isError && tab === 'cascades' && (
        cascadesQuery.data && cascadesQuery.data.cascades.length === 0 ? (
          <p className="text-sm text-text-muted py-10 text-center">За выбранный период каскадов нет</p>
        ) : (
          <CascadesTable
            cascades={cascadesQuery.data?.cascades ?? []}
            selectedClusterId={cluster}
            onSelect={(id) => openCluster(id)}
          />
        )
      )}

      {/* Вкладка «Сюжеты» */}
      {!isLoading && !isError && tab === 'stories' && (
        storiesQuery.data && storiesQuery.data.stories.length === 0 ? (
          <p className="text-sm text-text-muted py-10 text-center">Сюжетов пока нет</p>
        ) : (
          <StoriesTable
            stories={storiesQuery.data?.stories ?? []}
            onSelect={(clusterId) => openCluster(clusterId, 'cascades')}
          />
        )
      )}

      {/* Вкладка «Граф» — ленивая инициализация: монтируется с первого открытия */}
      {!isLoading && !isError && tab === 'graph' && (
        graphQuery.data && graphQuery.data.cascades.length === 0 ? (
          <p className="text-sm text-text-muted py-10 text-center">За выбранный период каскадов нет</p>
        ) : graphQuery.data ? (
          <CascadeGraph
            key={window}
            data={graphQuery.data}
            onNodeClick={(clusterId) => openCluster(clusterId)}
          />
        ) : null
      )}

      {/* Вкладка «Ресерч: кто первый» */}
      {!isLoading && !isError && tab === 'research' && (
        researchQuery.data && researchQuery.data.clusters_total === 0 ? (
          <p className="text-sm text-text-muted py-10 text-center">За выбранный период каскадов нет</p>
        ) : researchQuery.data ? (
          <ResearchTab data={researchQuery.data} />
        ) : null
      )}

      {/* Вкладка «Методология» — статический документ (src/docs/methodology.tsx) */}
      {!isLoading && !isError && tab === 'method' && <MethodologyDoc />}

      {/* Деталь-панель каскада — под таблицей/графом, раскрытие строкой или ?cluster=<id> */}
      {cluster && (
        <div ref={detailAnchorRef}>
          <CascadeDetailPanel clusterId={cluster} onClose={closeCluster} />
        </div>
      )}
    </div>
  )
}
