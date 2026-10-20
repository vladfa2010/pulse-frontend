# Каскады и сюжеты — фронтенд

Страница `/cascades` (глубокая ссылка `/cascades?cluster=<id>` открывает панель каскада) + разъезд панели в лентах (ТЗ-101, см. `news-card.md`). Данные — публичные эндпоинты `/api/market/*` (бэкенд: `pulse-backend/docs/cascades.md`). Актуально на HEAD после ТЗ-186.

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
| `useVirality(enabled)` | `GET /market/virality` | 15 мин | ночной LLM-разбор топ-20 (ТЗ-185): `scopes {cascades_24h?, stories_7d?, topics?}` — `top_topics/triggers/ignition/tempo/summary` |
| `useSourceStats(enabled)` | `GET /market/source-stats?days=30` | 15 мин | ночные срезы «кто первый» (ТЗ-186): `sources[]` с `points/latest/week_ago` |

Ключевые типы:
- `Cascade` — `cluster_id, size, life_min, max_sim, verdict, tags[], source, story_id, first_news{title,source,url,published_at}, sources[] (с повторами — схлопываем при отрисовке), first_published_at, last_seen_at`.
- `NewsMarker` — `id, published_at, title, source, url` (id/url — ТЗ-99; `url == null` → строка списка без ссылки).
- `CascadeChartResponse` — `cluster_id, published_at, instruments: InstrumentChart[], news_markers: NewsMarker[]`; поля многодневного покрытия `dates / covered_until / truncated` живут в `InstrumentChart` (ТЗ-97 v3).

## Параметры URL — `src/lib/cascadeParams.ts`

`?tab=cascades|stories|topics|analytics|graph|research|dynamics|method&window=24h|7d|30d` (+ `cluster=<id>` — панель). `parseCascadesParams / buildCascadesParams` — сериализация; `defaultWindowForTab` (у graph/research минимум 7d), `isWindowValidForTab`. Все ссылки шерабельны, back/forward работает.

Порядок вкладок — чистая функция `cascadesTabs(enabled)` (тесты): Каскады → Сюжеты → **Темы** (условно) → **Аналитика** (ТЗ-185, всегда, между «Темы» и «Граф») → Граф → Ресерч → **Динамика** (ТЗ-186, всегда, строго между «Ресерч» и «Методология») → Методология.

**Вкладка «Темы» (ТЗ-115)** — только при `VITE_TOPICS_ENABLED=true` (VPS-сборка; на Render флага нет → вкладки нет, `?tab=topics` откатывается на `cascades`). Состав массива — чистая функция `cascadesTabs(enabled)` (тесты), флаг — `isTopicsEnabled` (паттерн `isCascadeExpandEnabled`). Селектор окна на вкладке скрыт (окно тем — серверное env). Компонент `TopicsTab`: стат-блоки (тем / новостей / окно / шум), янтарный дисклеймер «тема — фон, не лента событий», сетка карточек (SVG-спарклайн по `daily`, бейдж тренда, день последнего события по `last_event_at`), детальная панель (новости, «Каскады в теме» со ссылками на вкладку «Каскады» через `openCluster`, «Сюжеты в теме» — списком без ссылок). Сортировка сетки (переключатель, ТЗ-184 v2/v3/v4): «по размеру» (порядок бэкенда) / «по тренду» (порядок трендов growing > stable > fading) / **«по событию» — дефолт с v4** (`last_event_at` DESC, null вниз). Данные: `useTopics` / `useTopic` (`cascadesApi.ts`, staleTime 15 мин — зеркало серверного TTL); 404 `topics_disabled` → пустое состояние «Темы формируются».

**Вкладка «Аналитика» (ТЗ-185, `AnalyticsTab`)** — всегда (без флагов), между «Темы» и «Граф». Ночной LLM-разбор топ-20 по числу перепечаток (каскады 24ч / сюжеты 7д / темы): три секции-карточки по скоупам — топ тем (3–5 пунктов с takeaway), триггеры-чипсы, первоисточники, темпо, итог курсивом. Дисклеймер смещения выборки. Ручного обновления нет — отчёт живёт до ночного прогона 05:30 МСК. null-скоуп — «Первый отчёт появится после ночного прогона»; на сборке без `VITE_TOPICS_ENABLED` темы отвечают «недоступно на этой сборке». Данные: `useVirality` (staleTime 15 мин).

**Вкладка «Динамика» (ТЗ-186, `SourceDynamicsTab`)** — всегда, строго между «Ресерч» и «Методология». Динамика эффективности источников по ночным срезам (прогон 05:40 МСК): дисклеймер скользящего окна 7 дней; SVG-график топ-10 источников по доле последнего среза (полилинии по срезам, 10 хардкод-цветов; echarts не подключаем); таблица дельт (все источники с `first_count ≥ 2` в последнем срезе: доля сейчас / 7 дней назад / Δ п.п. цветом / первым / лаг, сортировка кликом по образцу `CascadesTable`). Срезов < 7 или `sources` пуст — «Накапливаю историю…». Окна страницы 24ч/7д/30д к вкладке неприменимы (у срезов своё окно 7 дней, days=30 захардкожен в хуке). Данные: `useSourceStats`.

## Компоненты (`src/components/cascades/`)

- `CascadesPage` (обёртка страницы, вкладки из `CASCADE_TABS`, окно, панель по `?cluster=`).
- `CascadesTable` — таблица каскадов окна (заголовок первой новости, размер, жизнь, источники-схлоп, теги, сюжет, колонка «Обновлён» по `last_seen_at` — ТЗ-184). Дефолт сортировки — «Обновлён ↓» (от свежего, ТЗ-184 v4); сервер отдаёт до 500 каскадов, сортировка клиентская по клику на колонки.
- `StoriesTable` — сюжеты: заголовок, сводка, кластеры-чипы, колонка «Обновлён» (`last_seen_at`, ТЗ-184 v2); дефолт — «Обновлён ↓» (ТЗ-184 v4).
- `CascadeDetailPanel` — деталь каскада: шапка (факт первой новости + мета «N новостей · M источников · жизнь · диапазон цены (%)» — диапазон считается на клиенте по маркерам), переключатель инструментов (до 3 тегов с инструментом), `CascadeChart`, легенда маркеров, **список новостей**: строки `.ditem` (ссылки на оригиналы в новой вкладке, «первоисточник» / «+N мин», drop-in stagger 70 мс). Состояние «нет инструментов» и ошибка `market_unavailable` — штатные.
- `CascadeChart` — свечи (переиспользует форму графика новости) + маркеры; чистые функции в том же файле:
  - `buildMarkerPoints(instrument, markers)` — привязка маркеров к свечам, `inSession`, `clipped` (только при `truncated`, ТЗ-97 §4.3); `MarkerPoint { index, price, inSession, clipped }`.
  - `groupMarkersByCandle(points)` — несколько новостей на одной свече → `MarkerGroup` (первая акцентная, дубли меньше).
  - `buildScatterDataItems(...)` — точки для scatter-серии ECharts.
- `CascadeGraph` — force-граф (клиентская визуализация: каскады-узлы, сюжеты-контуры, фон «звёздное поле» из `feed`).
- `ResearchTab` — «кто первый»: доли источников, медианные лаги, скорость каскадов (dup ≤10 мин / ≤60 мин). ТЗ-186: колонка «Тренд 30д» — SVG-спарклайн доли по ночным срезам `/source-stats` + стрелка тренда (▲/▼/●, порог ±0.5 п.п. за 7 дней); запрос fire-and-forget — при ошибке или пустых данных колонка скрывается.
- `AnalyticsTab` — вкладка «Аналитика» (ТЗ-185), см. выше.
- `SourceDynamicsTab` — вкладка «Динамика» (ТЗ-186), см. выше.
- `CascadeExpandContainer` — разъезд панели в лентах (ТЗ-101), см. `news-card.md`.

## Форматтеры — `src/lib/cascadeFormat.ts`

`formatMskDateTime, formatMskDate, formatMskPeriod, formatLifeMin, formatLagMin, collapseSources, formatShare` — всё в одном месте, используются таблицами и панелью.

## Откуда что берётся (карта данных)

```
RSS/источники (бэкенд ingest)
  → news (title_ru, embedding, cluster_id…)            [ТЗ-91/92: эмбеддинги + реалтайм-кластеризация]
  → clusters / cluster_items / stories                 [бэкенд, см. pulse-backend/docs/cascades.md]
  → /api/market/cascades | stories | cascade-chart | cascade-graph | cascade-research
     | virality (ТЗ-185) | source-stats (ТЗ-186)
  → cascadesApi.ts (хуки, staleTime = серверный TTL)
  → страница /cascades | разъезд панели в лентах (ТЗ-101)
```

Каскадные поля в списочных лентах (`/api/news*` — `cluster_size`, `cluster_position`, `cluster_growing`, `cluster_pending` и т.д., ТЗ-99) — отдельный путь: они едут вместе с новостью и рисуют стопку/чип на карточке (`news-card.md`).
