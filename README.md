# PULSE Frontend

> Инвестиционные новости в реальном времени. React SPA для платформы PULSE.

**🌐 Production:** https://pulse-frontend-jt53.onrender.com  
**🔧 Backend API:** https://pulse-api-bsov.onrender.com  
**📄 Docs:** [DEPLOYMENT.md](./DEPLOYMENT.md) | [DESIGN_SPEC.md](./DESIGN_SPEC.md) | [PRODUCT_CONTEXT.md](./PRODUCT_CONTEXT.md) | [ANDROID.md](./ANDROID.md) | [PUSH_SETUP.md](./PUSH_SETUP.md)

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
    NewsCard.tsx               — Liquid glass карточка новости
    PulseLine.tsx              — Анимированная линия
    TelegramConnectBanner.tsx  — Баннер подключения Telegram-бота (OAuth Login Widget)
  pages/
    Home.tsx        — Главная (hero, search, tags, subscribe)
    NewsFeed.tsx    — Лента новостей
    Pricing.tsx     — Тарифы
    Login.tsx       — Вход / Регистрация
    Profile.tsx     — Профиль пользователя
    Admin.tsx       — Админ-панель
    Terms.tsx       — Условия использования
    Privacy.tsx     — Политика конфиденциальности
  hooks/
    useAuth.tsx     — Авторизация через API
  lib/
    api.ts          — API клиент
    copy.ts         — Все тексты UI
  App.tsx           — Роутинг
  main.tsx          — Entry point
  index.css         — Стили, CSS-переменные, анимации
```

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
