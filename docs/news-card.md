# Карточка новости (NewsCard)

`src/components/NewsCard.tsx` — единая карточка новости во всех лентах приложения. Обёртка каскада — `src/components/CascadeStackCard.tsx` (ТЗ-100), разъезд панели каскада — контекст `src/components/CascadeExpandProvider.tsx` + `src/components/cascades/CascadeExpandContainer.tsx` (ТЗ-101). Чистая логика стопки — `src/lib/cascadeStack.ts`. Актуально на HEAD после ТЗ-105 (15.09.2026).

## Где монтируется

| Точка | Файл | Вариант | showChart | Примечание |
|---|---|---|---|---|
| Карусель 1 «Это вы ещё не видели» | `src/components/UnreadNewsCarousel.tsx` | `landscape` | нет | авто-read по видимости 80% × 2 с, оптимистичное исчезновение через 60 с |
| Карусель 2 «Вся лента» (история) | `src/components/AllNewsCarousel.tsx` | `portrait` | да | бесконечный скролл, FLIP, префетч графиков |
| Карусель 3 «Общая лента» | `src/components/GlobalNewsCarousel.tsx` | `portrait` | нет | бесконечный скролл, FLIP |
| Лента `/news` (она же поиск) | `src/pages/NewsFeed.tsx` | `portrait` | да | локальный стейт, `data-newsfeed-card` |
| Гостевая демо-лента | `src/components/home/DemoFeedCarousel.tsx` | `portrait` | да | `CascadeStackCard` + прямой `onCascadeClick` → `/cascades?cluster=<id>` (ТЗ-103, у гостя нет разъезда) |

Во всех пяти точках карточка стоит в `CascadeStackCard` (у гостя демо-ленты — с пропом `onCascadeClick` вместо контекста). Детали по каруселям — `docs/carousels.md`. В брокерском портфеле (`src/components/portfolio/*`) NewsCard **не используется** — это осознанная граница охвата.

## Высота карточки и тёмный слот (ТЗ-111)

- Высота карточки — естественная, по контенту (график / без графика), карточки одного ряда разной высоты — фича, а не баг. **ТЗ-110 (единая высота ряда, коммит `4656f05`) отменено** — откат новым коммитом, история в git сохранена.
- Под короткой карточкой вместо голого чёрного поля страницы — **адаптивный тёмный слот**: фон хоста `.cascade-stack-host` (`background: rgba(255,255,255,.02)`, рамка `rgba(255,255,255,.05)`, radius 12px). Хост растягивается рядом (flex/grid `stretch`), поэтому слот аккуратно заполняет всё место до низа ряда. В нерастянутых контекстах фон закрыт карточкой и не виден.
- Порядок отрисовки: `::before`-подложка-свечение ТЗ-108 (z −2) → фон слота → слои стопки (z −1 внутри обёртки z1, ТЗ-109) → карточка (z 1). Хвост прилежит к низу своей карточки и рисуется поверх фона слота; свечение обнимает карточку со слотом как единый объект — свечения «в пустоте» нет, потому что пустоты нет.

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

Каскадные поля статьи (`src/types/news.ts`, приходят со списочных эндпоинтов `/api/news*` с ТЗ-99, типы гарантирует каст `::int` ТЗ-104):

```ts
cluster_id?: string | null
cluster_size?: number | null        // N в «k из N» и толщина стопки
cluster_position?: number | null    // k: 1 = первоисточник (всегда number, не string!)
cluster_last_seen_at?: string | null
cluster_growing?: boolean | null    // пульс-точка в чипе
cluster_pending?: boolean | null    // «···» первые 15 минут
```

## Кодировка каскада (визуальный язык)

Каскад новостей кодируется набором независимых сигналов — каждый отвечает за своё:

| Сигнал | Где | Что означает |
|---|---|---|
| **Стопка слоёв** под карточкой | `CascadeStackCard`, только portrait | Новость входит в каскад размера > 1. **Толщина хвоста = `cluster_size`** (решение владельца 15.09, ТЗ-105) — стопка есть у КАЖДОЙ карточки каскада, не только у первоисточника. Позиция новости в каскаде стопкой НЕ кодируется |
| **Чип «каскад · k из N»** | нижняя мета-строка, в одну линию с источником | Позиция `k` и размер `N`. Иконка «слои»; клик → каскад (stopPropagation) |
| **Пульс-точка** в чипе вместо иконки | тот же чип | Каскад растёт прямо сейчас (`cluster_growing = true`, кластеру < 36 ч от последней новости) — мигающая cyan-точка с расходящимся кольцом |
| **Серый чип «···»** | верхняя строка карточки (вместо sentiment-бейджа) | Новость ещё не кластеризована (`cluster_pending`) и моложе 15 минут — бэкенд ещё решает, одиночная она или часть каскада. Точки мигают каскадом (`cascadePendBlink`), по истечении окна чип сам исчезает |
| **Cyan-рамка .30 (hover .55) + свечение** | граница и тень карточки | «Это карточка каскада» — у всех карт каскада size > 1 (ТЗ-105, раньше — только первоисточник). Одиночные новости — с сантиментными границами |
| **Белая обводка точки на графике каскада** | `cascadeChart` (ТЗ-106) | Первоисточник (1.5px против 0.5px у остальных). Размер точек у всех одинаковый — 12px, порядок не кодируется |

Смысловое разделение: **стопка = размер**, **чип = позиция и размер текстом**, **пульс = растёт**, **«···» = не определено**, **рамка = принадлежность к каскаду**, **обводка на графике = первоисточник**.

## Структура карточки (обе ветки)

Портрет (default, 275px) и landscape (425px, только карусель 1) — один компонент, разные JSX-ветки.

1. **Верхняя строка**: тег (cyan `#00D4FF`, uppercase, truncate 200px) + sentiment-бейдж (только `sentiment_source: 'llm' | 'llm-partial'` — keyword-фолбэк и ошибки не показываем; бейдж кликабелен — тултип с reasoning и score) **или pending-чип «···»** (приоритет над sentiment-бейджем). В landscape справа ещё время публикации (`timeAgo`).
2. Разделитель.
3. **Заголовок**: `title_ru || title_original`, line-clamp-3, min-height 54px.
4. **График реакции цены** (если `showChart` и есть инструменты): переключатель инструментов (при >1, клик со stopPropagation), `NewsReactionChart`, подпись «тикер · биржа · время биржи» (+ «вне сессии — показан ближайший день» при `shifted`).
5. **Tag Impact pills**: цветные по знаку score (`#34D399`/`#EF4444`/`#9CA3AF`), каждая со цветной точкой и reasoning в title; portrait — до 3 + «+N», landscape — до 2 + «+N».
6. **Нижняя мета-строка**: `источник · время` (`<60 мин` → «N мин», `<24 ч` → «N ч», иначе «N д»), **чип каскада в одну линию с источником** (portrait: после «источник · время»; landscape: рядом с источником справа), бейдж «+N» при `source_count > 1`.
7. Подсветка снизу при ненейтральном sentiment; `FactCheckIcon` поверх.

## Каскадная стопка (ТЗ-100 → ТЗ-103 → ТЗ-105)

Слои под карточкой рисует обёртка `CascadeStackCard` (внутри того же `data-flip-id` — FLIP не трогаем). Логика — чистые функции `src/lib/cascadeStack.ts`:

- `getStackLayout(article, variant, now, hasCascadeClick)` → `{ isOrigin, inCluster, showLayers, layersCount, showPending, wrapperClick: 'cascade' | 'card' }`.
  - `isOrigin` = `cluster_id && cluster_position === 1` — первоисточник.
  - `inCluster` = `cluster_id && cluster_size > 1` — любая карточка каскада (ТЗ-105).
- `getLayerGeom(l)` — 1-based (верхний слой l=1): `{ height: 14 + 4l, inset: 5l, opacity: max(.25, 1 − .1l), hoverShift: min(1 + .4l, 3), hoverRotate: ±.5° }` (шаг 4px — усиление ТЗ-103; верхний слой .9 … шестой .4).
- `getStackMarginBottom(n)` → `n * 4 + 2 | undefined` — компенсация высоты хвоста под карточкой.
- Константы: `MAX_STACK_LAYERS = 6`, `PENDING_WINDOW_MS = 15 мин`.

Правила:

- **Слои** — у КАЖДОЙ карточки каскада (`inCluster`), только portrait, `min(size − 1, 6)` штук (ТЗ-105; до ТЗ-105 — только у первоисточника). У «1 из 3» и «3 из 3» одного каскада хвосты одинаковой толщины. Дубли каскада в одной карусели — intended (хвост кодирует размер, не уникальность карточки).
- **Градация прозрачности** — верхний слой .9, нижний .4. Реализована через CSS-переменную `--cascade-op` (ТЗ-105): финальный кадр keyframes `cascadeStackAppear` — `opacity: var(--cascade-op, 1)`, иначе `animation: both` вечно держал бы opacity: 1 и ступени сливались. Чипы той же анимацией пользуются без переменной — fallback 1.
- **Hover-веер** — при наведении слои разъезжаются вниз на `hoverShift` (1.4–3px) с чередующимся поворотом ±.5° (CSS-переменные `--cascade-ty`/`--cascade-rot` из геометрии).
- **Открытый каскад** — стопка открытой панели получает класс `cascade-stack-host--open`, слои улетают вниз (`translateY(70px)`, opacity 0, .5с) — см. ТЗ-101.
- **Клик по хвосту** — слои с `pointer-events: none`, клик ловит обёртка: у поздней карточки хвост кликабелен как карточка (открывает новость, не каскад) — зафиксировано комментарием в `CascadeStackCard`.
- **Pending** — `showPending = cluster_pending && (now − published_at) < 15 мин` (считается от published_at новости, не от `cluster_last_seen_at`).

## Клик-архитектура (ТЗ-100 §2.4)

- У **первоисточника** (`cluster_position === 1`) клик по карточке = каскад (`wrapperClick: 'cascade'`), NewsDetailModal не открывается. Обработчик: проп `onCascadeClick` у `CascadeStackCard`, fallback — `useCascadeExpand()` (разъезд панели ТЗ-101 в авторизованных каруселях/ленте, у гостя демо-ленты — прямой navigate на `/cascades?cluster=<id>`, ТЗ-103).
- У **поздней новости** каскада — обычный `onCardClick` (открытие новости), даже при наличии хвоста. Чип «k из N» ловит свой клик отдельно со `stopPropagation` → каскад.
- NewsCard собственного onClick не получает — хозяин клика снаружи (карусель/лента).

## Дизайн-акценты каскада

- **Рамка**: карточки каскада — `rgba(0,212,255,.30)`, hover `.55` (вместо sentiment-границы `config.glassBorder`); одиночные — sentiment-границы как раньше.
- **Свечение**: `0 14px 30px -10px rgba(0,212,255,.22)`, hover `.32` (значения мокапа v2, ТЗ-103).
- В landscape каскадная рамка/свечение тоже работают, но слоёв нет (хвост ломает сетку 16:9) — хвост кодирует размер только в portrait.

## Разъезд панели каскада (ТЗ-101)

Вместо перехода на `/cascades` панель разворачивается под каруселью/сеткой:

- `src/lib/cascadeExpand.ts` — чистая логика: `isCascadeExpandEnabled(flag)` (unset/true → разъезд, `'false'` → interim-navigate `/cascades?cluster=<id>`) и `nextExpandedCluster(current, clicked)` (клик по открытой сворачивает, по другой — переключает; открыт максимум один).
- `CascadeExpandProvider` — контекст `{ expandEnabled, expandedClusterId, retainedClusterId, handleCascadeClick, close, onContainerTransitionEnd }`. Стоит в `NewsCarousel` (получают все карусели, включая демо-ленту) и в `NewsFeed`. При флаге `false` `handleCascadeClick` делает navigate — контейнер не монтируется (инвариант: двух активных путей нет).
- `CascadeExpandContainer` — `grid-template-rows: 0fr → 1fr`, `.5s cubic-bezier(.22,1,.36,1)`; рендерит тот же `CascadeDetailPanel` (ТЗ-93). Панель монтируется по клику → `useCascadeChart` стреляет сам (`enabled: Boolean(clusterId)`, staleTime 15 мин). После сворачивания панель удерживается (`retainedClusterId`) до конца transition — закрытие анимируется.
- Открытая стопка получает класс `cascade-stack-host--open` — слои улетают вниз.
- Обработчик каскада: проп `onCascadeClick`, fallback — `useCascadeExpand()` (используется в `CascadeStackCard` и чипе NewsCard; карусели проп не передают — кроме гостевой демо-ленты).

**Фиче-флаг:** `VITE_CASCADE_EXPAND` (`.env.example`). unset/true → разъезд; `false` → навигация ТЗ-100. Откат — поставить `false`.

## График новости

- Запрос: `GET /api/market/news-chart?news_id=<id>`, react-query ключ `['newsChart', article.id]`.
- Лениво: только когда карточка попала во вьюпорт (`IntersectionObserver`, rootMargin 200px) и `showChart`.
- `NEWS_CHART_STALE_TIME` — единый staleTime (`src/lib/newsChart.ts`), используется и префетчером `useNewsChartPrefetch` (ТЗ-3.5) — при свайпе график рендерится из кэша мгновенно (карусель 2).
- График в карточке неинтерактивен (`interactive={false}` в NewsReactionChart, ТЗ-113): без тултипа OHLC, креста и hover, `pointer-events: none` — тап по области графика открывает новость, свайп карусели над графиком не перехватывается. Админский `CandleChart` (`MarketDataTab`) интерактивен по умолчанию (`interactive` опционален, дефолт `true`).

## Прочее

- **Sentiment**: цвет/иконка из `sentimentConfig`, glass-фон карточки; бейдж — только LLM-источник.
- **FactCheckIcon**: иконка фактчекинга поверх карточки.
- **AmbientBackground**: фон карточек первой карусели из `useAmbientStyles` (только landscape-вариант её использует).
- **CSS** (всё в `src/index.css`): блок «ТЗ-100» — `.cascade-stack-layer` (появление `cascadeStackAppear` с `--cascade-op`, hover-веер через `--cascade-ty`/`--cascade-rot`, backdrop-filter только ≥640px), `.cascade-chip` + `.cascade-chip__pulse` (пульс-точка растущего каскада), `.cascade-pending-chip` + `cascadePendBlink` (мигание «···»); блок «ТЗ-101» — `.cascade-expand`/`--open`/`__inner`, `.cascade-stack-host--open` (улёт слоёв), `.ditem` + `cascadeDitemIn` (drop-in списка панели, stagger 70 мс, кап 20 строк).

## Тесты

Чистая логика (jsdom-сетапа в проекте нет — компоненты не рендерим):

- `src/lib/__tests__/cascadeStack.test.ts` — стопка: число слоёв (min(size−1, 6)), хвост у всех карт каскада и его отсутствие у size=1 / в landscape / без кластера, pending-окно 15 мин (от published_at), клик-архитектура (origin → cascade, поздняя → card, без обработчика → card), геометрия слоёв 1-based (шаг 4px), margin-bottom, страж «размер 2 → видимый хвост 4px» (ТЗ-103), блок ТЗ-105 (поздняя карточка, одинаковая толщина, size=1, клики).
- `src/lib/__tests__/cascadeExpand.test.ts` (9) — полярность флага, открытие/сворачивание/переключение.
- `src/components/cascades/__tests__/cascadeChart.test.ts` — `buildMarkerPoints` (ТЗ-97 §4.3: клиппинг только при `truncated`), группировка дублей по свече (ТЗ-97 §6), страж формы scatter-данных (ТЗ-98: `value` = [index, price], `coord` отсутствует), страж ТЗ-106 (все маркеры 12px независимо от порядка).
