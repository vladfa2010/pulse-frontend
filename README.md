# PULSE Frontend

> Инвестиционные новости в реальном времени. React SPA для платформы PULSE.

**🌐 Production:** https://pulse.inside-trade.ru  
**🔧 Backend API:** https://pulse-api-bsov.onrender.com  
**🚀 Render URL:** https://pulse-frontend-jt53.onrender.com (алиас)  
**📄 Docs:** [DEPLOYMENT.md](./DEPLOYMENT.md) | [DESIGN_SPEC.md](./DESIGN_SPEC.md) | [PRODUCT_CONTEXT.md](./PRODUCT_CONTEXT.md) | [ANDROID.md](./ANDROID.md) | [AUTO_UPDATE.md](./AUTO_UPDATE.md) | [FIREBASE.md](./FIREBASE.md) | [PUSH_SETUP.md](./PUSH_SETUP.md) | [SECURITY.md](./SECURITY.md)

---

## Tech Stack

| Компонент | Технология |
|-----------|-----------|
| Framework | React 19 + TypeScript |
| Bundler | Vite |
| Styling | Tailwind CSS v3.4 |
| UI Kit | shadcn/ui |
| Animation | Framer Motion |
| Icons | Lucide React |
| Router | React Router (HashRouter) |

---

## Локальный запуск

```bash
npm install
npm run dev      # localhost:5173
npm run build    # production build → dist/
```

---

## Структура проекта

```
src/
  components/
    Navbar.tsx                 — Навбар (логотип, ссылки, auth)
    Footer.tsx                 — Футер (ссылки, copyright)
    Layout.tsx                 — Обёртка (navbar + main + footer)
    Tag.tsx                    — Pill-тег с цветной точкой
    NewsCard.tsx               — Liquid glass карточка новости (с графиком реакции цены)
    NewsReactionChart.tsx      — График реакции цены для карточки новости
    CandleChart.tsx            — Свечной график (echarts)
    UnreadNewsCarousel.tsx     — Карусель «Это вы ещё не видели» (непрочитанные)
    AllNewsCarousel.tsx        — Карусель «Вся лента» (история прочтений)
    GlobalNewsCarousel.tsx     — Общая лента новостей без фильтра тегов
    HeroAnimation.tsx          — Canvas-анимация «Word Stream» на главной (гость)
    PulseLine.tsx              — Анимированная линия
    TelegramConnectBanner.tsx  — Баннер подключения Telegram-бота (OAuth Login Widget)
    FreezeTagsBanner.tsx       — Баннер заморозки/лишних тегов (управление лимитом тегов)
    AuthModal.tsx              — Модальное окно авторизации (вход / регистрация / восстановление пароля)
  pages/
    Home.tsx        — Главная (hero, search, теги, карусели, subscribe)
    NewsFeed.tsx    — Лента новостей (/feed)
    Pricing.tsx     — Тарифы
    Login.tsx       — Вход / Регистрация
    Profile.tsx     — Профиль пользователя
    Admin.tsx       — Админ-панель
    Terms.tsx       — Условия использования
    Privacy.tsx     — Политика конфиденциальности
  hooks/
    useAuth.tsx              — Авторизация через API
    useNewsChartPrefetch.ts  — ТЗ-3.5: фоновый префетч графиков вперёд по ленте
    useSseNews.ts            — SSE-подписка на новые новости
  lib/
    api.ts          — API клиент (AbortController + 15s timeout; retry на сетевые ошибки для GET)
    newsChart.ts    — ТЗ-3.5/3.6: общий staleTime и тип InstrumentChart для графиков
    copy.ts         — Все тексты UI
  App.tsx           — Роутинг
  main.tsx          — Entry point
  index.css         — Стили, CSS-переменные, анимации
```

---

## API клиент (`src/lib/api.ts`)

- Все запросы идут через `api.*` и `adminApi.*`.
- Автоматически подставляет `Authorization: Bearer <token>`.
- **Таймаут 15 секунд** на любой запрос (`AbortController`). При таймауте показывается сообщение: «Сервер не отвечает. Проверьте интернет и попробуйте снова.»
- **Retry:** при сетевой ошибке (`TypeError`) GET-запросы повторяются 1 раз через 1 сек. Таймаут-ошибки (`AbortError`) не ретраятся.
- При 401 на защищённом endpoint — чистится токен и dispatch `auth:logout`.
- **Транспортные ошибки** (`AbortError` после таймаута и исчерпанный `TypeError` retry) помечаются флагом `isTransportError`, чтобы инициализация не разлогинивала пользователя при недоступном бэкенде.

## Инициализация (`src/hooks/useAuth.tsx` + `src/App.tsx`)

- При старте приложения с токеном в `localStorage` шлются параллельно `GET /auth/me` и `GET /user/tags` (ТЗ-46). Это убирает auth-водопад и позволяет персональным каруселям стартовать в t≈0.
- Доступность токена отслеживается синхронным флагом `hasToken`, который держит `useAuth`. Карусели `UnreadNewsCarousel` и `AllNewsCarousel` монтируются по `hasToken`, а не по `isLoggedIn && selectedTags.length > 0`.
- Внутри каруселей сохранён гейт «юзер без тегов не видит секцию» (`!isAuthLoading && portfolio.length === 0`), но он стоит **после всех хуков** (ТЗ-47, React Rules of Hooks).
- Если `/user/tags` падает, сессия не разлогинивается — портфель просто становится пустым (ТЗ-47).
- Если запрос падает по транспортной причине (таймаут/сеть), токен **не** удаляется, пользователь не разлогинивается.
- Показывается полноэкранный retry-экран с кнопкой **«Повторить»** (`App.tsx`).
- **Авторекавери:** пока экран ошибки виден, приложение автоматически повторяет `GET /auth/me` каждые 7 секунд, максимум 5 попыток подряд. Во время автопопыток отображается спиннер и текст «Пробуем снова… (попытка N из 5)».
- После 5 неудачных автопопыток экран возвращается в статичное состояние с кнопкой «Повторить»; ручная кнопка сбрасывает счётчик и сразу запускает новую серию.
- Как только API отвечает, приложение восстанавливает сессию само — без повторного ввода пароля.
- Реальная 401 (протухшая сессия) приводит к logout и экрану логина. `logout()` чистит весь React Query кэш (`queryClient.clear()`), чтобы данные юзера A не мелькали у юзера B.
- **Осознанный tradeoff:** при протухшем токене на старте улетает пакет параллельных 401, но первый же вызывает `clearAuth` → `hasToken=false` → размонтирование каруселей.

---

## Деплой

### Render (текущий)
- **Type:** Static Site
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- **Автодеплой:** При push в `main`

### GitHub Pages (альтернатива)
- Workflow: `.github/workflows/deploy.yml`
- Требуется `base: '/pulse-frontend/'` в `vite.config.ts`

---

## Telegram-бот

Подключение Telegram реализовано через официальный **Telegram Login Widget** (`https://telegram.org/js/telegram-widget.js`):

- Баннер на главной (`TelegramConnectBanner.tsx`) показывает кнопку **«Подключить бота»**.
- При нажатии вызывается `Telegram.Login.auth({ bot_id, request_access: 'write', lang: 'ru' }, callback)`.
- Данные пользователя (`id`, `first_name`, `username`, `photo_url`, `auth_date`, `hash`) отправляются на `POST /api/auth/telegram`.
- Backend проверяет HMAC-SHA256 подпись и сохраняет `user_channels`.
- Если виджет недоступен — fallback на deep link `https://t.me/Insidepulse_bot?start=<userId>:<token>`.

Для работы виджета домен сайта должен быть добавлен в `@BotFather` через `/setdomain`.

## Environment Variables

| Variable | Описание |
|----------|----------|
| `VITE_API_URL` | URL backend API (default: http://localhost:3000) |
| `VITE_FIREBASE_*` | Firebase config (подробнее в [`FIREBASE.md`](./FIREBASE.md)) |
