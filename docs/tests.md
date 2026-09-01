# Тестирование PULSE Frontend

> Мигрировано с `puppeteer-core` на **Playwright** (`@playwright/test`).

---

## Окружения

| Окружение | URL фронтенда | URL бэкенда | Использование |
|-----------|---------------|-------------|---------------|
| Production | `https://pulse-frontend-jt53.onrender.com` | `https://pulse-api-bsov.onrender.com` | E2E по умолчанию |
| Custom domain | `https://pulse.inside-trade.ru` | — | Алиас продакшена |
| Local | `http://localhost:5173` | `http://localhost:3000` | Разработка |

⚠️ **E2E-тесты ходят через UI фронтенда**, а не напрямую в API. Единственное исключение — debug-скрипты (`scripts/debug-checklist*.cjs`), которые сами получают JWT через `POST /api/auth/login` и подкладывают токен в `localStorage`, чтобы протестировать состояние после авторизации.

---

## Тестовый аккаунт

| Поле | Значение |
|------|----------|
| Email | `vladfa@ya2.ru` |
| Password | `!1234567890` |

> В некоторых debug-скриптах используется `vladfa@ya12.ru` — это тот же аккаунт на бэкенде `pulse-api-bsov.onrender.com`.

---

## Структура тестов

```
pulse-frontend/
├── src/lib/__tests__/          # Unit-тесты (Vitest)
│   ├── feedParams.test.ts
│   ├── returnUrl.test.ts
│   └── subscription.test.ts
├── tests/                      # E2E-тесты (Playwright)
│   └── feed.spec.ts            # Шерабельные ссылки /feed
├── playwright.config.ts        # Конфигурация Playwright
└── scripts/                    # Отладочные скрипты Playwright
    ├── screenshot.cjs
    ├── test-ripple.cjs
    ├── debug-checklist.cjs
    └── debug-checklist-short.cjs
```

---

## Unit-тесты (Vitest)

```bash
npm run test
```

Запускаются только файлы внутри `src/lib/__tests__/` — директория `tests/` исключена через `test.exclude` в `vite.config.ts`, чтобы не было конфликта с Playwright.

---

## E2E-тесты (Playwright)

### Установка браузеров

```bash
npx playwright install chromium
```

### Запуск

```bash
# Против продакшен-фронтенда (по умолчанию)
npx playwright test

# Локально
PW_BASE_URL=http://localhost:5173 npx playwright test

# Через npm-скрипт
npm run test:e2e
```

### Конфигурация

`playwright.config.ts`:
- `testDir: './tests'` — ищет `*.spec.ts` в этой папке.
- `fullyParallel: false`, `workers: 1` — тесты идут последовательно, потому что используется один тестовый аккаунт и shared state через URL.
- Базовый URL: `https://pulse-frontend-jt53.onrender.com`.
- При `PW_BASE_URL` с `localhost`/`127.0.0.1` автоматически поднимается `npm run dev`.

### Покрытие /feed

`tests/feed.spec.ts` покрывает:

| ID | Сценарий |
|----|----------|
| TC-F1 | Выбор тега пишет `?tag=` в URL |
| TC-F3 | Поиск пишет `?q=` после debounce |
| TC-F5 | `?tag=` + `?q=` одновременно |
| TC-F6 | «Все» сбрасывает тег, но сохраняет поиск |
| TC-F7 | Очистка поиска возвращает чистый `/feed` |
| TC-F8 | back/forward по истории фильтров |
| TC-F10 | Несуществующий тег → fallback в поисковый запрос |
| TC-R2 | Гость открывает `/feed?tag=...&q=...`, логинится, возвращается на исходную ссылку |

---

## Отладочные скрипты

### Скриншоты

```bash
node scripts/screenshot.cjs --route / --output screenshots/home-mobile.png --fullPage
node scripts/screenshot.cjs --route / --output screenshots/home-desktop.png --fullPage --desktop
node scripts/screenshot.cjs --route /sentiment --output screenshots/sentiment.png --fullPage
```

Переменная `BASE_URL` перекрывает фронтенд.

### Проверка SPA-навигации и каруселей

```bash
# Короткая версия (~1 минута)
node scripts/debug-checklist-short.cjs

# Полная версия с 6-минутным idle-тестом SSE
node scripts/debug-checklist.cjs
```

Оба скрипта:
1. Логинятся через API (`/api/auth/login`) и получают JWT.
2. Открывают фронтенд, подкладывают токен в `localStorage`, перезагружают.
3. Проверяют SPA-переходы `/` ↔ `/profile` без лишних запросов к `/api/news/global`.
4. Тестируют stale-переход (35 сек в `/profile`) — с `refetchOnMount:false` не должно быть лишних запросов.
5. Кликают карточку новости и проверяют, что URL не содержит `/news/undefined`.

### Проверка ripple-эффекта

```bash
node scripts/test-ripple.cjs
```

---

## Обновление документации

После изменений в тестах обновляй:
1. `docs/tests.md` — этот файл.
2. `README.md` — ссылка в разделе Tech Stack / Docs.

---

## Чек-лист перед пушем

```bash
npm run test       # unit
npm run test:e2e   # e2e на продакшене
npm run build      # production build
```
