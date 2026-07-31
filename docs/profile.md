# Страница профиля

## Структура

`src/pages/Profile.tsx` — основная страница профиля пользователя.

Вкладки:
- **Профиль** — статистика, теги, выход.
- **Брокеры** — управление API-ключами брокеров и привязанными портфелями.
- **Уведомления** — матрица продуктов и каналов (`NotificationMatrix`), подключение Telegram и push, тихие часы.
- **Тариф** — текущий план, автопродление, карта, история, замороженные теги.
- **Платежи** — история платежей.

## Вкладка «Уведомления»

Компонент: `src/components/NotificationMatrix.tsx`.

- **Матрица продукт × канал**: `digest`, `weekly_report`, `fact_check`, `news_alert`, `billing`, `engagement` × `telegram`, `email`, `push`.
- Частота дайджеста: `1h`, `3h`, `6h`, `12h`, `24h`.
- **Тихие часы**: вкл/выкл, время начала/конца, хранятся на бэкенде.
- Подключение каналов:
  - Telegram — OAuth-виджет или deep-link `/start <userId>:<token>`.
  - Push — Capacitor Push Notifications (FCM) + VAPID Web Push.
- Неактивные каналы подсвечиваются как "не подключён".
- API: `GET/PUT /api/user/notification-matrix`, `POST /api/user/notification-matrix/quiet-hours`.

Legacy-компонент `NotificationSwitches.tsx` временно отображает флаги факт-чека через `GET/PATCH /api/user/notifications`.

## Замороженные теги в профиле

В списке тегов на вкладке "Профиль" замороженные теги отображаются серым цветом с иконкой `Lock` и ссылкой "Восстановить Premium", ведущей на `/pricing`.

## Блок недоступных функций

На вкладке "Тариф", если подписка неактивна, показывается блок с фичами, которые были в текущем плане, но отсутствуют в Free. Список формируется на фронтенде сравнением `tariff.plan.features` и `freePlan.features` (загружается с `GET /api/plans`).

## Зависимости

- `useAuth()` — контекст пользователя, портфель, `removeTag()`.
- `PortfolioTag` — включает `is_frozen?: boolean` и `news_per_month?: number`.
- `GlassCard` — переиспользуемая карточка в стиле Liquid Glass.
