# Карусели новостей

Все новостные карусели построены на общей оболочке `src/components/NewsCarousel.tsx`, а карточки всегда стоят в обёртке каскада `src/components/CascadeStackCard.tsx` (подробности по карточке — `docs/news-card.md`). Актуально на HEAD после ТЗ-105 (15.09.2026).

## Оболочка NewsCarousel

Пропсы: `title`, `subtitle?`, `count?` (счётчик в шапке `(N)`), `accentColor?` (default `#00D4FF`), `headerAction?` (слот под кнопку справа в шапке), `hideArrowsOnMobile?`, `children` (трек карточек), `ref` (внешний доступ к скролл-контейнеру — используют FLIP-хуки и префетчер).

Устройство:

- **Трек**: нативный горизонтальный скролл (`overflow-x-auto`, скроллбар скрыт, `-webkit-overflow-scrolling: touch`), карточки через `gap-3`, паддинги `px-6`, контент в `max-w-[1200px]`.
- **Стрелки**: кнопки по 6×6 (ChevronLeft/Right), прокрутка ровно на 450px плавно; disabled-состояние по факту края (`scrollLeft > 10` / `< scrollWidth − clientWidth − 10`), пересчитывается по событию скролла и ResizeObserver (бесконечный скролл меняет ширину контента). `hideArrowsOnMobile` — скрыть на <sm (на таче — свайп).
- **Боковые затемнения**: градиентные фейды слева/справа (только ≥sm), показываются когда в соответствующую сторону можно скроллить.
- **Разъезд каскада (ТЗ-101)**: каждая карусель обёрнута в `CascadeExpandProvider`, контейнер панели `CascadeExpandContainer` стоит ВНЕ трека под ним — FLIP (`data-flip-id`) не конфликтует, контент страницы сдвигается осознанно. Обработчик каскада карусели не передаёт — его даёт контекст.

## Карусель 1 — «Это вы ещё не видели» (UnreadNewsCarousel)

`src/components/UnreadNewsCarousel.tsx`. Только авторизованный (первой после DailySummary).

- **Данные**: `GET /api/news?limit=20` (непрочитанные по тегам пользователя), `useQuery`, `staleTime` 2 мин + `refetchInterval` 2 мин + `useNewsStream` (анимация появления новых карточек).
- **Вариант**: `landscape` (425px, без графика, `showChart: false`), `ambientStyle` из `useAmbientStyles(articles)` — AmbientBackground под карточками.
- **Авто-read**: IntersectionObserver (threshold 0/0.5/0.8/1) — карточка видна на ≥80% → таймер 2 с → `POST /api/news/:id/read`; ушла из зоны — таймер сбрасывается. После отметки — оптимистичное исчезновение через 60 с (fading + removal-таймеры, cleanup на unmount). Клик по карточке тоже помечает прочитанной и открывает `/news/:slug`.
- **Шапка**: `headerAction` — кнопка «Прочитать всё» (массовая отметка со спиннером).
- Каскад: клик первоисточника → разъезд панели (контекст), поздняя карточка → новость, чип → каскад.

## Карусель 2 — «Вся лента» (AllNewsCarousel, история прочтений)

`src/components/AllNewsCarousel.tsx`. Авторизованный.

- **Данные**: `GET /api/news?history=true&limit=50&page=N`, `useInfiniteQuery` — бесконечный скролл (следующая страница при приближении к концу трека, IntersectionObserver-сентинел).
- **Вариант**: `portrait`, `showChart: true` (график реакции цены).
- **FLIP**: `useFlipAnimation(articles, trackRef)` — появление/сдвиг карточек без резких дёрганий (`data-flip-id`).
- **Префетч графиков**: `useNewsChartPrefetch(articles, trackRef, true)` (ТЗ-3.5) — `news-chart` подгружается за кадр до появления карточки, рендер из кэша мгновенный.
- Каскад — через контекст разъезда, как везде.

## Карусель 3 — «Общая лента» (GlobalNewsCarousel)

`src/components/GlobalNewsCarousel.tsx`. Видна всем авторизованным (после GlobalSummary).

- **Данные**: `GET /api/news/global?limit=50&page=N` (все новости базы без фильтра по тегам), `useInfiniteQuery`, бесконечный скролл.
- **Вариант**: `portrait`, `showChart: false`, FLIP (`useFlipAnimation`).
- Каскад — через контекст разъезда.

## Гостевая демо-лента (DemoFeedCarousel)

`src/components/home/DemoFeedCarousel.tsx`. Только гость, на гостевой главной после hero.

- **Данные**: `GET /api/public/demo-feed` (50 демо-новостей, кэш 60 с одним ключом, пагинации нет, `hasMore: false`), `useQuery` staleTime 30 с; `tagsMap` из `GET /api/public/demo-tags`. Ошибка/пусто → блок скрыт.
- **Вариант**: `portrait`, `showChart: true`.
- **Каскад — исключение**: у гостя нет разъезда (нет авторизации, демо-аккаунт). `CascadeStackCard` получает проп `onCascadeClick` → `navigate('/cascades?cluster=<id>')` (deep link, ТЗ-103), обычный клик → публичная `/news/:slug`.
- Каскадные поля (`cluster_*`) отдаёт и этот эндпоинт — гостевая лента выглядит как авторизованная (ТЗ-103 задача 3).

## Лента /news (NewsFeed) — не карусель, но тот же набор

`src/pages/NewsFeed.tsx`: карточки `portrait` + `showChart`, обёртка `CascadeStackCard`, провайдер разъезда стоит на странице (не в NewsCarousel), `data-newsfeed-card` на карточках. Локальный стейт (поиск/фильтры), не react-query-бесконечность.

## Общая механика каскада во всех лентах

1. Бэкенд отдаёт `cluster_*` поля со списочных эндпоинтов (ТЗ-99, каст типов ТЗ-104 — `cluster_position` строго number).
2. `CascadeStackCard` рисует стопку всем картам каскада size>1 (толщина = size, ТЗ-105); NewsCard — чип, pending, рамку/свечение.
3. Клик первоисточника → панель каскада (разъезд ТЗ-101 у авторизованных, deep link у гостя); клик поздней карточки → новость; клик чипа → каскад.
4. Панель одна на провайдер — одновременно развёрнут максимум один каскад; открытие другого переключает, повторный клик по открытому сворачивает.
