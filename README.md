# PULSE Frontend

> Инвестиционные новости в реальном времени. React SPA для платформы PULSE.

**🌐 Production:** https://pulse-frontend-jt53.onrender.com  
**🔧 Backend API:** https://pulse-api-bsov.onrender.com  
**📄 Docs:** [DEPLOYMENT.md](./DEPLOYMENT.md) | [DESIGN_SPEC.md](./DESIGN_SPEC.md) | [PRODUCT_CONTEXT.md](./PRODUCT_CONTEXT.md)

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
    Navbar.tsx      — Навбар (логотип, ссылки, auth)
    Footer.tsx      — Футер (ссылки, copyright)
    Layout.tsx      — Обёртка (navbar + main + footer)
    Tag.tsx         — Pill-тег с цветной точкой
    NewsCard.tsx    — Liquid glass карточка новости
    PulseLine.tsx   — Анимированная линия
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

## Environment Variables

| Variable | Описание |
|----------|----------|
| `VITE_API_URL` | URL backend API (default: http://localhost:3000) |
