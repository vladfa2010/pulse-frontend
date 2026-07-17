# Конфигурация Render Dashboard (Static Site) — pulse-frontend

## Redirects / Rewrites

Настройка: Render Dashboard → pulse-frontend → Settings → Redirects/Rewrites

| # | Source | Destination | Action | Описание |
|---|---|---|---|---|
| 1 | `/n/*` | `https://pulse-api-bsov.onrender.com/n/*` | Rewrite | OG-страницы новостей (HTML с meta-тегами для Telegram/WhatsApp/поисковиков) |
| 2 | `/sitemap.xml` | `https://pulse-api-bsov.onrender.com/sitemap.xml` | Rewrite | Карта сайта (5000 новостей за 30 дней) |
| 3 | `/robots.txt` | `https://pulse-api-bsov.onrender.com/robots.txt` | Rewrite | Разрешение на индексацию `/news/` и `/n/`, запрет `/api/` и личных страниц |
| 4 | `/*` | `/index.html` | Rewrite | SPA fallback — любой неизвестный путь отдает index.html для клиентского роутинга |

## Порядок правил (критично)

Правила проверяются сверху вниз. `/n/*`, `/sitemap.xml`, `/robots.txt` должны быть **перед** `/*` — иначе `/*` перехватит запрос.

## Файлы в репозитории

### `public/_redirects` — удален

Ранее использовался для SPA fallback. Формат `_redirects` (Netlify-style) не поддерживается Render Static Site — правила не применялись, диплинки `/news/:slug` возвращали пустой экран. Заменен на Dashboard rules.

### `public/render.yaml` — удален

Файл `render.yaml` читается Render только из корня репозитория (Blueprint deploy), не из Publish Directory (`dist/`). При размещении в `public/` он просто отдавался как статический файл без эффекта. Заменен на Dashboard rules.

### `public/og-default.png` — оставлен

Fallback OG-изображение. Используется в `/n/:slug` когда у новости нет уникального preview. Размер: 1200×630 px.

## Архитектура запросов

```
Пользователь открывает /news/stripe-...-cb113e3c:
  → Cloudflare → Render Static Site
  → Dashboard rule /* → /index.html (SPA fallback)
  → Browser загружает React SPA
  → BrowserRouter видит /news/:slug
  → NewsDetailModal загружает /api/news/by-slug/... (XHR)
  → Модалка открывается с контентом

Поисковый бот открывает /n/stripe-...-cb113e3c:
  → Cloudflare → Render Static Site
  → Dashboard rule /n/* → https://pulse-api-bsov.onrender.com/n/*
  → Backend отдает HTML с og:title, og:description, JSON-LD Article
  → Бот индексирует контент (без JS)

Google Search Console запрашивает /sitemap.xml:
  → Dashboard rule /sitemap.xml → backend
  → Backend отдает XML с 5000 URL
  → Google добавляет URL в очередь индексации
```

## Почему не _redirects / render.yaml

Render Static Site (не Web Service) не поддерживает конфигурационные файлы для routing:
- `_redirects` — формат Netlify, Render Static Site игнорирует
- `render.yaml` — читается только из корня репозитория при Blueprint deploy; в `public/` или `dist/` не работает
- Единственный рабочий способ — Dashboard Redirects/Rewrites

## Проверка после любых изменений

```bash
# SPA fallback (должен вернуть index.html)
curl -s https://pulse.inside-trade.ru/news/test-slug-12345678 | grep -c "doctype"

# OG endpoint (должен вернуть HTML с og:title)
curl -s https://pulse.inside-trade.ru/n/test | grep -c "og:title"

# Sitemap (должен вернуть XML)
curl -s https://pulse.inside-trade.ru/sitemap.xml | grep -c "urlset"

# Robots (должен вернуть текст)
curl -s https://pulse.inside-trade.ru/robots.txt | grep -c "User-agent"
```

## Зависимости

- Правило `/* → /index.html` обязательно для `BrowserRouter` (не `HashRouter`). `BrowserRouter` работает с реальными путями (`/news/:slug`), а не с hash-фрагментом (`/#/news/:slug`).
- Backend endpoint `/n/:slug` генерирует HTML без JS-редиректа — бот видит контент сразу.
- `Cache-Control: public, max-age=3600` на `/n/:slug` уменьшает нагрузку на БД.
