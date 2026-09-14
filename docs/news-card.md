# Карточка новости (NewsCard)

`src/components/NewsCard.tsx` — единая карточка новости во всех лентах приложения. Обёртка каскада — `src/components/CascadeStackCard.tsx` (ТЗ-100), разъезд панели каскада — контекст `src/components/CascadeExpandProvider.tsx` + `src/components/cascades/CascadeExpandContainer.tsx` (ТЗ-101). Актуально на HEAD после ТЗ-101 (14.09.2026).

## Где монтируется

| Точка | Файл | Вариант | showChart | Примечание |
|---|---|---|---|---|
| Карусель 1 «Это вы ещё не видели» | `src/components/UnreadNewsCarousel.tsx` | `landscape` | нет | авто-read по видимости 80% × 2 с |
| Карусель 2 «Вся лента» (история) | `src/components/AllNewsCarousel.tsx` | `portrait` | да | бесконечный скролл |
| Карусель 3 «Общая лента» | `src/components/GlobalNewsCarousel.tsx` | `portrait` | нет | бесконечный скролл |
| Лента `/news` (она же поиск) | `src/pages/NewsFeed.tsx` | `portrait` | да | локальный стейт, `data-newsfeed-card` |
| Гостевая демо-лента | `src/components/home/DemoFeedCarousel.tsx` | `portrait` | да | без CascadeStackCard — прямой `div` + NewsCard |

В брокерском портфеле (`src/components/portfolio/*`) NewsCard **не используется** — это осознанная граница охвата.

## Пропсы NewsCard

```ts
interface NewsCardProps {
  article: NewsArticle          // src/types/news.ts
  index?: number                // stagger-задержка появления (0.06 с × index)
  tagLabel?: string             // текст тега, если нет tagsMap
  tagsMap?: Map<string, string> // tag_id → tag_name (подпись тега)
  variant?: 'portrait' | 'landscape'  // default 'portrait'
  ambientStyle?: AmbientStyle   // фон первой карусели (useAmbientStyles)
  showChart?: boolean           // TZ-3.2: price-reaction chart, default false
  onCascadeClick?: (clusterId: string) => void  // чип каскада; fallback — контекст
}
```

Каскадные поля статьи (`src/types/news.ts`, приходят со списочных эндпоинтов `/api/news*` с ТЗ-99):

```ts
cluster_id?: string | null
cluster_size?: number | null        // N в «k из N»
cluster_position?: number | null    // k: 1 = первоисточник
cluster_last_seen_at?: string | null
cluster_growing?: boolean | null    // пульс-точка в чипе
cluster_pending?: boolean | null    // «···» первые 15 минут
```

## Структура карточки (обе ветки)

Портрет (default) и landscape — один компонент, разные JSX-ветки.

1. **Верхняя строка**: тег (cyan, uppercase, truncate 200px) + sentiment-бейдж (только `sentiment_source: 'llm' | 'llm-partial'` — keyword-фолбэк и ошибки не показываем) или pending-чип «···».
2. Разделитель.
3. **Заголовок**: `title_ru || title_original`, line-clamp-3, min-height 54px.
4. **График реакции цены** (если `showChart` и есть инструменты): переключатель инструментов (при >1), `NewsReactionChart`, подпись «тикер · биржа · время биржи» (+ «вне сессии — показан ближайший день» при `shifted`).
5. **Tag Impact pills**: цветные по знаку score (`#34D399`/`#EF4444`/`#9CA3AF`), portrait — до 3 + «+N», landscape — до 2.
6. **Нижняя мета-строка**: `источник · время` (`<60 мин` → «N мин», `<24 ч` → «N ч», иначе «N д»), **чип каскада в одну линию с источником** (см. ниже), бейдж «+N» при `source_count > 1`.
7. Подсветка снизу при ненейтральном sentiment; `FactCheckIcon` поверх.

## Каскадная стопка (ТЗ-100)

Слои под карточкой рисует обёртка `CascadeStackCard` (внутри того же `data-flip-id` — FLIP не трогаем). Логика — чистые функции `src/lib/cascadeStack.ts`:

- `getStackLayout(article, variant, now, hasCascadeClick)` → `{ isOrigin, showLayers, layersCount, showPending, wrapperClick: 'cascade' | 'card' }`.
- `getLayerGeom(l)` → `{ height: 14 + 3l, inset: 5l, opacity: max(.25, 1 − .1l), hoverShift, hoverRotate }`.
- `getStackMarginBottom(n)` → `n * 3 + 2 | undefined`.
- Константы: `MAX_STACK_LAYERS = 6`, `PENDING_WINDOW_MS = 15 мин`.

Правила:
- **Слои** — только у первоисточника (`cluster_position === 1`), только portrait, до 6 штук. Хвост ×7 визуально толще ×4 (opacity-градация).
- **Чип «каскад · k из N»** — у любой новости с кластером; иконка слоёми, у растущего каскада (`cluster_growing`) — пульс-точка. Расположение — **в нижней мета-строке рядом с источником** (портрет: после «источник · время»; landscape: рядом с источником справа). Клик со `stopPropagation`.
- **Pending-чип «···»** — серый, мигание точек, только при `cluster_pending` и `cluster_last_seen_at` моложе 15 мин; стоит в верхней строке вместо sentiment-бейджа.
- **Границы первоисточника**: `rgba(0,212,255,.30)`, hover → `.55` (вместо sentiment-границы).
- **Клик-архитектура**: у первоисточника клик по карточке = каскад (`wrapperClick: 'cascade'`, NewsDetailModal не открывается), у поздней новости — обычный `onCardClick`, чип ловит свой клик отдельно.

## Разъезд панели каскада (ТЗ-101)

Вместо перехода на `/cascades` панель разворачивается под каруселью/сеткой:

- `src/lib/cascadeExpand.ts` — чистая логика: `isCascadeExpandEnabled(flag)` (unset/true → разъезд, `'false'` → interim-navigate `/cascades?cluster=<id>`) и `nextExpandedCluster(current, clicked)` (клик по открытой сворачивает, по другой — переключает; открыт максимум один).
- `CascadeExpandProvider` — контекст `{ expandEnabled, expandedClusterId, retainedClusterId, handleCascadeClick, close, onContainerTransitionEnd }`. Стоит в `NewsCarousel` (получают все карусели, включая демо-ленту) и в `NewsFeed`. При флаге `false` `handleCascadeClick` делает navigate — контейнер не монтируется (инвариант: двух активных путей нет).
- `CascadeExpandContainer` — `grid-template-rows: 0fr → 1fr`, `.5s cubic-bezier(.22,1,.36,1)`; рендерит тот же `CascadeDetailPanel` (ТЗ-93). Панель монтируется по клику → `useCascadeChart` стреляет сам (`enabled: Boolean(clusterId)`, staleTime 15 мин). После сворачивания панель удерживается (`retainedClusterId`) до конца transition — закрытие анимируется.
- Открытая стопка получает класс `cascade-stack-host--open` — слои улетают вниз (`translateY(70px)`, opacity 0, .5с).
- Обработчик каскада: проп `onCascadeClick`, fallback — `useCascadeExpand()` (используется в `CascadeStackCard` и чипе NewsCard; карусели проп не передают).

**Фиче-флаг:** `VITE_CASCADE_EXPAND` (`.env.example`). unset/true → разъезд; `false` → навигация ТЗ-100. Откат — поставить `false`.

## График новости

- Запрос: `GET /api/market/news-chart?news_id=<id>`, react-query ключ `['newsChart', article.id]`.
- Лениво: только когда карточка попала во вьюпорт (`IntersectionObserver`, rootMargin 200px) и `showChart`.
- `NEWS_CHART_STALE_TIME` — единый staleTime (`src/lib/newsChart.ts`), используется и префетчером `useNewsChartPrefetch` (ТЗ-3.5) — при свайпе график рендерится из кэша мгновенно.

## Прочее

- **Sentiment**: цвет/иконка из `sentimentConfig`, glass-фон карточки; бейдж — только LLM-источник.
- **FactCheckIcon**: иконка фактчекинга поверх карточки (`src/components/NewsCard.tsx:85`).
- **AmbientBackground**: фон карточек первой карусели из `useAmbientStyles`.
- **CSS** (всё в `src/index.css`): блок «ТЗ-100» — `.cascade-stack-layer` (появление `cascadeStackAppear`, hover-веер через `--cascade-ty`/`--cascade-rot`, backdrop-filter только ≥640px), `.cascade-chip` + `.cascade-chip__pulse`, `.cascade-pending-chip` + `cascadePendBlink`; блок «ТЗ-101» — `.cascade-expand`/`--open`/`__inner`, `.cascade-stack-host--open` (улёт слоёв), `.ditem` + `cascadeDitemIn` (drop-in списка панели, stagger 70 мс, кап 20 строк).

## Тесты

Чистая логика (jsdom-сетапа в проекте нет — компоненты не рендерим):

- `src/lib/__tests__/cascadeStack.test.ts` (17) — стопка: число слоёв, origin-only, portrait-only, pending-окно 15 мин, клик-логика, геометрия слоёв.
- `src/lib/__tests__/cascadeExpand.test.ts` (9) — полярность флага, открытие/сворачивание/переключение.
- `src/components/cascades/__tests__/cascadeChart.test.ts` (6) — `buildMarkerPoints` (ТЗ-97 §4.3: клиппинг только при `truncated`).
