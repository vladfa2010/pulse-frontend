# Каскады и сюжеты — фронтенд

Страница `/cascades` (глубокая ссылка `/cascades?cluster=<id>` открывает панель каскада) + разъезд панели в лентах (ТЗ-101, см. `news-card.md`). Данные — публичные эндпоинты `/api/market/*` (бэкенд: `pulse-backend/docs/cascades.md`). Актуально на HEAD после ТЗ-101.

## Общий принцип

Одна форма каскада — переиспользуемый `CascadeDetailPanel` (ТЗ-93) в четырёх обёртках: разъезд под каруселью, разъезд под лентой `/news`, страница `/cascades`, будущие формы. Новых форм не плодим.

## API-слой — `src/lib/cascadesApi.ts`

Хуки react-query; серверный TTL совпадает со staleTime — лишних запросов нет.

| Хук | Эндпоинт | staleTime | Что отдаёт |
|---|---|---|---|
| `useCascades(window, enabled)` | `GET /market/cascades?window=24h\|7d\|30d` | 60 с | `CascadesResponse { window, cascades: Cascade[] }` |
| `useStories(enabled)` | `GET /market/stories` | 15 мин | `StoriesResponse { stories: Story[] }` |
| `useCascadeChart(clusterId)` | `GET /market/cascade-chart?cluster_id=…` | 15 мин | свечи инструментов + `news_markers` |
| `useCascadeGraph(window, enabled)` | `GET /market/cascade-graph?window=7d\|30d` | 15 мин | force-граф: каскады + сюжеты + фон `feed` |
| `useCascadeResearch(window, enabled)` | `GET /market/cascade-research?window=7d\|30d` | 15 мин | статистика «кто первый» |

Ключевые типы:
- `Cascade` — `cluster_id, size, life_min, max_sim, verdict, tags[], source, story_id, first_news{title,source,url,published_at}, sources[] (с повторами — схлопываем при отрисовке), first_published_at, last_seen_at`.
- `NewsMarker` — `id, published_at, title, source, url` (id/url — ТЗ-99; `url == null` → строка списка без ссылки).
- `CascadeChartResponse` — `cluster_id, published_at, instruments: InstrumentChart[], news_markers: NewsMarker[]`; поля многодневного покрытия `dates / covered_until / truncated` живут в `InstrumentChart` (ТЗ-97 v3).

## Параметры URL — `src/lib/cascadeParams.ts`

`?tab=cascades|stories|topics|graph|research|method&window=24h|7d|30d` (+ `cluster=<id>` — панель). `parseCascadesParams / buildCascadesParams` — сериализация; `defaultWindowForTab` (у graph/research минимум 7d), `isWindowValidForTab`. Все ссылки шерабельны, back/forward работает.

**Вкладка «Темы» (ТЗ-115)** — только при `VITE_TOPICS_ENABLED=true` (VPS-сборка; на Render флага нет → вкладки нет, `?tab=topics` откатывается на `cascades`). Состав массива — чистая функция `cascadesTabs(enabled)` (тесты), флаг — `isTopicsEnabled` (паттерн `isCascadeExpandEnabled`). Порядок: Каскады → Сюжеты → **Темы** → Граф → Ресерч → Методология. Селектор окна на вкладке скрыт (окно тем — серверное env). Компонент `TopicsTab`: стат-блоки (тем / новостей / окно / шум), янтарный дисклеймер «тема — фон, не лента событий», сетка карточек (SVG-спарклайн по `daily`, бейдж тренда), детальная панель (новости, «Каскады в теме» со ссылками на вкладку «Каскады» через `openCluster`, «Сюжеты в теме» — списком без ссылок). Данные: `useTopics` / `useTopic` (`cascadesApi.ts`, staleTime 15 мин — зеркало серверного TTL); 404 `topics_disabled` → пустое состояние «Темы формируются».

## Компоненты (`src/components/cascades/`)

- `CascadesPage` (обёртка страницы, вкладки из `CASCADE_TABS`, окно, панель по `?cluster=`).
- `CascadesTable` — таблица каскадов окна (заголовок первой новости, размер, жизнь, источники-схлоп, теги, сюжет).
- `StoriesTable` — сюжеты: заголовок, сводка, кластеры-чипы.
- `CascadeDetailPanel` — деталь каскада: шапка (факт первой новости + мета «N новостей · M источников · жизнь · диапазон цены (%)» — диапазон считается на клиенте по маркерам), переключатель инструментов (до 3 тегов с инструментом), `CascadeChart`, легенда маркеров, **список новостей**: строки `.ditem` (ссылки на оригиналы в новой вкладке, «первоисточник» / «+N мин», drop-in stagger 70 мс). Состояние «нет инструментов» и ошибка `market_unavailable` — штатные.
- `CascadeChart` — свечи (переиспользует форму графика новости) + маркеры; чистые функции в том же файле:
  - `buildMarkerPoints(instrument, markers)` — привязка маркеров к свечам, `inSession`, `clipped` (только при `truncated`, ТЗ-97 §4.3); `MarkerPoint { index, price, inSession, clipped }`.
  - `groupMarkersByCandle(points)` — несколько новостей на одной свече → `MarkerGroup` (первая акцентная, дубли меньше).
  - `buildScatterDataItems(...)` — точки для scatter-серии ECharts.
- `CascadeGraph` — force-граф (клиентская визуализация: каскады-узлы, сюжеты-контуры, фон «звёздное поле» из `feed`).
- `ResearchTab` — «кто первый»: доли источников, медианные лаги, скорость каскадов (dup ≤10 мин / ≤60 мин).
- `CascadeExpandContainer` — разъезд панели в лентах (ТЗ-101), см. `news-card.md`.

## Форматтеры — `src/lib/cascadeFormat.ts`

`formatMskDateTime, formatMskDate, formatMskPeriod, formatLifeMin, formatLagMin, collapseSources, formatShare` — всё в одном месте, используются таблицами и панелью.

## Откуда что берётся (карта данных)

```
RSS/источники (бэкенд ingest)
  → news (title_ru, embedding, cluster_id…)            [ТЗ-91/92: эмбеддинги + реалтайм-кластеризация]
  → clusters / cluster_items / stories                 [бэкенд, см. pulse-backend/docs/cascades.md]
  → /api/market/cascades | stories | cascade-chart | cascade-graph | cascade-research
  → cascadesApi.ts (хуки, staleTime = серверный TTL)
  → страница /cascades | разъезд панели в лентах (ТЗ-101)
```

Каскадные поля в списочных лентах (`/api/news*` — `cluster_size`, `cluster_position`, `cluster_growing`, `cluster_pending` и т.д., ТЗ-99) — отдельный путь: они едут вместе с новостью и рисуют стопку/чип на карточке (`news-card.md`).
