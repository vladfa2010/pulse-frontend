# Портфели и облако рекомендуемых тегов

> Frontend-часть фичи «Портфели брокеров».

## Страницы и компоненты

### `/portfolio`

Основная страница портфеля. Расположена в `src/pages/PortfolioPage.tsx`.

- Переключатель режима отображения: **по брокерам** / **консолидированно**.
- Список карточек брокеров (`BrokerCard`) с кнопкой ручной синхронизации и временем последней синхронизации.
- Таблица позиций (`PositionsTable` / `ConsolidatedTable`).
- Сводный итог (`GrandTotalStrip`).
- Облако рекомендуемых тегов (`RecommendedTagsCloud`).

### `/profile` — вкладка «Брокеры»

Расположена в `src/pages/account/BrokersTab.tsx`.

- Список подключённых ключей брокеров.
- Кнопка добавления ключа (`BrokerKeyModal`).
- Привязка портфеля к ключу (`PortfolioFormModal`).
- Тест ключа и удаление.
- Удаление ключа каскадно удаляет привязанный портфель и все его позиции (`DeleteKeyConfirm` показывает предупреждение).

## Компоненты портфеля

| Компонент | Путь | Описание |
|-----------|------|----------|
| `BrokerCard` | `components/portfolio/BrokerCard.tsx` | Карточка брокера с итогами, статусом ключа, временем последней синхронизации и кнопкой ручной синхронизации |
| `BrokerKeyModal` | `components/portfolio/BrokerKeyModal.tsx` | Модалка добавления/редактирования API-ключа |
| `PortfolioFormModal` | `components/portfolio/PortfolioFormModal.tsx` | Модалка создания/редактирования портфеля |
| `PositionsTable` | `components/portfolio/PositionsTable.tsx` | Таблица позиций для одного брокера |
| `ConsolidatedTable` | `components/portfolio/ConsolidatedTable.tsx` | Консолидированная таблица позиций |
| `GrandTotalStrip` | `components/portfolio/GrandTotalStrip.tsx` | Сводный итог по всем портфелям |
| `RecommendedTagsCloud` | `components/portfolio/RecommendedTagsCloud.tsx` | Облако тегов для подписки на новости |
| `DeleteKeyConfirm` | `components/portfolio/DeleteKeyConfirm.tsx` | Предупреждение перед удалением ключа и связанного портфеля |

## UI-примитивы

- `GlassCard` — карточка в стиле Liquid Glass.
- `GlassModal` — модальное окно в стиле Liquid Glass.
- `Toast` / `useToast` — уведомления об успехе/ошибке.

## Хуки

| Хук | Путь | Описание |
|-----|------|----------|
| `usePortfolio` | `hooks/usePortfolio.ts` | Запросы к `/api/portfolio` и мутации |
| `useBrokerKeys` | `hooks/useBrokerKeys.ts` | Запросы к `/api/broker-keys` |

## Типы

`src/types/portfolio.ts` содержит:

- `Broker` — `'inside' | 'finam' | 'bcs'`.
- `BrokerKey` — ключ брокера.
- `BrokerPortfolio` — портфель.
- `BrokerPosition` — позиция.
- `PortfolioSummary` — сводка.
- `RecommendedTag` / `RecommendedTagsResponse` — облако тегов + лимит.
- `BROKER_META` — метаданные для UI (название, цвет, hint).

## Лимит тегов

`RecommendedTagsCloud` больше не использует хардкод. Лимит и количество использованных тегов приходят с бэкенда:

```ts
const { data } = useRecommendedTags()
const tags = data?.tags || []
const tagLimit = data?.tagLimit || { used: 0, limit: 0 }
```

Статусы тега:
- `available` — клик подписывает.
- `subscribed` / `created-new` — уже подписан.
- `limit-reached` — лимит тарифа исчерпан, кнопка disabled.

## API-контракт

Базовый URL берётся из `src/lib/api.ts` (`https://pulse-api-bsov.onrender.com/api`).

- `GET /portfolio/summary?mode=by-broker` — сводка по брокерам.
- `GET /portfolio/summary?mode=consolidated` — консолидированная сводка.
- `GET /portfolio/recommended-tags` — теги с биржей (`exchange`) + лимит.
- `POST /portfolio/recommended-tags/subscribe` — подписаться на тег (`{ ticker, exchange }`).
- `GET /broker-keys` — список ключей.
- `POST /broker-keys` — создать ключ.
- `POST /portfolio` — создать портфель.
- `POST /portfolio/:id/sync` — ручная синхронизация.

## Навигация

- Ссылка на `/portfolio` добавлена в `Navbar.tsx`.
- Вкладка «Брокеры» добавлена в `Profile.tsx`.
- `ToastProvider` подключён в `main.tsx`.
