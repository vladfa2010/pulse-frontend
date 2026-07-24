# Главная страница

`src/pages/Home.tsx` — главная страница приложения.

## Структура

1. `UnreadNewsCarousel` — "Это вы ещё не видели".
2. `Hero` — поиск, теги, PulseLine.
3. `FreezeTagsBanner` — баннер заморозки тегов (если есть условия).
4. `AllNewsCarousel` — вся лента по тегам.
5. `DailySummary` — AI daily summary.
6. `GlobalNewsCarousel` — общая лента.
7. `SentimentChartCard` — индекс настроения.
8. `TelegramConnectBanner` — промо-баннер Telegram.
9. `PopularTagsSlider` — популярные теги.

## Баннер заморозки тегов

Компонент: `src/components/FreezeTagsBanner.tsx`.

Показывается **первым после Hero/поиска**, если пользователь вошёл и выполнено одно из условий:

- есть замороженные теги (`tariff.tagUsage.frozen > 0`);
- активных тегов больше, чем лимит Free, и подписка неактивна (`tariff.tagUsage.active > freeLimit && !subscription.active`).

Данные загружаются с `GET /api/user/tariff-status`.

### Поведение

- Крестик в правом верхнем углу закрывает баннер на 24 часа (`localStorage.freezeBannerClosed`).
- Каждый тег — chip: имя + крестик, под ними "N новостей за 30 дней".
- Клик по крестику на теге вызывает `DELETE /api/user/tags/:tagId` и анимированно убирает chip.
- Кнопка "Готово" активна только когда активных тегов ≤ лимиту Free. До этого кнопка disabled и показывает "Удалите ещё N тегов".
