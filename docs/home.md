# Главная страница

`src/pages/Home.tsx` — главная страница приложения. Оглавление также продублировано в шапке файла.

## Стиль и дизайн-токены

- Акцент: `#00D4FF` (cyan, класс `text-accent-primary`), курсив-акценты в заголовках — тем же цветом.
- Текст: основной `#FFFFFF` (`text-text-primary`), вторичный `#9CA3AF` (`text-text-secondary`), приглушённый `text-text-muted`.
- Заголовки hero: `fontWeight 700`, `lineHeight 1.05`, `letterSpacing -0.04em`, `textAlign center`, градиент через класс `gradient-text`.
- Кегли заголовков:
  - Гостевой hero: `clamp(36px, 6vw, 72px)` (решение владельца 2026-09-08: минус 25% от исходных 48/8vw/96).
  - Приветствие авторизованного: `clamp(32px, 5.33vw, 64px)` (ТЗ-54).
  - Второй hero «Ваши инструменты»: `clamp(32px, 5.33vw, 64px)` — 1:1 стиль основного hero.
  - Заголовок TileReveal: `clamp(30px, 5vw, 60px)`, `tracking -0.03em`, `lineHeight 1.08`.

## Структура — гость (неавторизованный)

Порядок — фактический порядок в JSX. Все гостевые блоки строго за `{!isLoggedIn && …}`.

1. `FreezeTagsBanner` — баннер заморозки / превышения лимита тегов (нет условий → не рендерится, см. раздел ниже).
2. **Hero**:
   - `HeroAnimation` — анимация телефона/графиков, гостю, высота `max-h-[32dvh]` (`md:40dvh`), сетка секции `min-h-[100dvh]`, ряды `minmax(200px,32dvh)_auto_auto_minmax(0,1fr)`.
   - Заголовок двумя строками через `<br/>`: «Освобождаем 90% времени на анализ новостей.» (градиент) + «Без ущерба осведомлённости» (cyan italic).
   - **Search Bar** (`max-w-[720px]`, pill, иконка слева): у гостя `placeholder` input пустой — вместо него оверлей с печатающимся текстом `TextType` (ТЗ-65): серии текстов разные для desktop/mobile (`PLACEHOLDER_TYPED_TEXTS_DESKTOP`/`_MOBILE`), `typingSpeed 44`, `deletingSpeed 22`, `pauseDuration 2500`, `initialDelay 600`, `loop`, `startOnVisible`, курсор; текст центрирован в строке поиска. `prefers-reduced-motion` → последняя фраза серии статично.
   - `DemoTagsRow` — демо-теги под поиском (ТЗ-59). Чипы в стиле `Tag` (цвета по типам), read-only: клик → `openAuthModal('register')`. Источник `GET /api/public/demo-tags` (кэш 60 с). Ошибка/пусто → скрыт. Демо-аккаунт: env `PUBLIC_DEMO_EMAIL` (дефолт `vladfa@ya1.ru`), замороженные теги не отдаются.
3. **BlurHighlight «Это демо-лента…»** (ТЗ-68) — текст-объяснение над демо-лентой, вместо бывшего subtitle в hero. Компонент `@reactbits-starter/blur-highlight-tw` (`src/components/react-bits/blur-highlight.tsx`). Настройки: `blurAmount 8`, `inactiveOpacity 0.3`, `blurDelay 0.3`, `blurDuration 0.8`, `highlightColor #00D4FF`, `highlightClassName "py-0.5 px-1 rounded-[5px] text-black"` (подсветка фирменным cyan, текст внутри чёрный), `highlightDelay 0.4`, `highlightDuration 1`, `highlightDirection left`, `viewportOptions { once: true, amount: 0.5 }`. Текст `text-[32px] leading-loose`, `max-w-xl mx-auto`. Подсвечиваемые фразы — константы `DEMO_FEED_TEXT`/`DEMO_FEED_BITS` (BITS обязаны быть точными подстроками TEXT). Reduced-motion → статичный текст.
4. `DemoFeedCarousel` — демо-лента с графиками (ТЗ-59/60). Лента демо-аккаунта `GET /api/public/demo-feed` (без пагинации: первые 50 новостей, кэш 60 с одним ключом, `hasMore: false`), карточки `NewsCard` с `showChart` (график запрашивается во вьюпорте). Один запрос `useQuery`. Ошибка/пусто → скрыт.
5. **BlurHighlight «Пульс рынка…»** + `GlobalSummary isPublic` — «Пульс рынка»: ИИ-саммари всей ленты (до 200 новостей за 6 ч) для гостей. Тот же BlurHighlight с константами `SUMMARY_TEXT`/`SUMMARY_BITS`, настройки идентичны п. 3. Публичный режим ходит в `GET /api/public/summary-global` — **только свежий кэш** (генерацию не триггерит; прогрев: warm-up через 3 мин после boot + каждые 6 ч). Кнопки «Обновить» нет; нет кэша/ошибка → скрыт. Вёрстка 1:1 с авторизованной версией.
6. **RegisterCta** — CTA «Бесплатная регистрация» после ИИ-саммари (конверсионная точка на прочитанном инсайте; ТЗ-58). Единственный экземпляр на странице (бывший нижний дубль заменён TileReveal, п. 15).
7. `FeaturesCarousel` — «Что Pulse делает вместо вас» (ТЗ-57): карусель из 7 карточек поверх оболочки `NewsCarousel` (стрелки по 450px, нативный скролл/свайп, боковые затемнения; карточки 210px). Первые 3 («Хватит читать перепечатки», «Цена уже здесь», «Не верьте заголовку на слово») видны без скролла; порядок — часть смысла. `src/components/home/FeaturesCarousel.tsx`.
8. `PublicInfoVolume` — «Объём информации» эталонного аккаунта (ТЗ-56/57). Вёрстка 1:1 с профилем (glass-карта, зелёный акцент `#10B981`, сетка 2×2), данные `GET /api/public/efficiency` (публичный; суточный кэш, ленивый пересчёт + прогрев после boot; эталонный аккаунт env `PUBLIC_EFFICIENCY_EMAIL`). Подзаголовок «обновляются ежедневно» соответствует кэшу. Ошибка/404 → скрыт.
9. `SuperpowerVideoBanner` — видео-баннер «Суперсила инвестора — знать» (ТЗ-55). Фон `public/media/hero-video-2.mp4` (loop), ленивая загрузка через IntersectionObserver, pause/play по вьюпорту, градиент-заглушка при ошибке, reduced-motion — без видео и пульса. CTA «Получить суперсилу» → `openAuthModal('register')`, аналитика `home_superpower_view` / `home_superpower_cta_click`.
10. **Второй hero «Ваши инструменты»** — заголовок 1:1 стилем основного hero (`clamp(32px, 5.33vw, 64px)`, градиент + cyan italic «инструменты», та же анимация framer-motion). Только гостям, над «Пульсом рынка».
11. `MarketPulseMini` — мини-блок «Пульс рынка» (тепловая карта активности года). Публичный, скрывается при отсутствии новостей. Ленивый маунт (`LazyRender`). Клик → `/activity-map?scope=all&scale=year`.
12. `CalendarBlock` — календарь инвестора (ленивый маунт, `LazyRender`).
13. `HomeSentimentIndex` — индекс настроения (модульный компонент, Suspense + скелетон). Гостям — сразу после календаря.
14. `PopularTagsSlider` — популярные теги. Гостям — самый низ перед финальной сценой.
15. **HomeTileReveal** — финальная скролл-сцена (ТЗ-69), заменяет бывшую нижнюю CTA. Детали — раздел «TileReveal» ниже.

## Структура — авторизованный пользователь

FreezeTagsBanner (при условиях) → Hero (приветствие «{greeting}, {username}» тем же стилем, поиск с обычным placeholder «Введите компанию, сектор, личность или тренд…», без HeroAnimation и демо-тегов) → `DailySummary` (при наличии тегов) → `UnreadNewsCarousel` («Это вы ещё не видели») → `AllNewsCarousel` → `GlobalSummary` → `HomeSentimentIndex` → `TelegramConnectBanner` → `PopularTagsSlider` → `MarketPulseMini` → `CalendarBlock` → `CascadeTestBanner` (ТЗ-47, самый низ, снимается фичефлагом `SHOW_CASCADE_TEST_BANNER`).

Гостевые блоки (демо-лента, объём информации, суперсила, второй hero, TileReveal) авторизованный не видит вообще.

## RegisterCta и стиль кнопки «Бесплатная регистрация»

Компонент `RegisterCta` (`Home.tsx`), один экземпляр — после ИИ-саммари. Кнопка: поверхность `#0E0E0E`, белый текст, pill, размер на 50% крупнее базового (`px-[30px] py-[15px] text-[21px] font-medium`). Обернута в `BorderGlow` (`src/components/BorderGlow.tsx`, порт reactbits MIT): светящаяся рамка из палитры cyan/зелёный/фиолет следует за курсором, при появлении во вьюпорте (IntersectionObserver, порог 0.6) свечение пробегает по рамке; пробег повторяется при каждом возврате на экран. Клик → `openAuthModal('register')` (аналитика `open_auth_modal`).

## TileReveal — финальная скролл-сцена (ТЗ-69)

Обёртка `src/components/HomeTileReveal.tsx`, компонент `@reactbits-starter/tile-reveal-tw` (`src/components/react-bits/tile-reveal.tsx`, чистый React + rAF, внешних зависимостей нет).

- **Сцена:** 9 фото «жизни вне смартфона» (`public/media/tile-reveal/life-1..9.jpg`, 640×640, ~690 КБ, `loading="lazy"` встроен) подлетают плитками по колонкам → сетка зумируется и разъезжается за края → заголовок «Освободите время *для жизни*, а не сидите в смартфоне», подпись и CTA. Sticky-сцена: root 650svh (`scrollLength 4` + `endBuffer 1.5`).
- **Настройки (утверждённый мокап, все явно — на дефолты не полагаемся):** `columns 3`, `gap 20`, `gridWidth 760`, `tileAspect 1`, `tileRadius 16`, `grayscale false`, `direction alternate`, `stagger 0.06`, `overlap 0.6`, `zoom 2.2`, `spread 0.4`, `scrollLength 4`, `endBuffer 1.5`, `scrub 0.08`, `contentGap 28`.
- **⚠️ Локальный патч вендорного файла (ТЗ-73):** `src/components/react-bits/tile-reveal.tsx` несёт собственное расширение — проп `endBuffer` (буфер после финала: этап остаётся приклеенным ещё ~1.5 экрана после прогресса 1, гасит инерцию скролла; root выше на `endBuffer×100svh`, `run` в `measure()` уменьшен на ту же величину — хореография фаз и точка финала не смещаются). При переустановке компонента из реестра (`npx shadcn add … tile-reveal-tw`) патч **затрётся** — восстановить по этому разделу.
- **CTA:** монтируется только в финале сцены — `onProgress ≥ 0.98` показать, `< 0.9` скрыть (гистерезис: пробег свечения BorderGlow запускается, когда кнопка видна, и перезапускается при каждом возврате к финалу). Та же кнопка, что в RegisterCta.
- **Подпись:** `text-[17px] leading-[1.65] text-text-secondary max-w-[520px]`, «Pulse уже прочитал тысячи новостей за вас…».
- **Фолбэк:** `prefers-reduced-motion` → статичный экран с заголовком, подписью и кнопкой (встроен в компонент).
- **Лицензия:** `life-2.jpg` — стоковое превью iStock, для прода лицензировать или заменить (остальные 8 — AI-генерация).

## Баннер заморозки тегов

Компонент: `src/components/FreezeTagsBanner.tsx`.

Показывается **первым после Hero/поиска**, если пользователь вошёл и выполнено одно из условий:

- есть замороженные теги (`frozen_tags > 0`);
- количество активных тегов превышает лимит effective-плана (`to_remove > 0`);
- баннер не был закрыт вручную крестиком в течение последних 24 часов (`localStorage.freezeBannerClosed`).

Effective-план вычисляется бэкендом (`buildSubscriptionStatus`): после окончания грейса лимит будет от `free`, даже если в БД `subscription_plan` всё ещё `'premium'`.

Если `tag_limit < 0` (безлимитный Premium), баннер не показывается.

#### Текст баннера

Заголовок зависит от состояния:

| Состояние | Заголовок |
|-----------|-----------|
| `frozen_tags > 0 && to_remove > 0` | "Теги заморожены — удалите лишние" |
| `frozen_tags > 0 && to_remove === 0` | "Замороженные теги — выберите активные или восстановите Premium" |
| `frozen_tags === 0 && to_remove > 0` | "У вас слишком много тегов для тарифа" |

Данные загружаются с `GET /api/user/tag-status`. Формат ответа:

| Поле | Тип | Описание |
|------|-----|----------|
| `current_plan` | string | ID effective-плана |
| `plan_name` | string | Отображаемое имя effective-плана |
| `tag_limit` | number | Лимит тегов (−1 = безлимит) |
| `total_tags` | number | Всего тегов (активных + замороженных) |
| `active_tags` | number | Активных тегов |
| `frozen_tags` | number | Замороженных тегов |
| `to_remove` | number | Сколько тегов нужно удалить, чтобы уложиться в лимит |
| `tags` | array | Список тегов с полями `id`, `tag_id`, `name`, `tag_type`, `is_frozen`, `news_count_30d` |

### Поведение

- **Крестик в правом верхнем углу** закрывает баннер на 24 часа (`localStorage.freezeBannerClosed`).
- **Каждый тег** — chip: имя + крестик, под ним "N новостей за 30 дней".
- **Клик по крестику на теге** вызывает удаление тега через `useAuth().removeTag()` (внутри — `DELETE /api/user/tags/:tagId` или аналогичный метод контекста). Chip анимирует исчезновение (scale + opacity). После успеха статус баннера перезагружается.
- **Кнопка сохранения**:
  - пока `to_remove > 0` — disabled, текст "Удалите N тегов";
  - когда `to_remove === 0` — активна, текст "Сохранить N тегов";
  - при нажатии отправляется `POST /api/user/select-active-tags` с телом `{ activeTagIds: [...] }` — массив `id` (не `tag_id`) всех тегов, отображаемых в баннере.
- **После успешного сохранения**:
  - баннер исчезает с анимацией `fade out + slide up` (400 ms, `framer-motion` `exit`);
  - не показывается `alert()` с подтверждением;
  - баннер **не** блокируется в `localStorage` на 24 часа — при повторном превышении лимита он появится снова после следующего `loadStatus()`.
- **Ошибки** отображаются inline красным текстом под списком тегов, не через `alert()`.
- Баннер обёрнут в `AnimatePresence`, поэтому exit-анимация отрабатывает корректно при полном unmount.
- **Обновление без перезагрузки:** баннер слушает событие `subscription:refresh` (диспатчится после оплаты/даунгрейда) и обновляется при `visibilitychange` (возврат во вкладку).

### Сценарий

```
1. Пользователь заходит на главную с 13 тегами, лимит = 10.
2. Баннер показывает 13 тегов, кнопка: "Удалите 3 тега".
3. Пользователь удаляет 3 тега крестиками — chip'ы анимируют исчезновение.
4. Кнопка меняется на "Сохранить 10 тегов" и становится активной.
5. Пользователь нажимает "Сохранить".
6. POST /api/user/select-active-tags → активные теги сохраняются, остальные замораживаются.
7. Баннер плавно исчезает (opacity → 0, translateY → −20px), пользователь остаётся на главной.
```
