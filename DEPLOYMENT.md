# PULSE — Deployment Guide

> Единый документ по инфраструктуре, деплою и окружению.
> Последнее обновление: 2026-06-18

**Содержание:**
- [Архитектура](#архитектура)
- [Frontend](#frontend-render-static-site)
- [Backend](#backend-render-web-service)
- [RSS Агрегация](#rss-агрегация)
- [Smart Tag Matching](#smart-tag-matching)
- [Анти-дубликат](#анти-дубликат-система)
- [Database Schema](#database-schema)
- [Git Workflow](#git-workflow)
- [Критические проблемы](#критические-проблемы-и-решения)
- [Переменные окружения](#переменные-окружения)
- [Тестовые данные](#тестовые-данные)

---

## Архитектура

```
┌──────────────────────────────────────────────────────────────────┐
│                         ПОЛЬЗОВАТЕЛЬ                             │
└──────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌───────────────────────────────┐
│   FRONTEND               │    │   BACKEND                     │
│   pulse-frontend-jt53    │    │   pulse-app-nfez              │
│   .onrender.com          │    │   .onrender.com               │
│                          │    │                               │
│   Render Static Site     │◄──►│   Render Web Service (Docker) │
│   - React SPA            │    │   - Node.js 20 + Express      │
│   - Build: npm run build │    │   - PostgreSQL (Render)       │
│   - Publish: dist/       │    │   - JWT Auth                  │
│                          │    │   - RSS Aggregator            │
└──────────────────────────┘    └──────────────┬────────────────┘
                                               │
                                               ▼
                                ┌───────────────────────────────┐
│                               │   DATABASE                    │
│                               │   pulse-db                    │
│                               │   (Render PostgreSQL)         │
│                               │                               │
│                               │   - Managed PostgreSQL        │
│                               │   - Данные сохраняются        │
│                               │     навсегда                  │
│                               └───────────────────────────────┘
```

---

## Render API и доступ к логам

Для диагностики деплоев у ассистента есть локальный Render API токен.

| Параметр | Значение |
|----------|----------|
| **Render API Token** | `<REDACTED>` |
| **Файл с токеном** | `.render-token` в корне проекта (не коммитить) |
| **Owner ID** | `tea-d8a2e528qa3s73efm1g0` |

### Service IDs

| Сервис | Render ID | URL |
|--------|-----------|-----|
| pulse-frontend (Static Site) | `srv-d8ao626k1jcs73856fbg` | https://pulse-frontend-jt53.onrender.com |
| pulse-api (Web Service) | `srv-d8a2fum7r5hc73e11pbg` | https://pulse-api-bsov.onrender.com |
| pulse-app (Static Site, legacy) | `srv-d8aafhrbc2fs73ak9790` | https://pulse-app-nfez.onrender.com |

### Чтение логов через API

```bash
TOKEN=$(cat .render-token)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.render.com/v1/logs?ownerId=tea-d8a2e528qa3s73efm1g0&resource=<SERVICE_ID>&direction=backward"
```

### Пагинация

Ответ содержит `hasMore`, `nextEndTime`, `nextStartTime`. Для получения более старых логов используй `nextEndTime`:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.render.com/v1/logs?ownerId=tea-d8a2e528qa3s73efm1g0&resource=<SERVICE_ID>&direction=backward&endTime=<nextEndTime>"
```

> ⚠️ **Безопасность:** Токен хранится локально и не должен попадать в git. Если `.render-token` случайно закоммичен — отозвать токен в Render Dashboard и создать новый.

---

## Frontend (Render Static Site)

### URL
**https://pulse-frontend-jt53.onrender.com**

### Render Settings
| Поле | Значение |
|------|----------|
| **Type** | Static Site |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |
| **Branch** | `main` |

### Environment Variables
| Variable | Value | Описание |
|----------|-------|----------|
| `VITE_API_URL` | `https://pulse-api-bsov.onrender.com` | URL backend API |

### Git Repository
- **URL:** https://github.com/vladfa2010/pulse-frontend
- **Branch:** `main`
- **Автодеплой:** Включен (при каждом push в `main`)

### Локальный запуск
```bash
cd /mnt/agents/projects/frontend
npm install
npm run dev     # localhost:5173
```

### Production build
```bash
npm run build   # выход в dist/
```

---

## Backend (Render Web Service)

### URL
**https://pulse-app-nfez.onrender.com**

### Render Settings
| Поле | Значение |
|------|----------|
| **Name** | `pulse-app` |
| **Type** | Web Service |
| **Runtime** | Docker |
| **Git Repository** | `https://github.com/vladfa2010/pulse` ⚠️ НЕ pulse-frontend! |
| **Branch** | `main` |

### PostgreSQL Database
| Поле | Значение |
|------|----------|
| **Name** | `pulse-db` |
| **Type** | PostgreSQL |
| **Region** | Frankfurt (EU Central) |

### Environment Variables (Render Dashboard — pulse-app)
| Variable | Value | Описание |
|----------|-------|----------|
| `DATABASE_URL` | `postgresql://pulse_user:PASSWORD@dpg-.../pulse_...` | ⚠️ Обязательно! PostgreSQL connection string |
| `JWT_SECRET` | `(скрыт)` | Секрет для JWT токенов |
| `FRONTEND_URL` | `https://pulse-frontend-jt53.onrender.com` | URL фронтенда для редиректа после оплаты |
| `YOOKASSA_SHOP_ID` | `(скрыт)` | ЮKassa shop ID (demo: 54401) |
| `YOOKASSA_SECRET_KEY` | `(скрыт)` | ЮKassa secret key |
| `KIMI_API_KEY` | `(скрыт)` | Kimi Translate API ключ |
| `SENDGRID_API_KEY` | `(скрыт)` | SendGrid API ключ |
| `TELEGRAM_BOT_TOKEN` | `(скрыт)` | Telegram Bot токен |

### ⚠️ ВАЖНО: НЕ используйте SQLite на production!
| Variable | Статус |
|----------|--------|
| `USE_SQLITE` | ❌ УДАЛИТЬ (или оставить пустым) |
| `SQLITE_FILE` | ❌ УДАЛИТЬ |
| `DB_HOST` | ❌ УДАЛИТЬ (не нужен, используется DATABASE_URL) |
| `DB_PORT` | ❌ УДАЛИТЬ |
| `DB_NAME` | ❌ УДАЛИТЬ |
| `DB_USER` | ❌ УДАЛИТЬ |
| `DB_PASSWORD` | ❌ УДАЛИТЬ |

### Git Repository
- **URL:** https://github.com/vladfa2010/pulse
- **Branch:** `main`

### Локальный запуск
```bash
cd /mnt/agents/projects/backend
npm install
npm run build
npm start       # localhost:3000
```

### Docker (локально)
```bash
docker-compose up   # PostgreSQL 16 + Redis 7 + Backend
```

---

## RSS Агрегация

### Источники (20 RSS)
| Категория | Источники | Язык |
|-----------|-----------|------|
| **RU Новости** | Лента, Коммерсант, Ведомости, ТАСС, РИА, Интерфакс, РТ, Известия | ru |
| **EN Финансы** | Reuters, TechCrunch, CNBC, WSJ, Seeking Alpha, MarketWatch, Mining | en |
| **EN Технологии** | The Verge, Wired, Ars Technica, HackerNews | en |
| **Крипто** | CoinTelegraph | en |
| **Энергетика** | OilPrice | en |

### Schedule
| Параметр | Значение |
|----------|----------|
| **Интервал** | Каждые 15 минут (`*/15 * * * *`) |
| **Первый запуск** | Через 2 минуты после старта сервера |
| **Batch size** | 4 источника за раз |
| **Пауза между batch** | 1.5 секунды |
| **Timeout** | 8 секунд на источник |

### Flow
```
RSS Fetch → Parse XML → Translate EN→RU → Sentiment Analysis 
    → Smart Tag Matching → Deduplicate (content_hash) → Save to DB
```

---

## Smart Tag Matching

### 3-слойная система matching
```
Статья (title + summary)
    │
    ▼
Layer 1: Keyword Matching (быстрый, ~60% покрытия)
    → Если match → сохраняем теги
    → Если нет → Layer 2
    │
    ▼
Layer 2: LLM Smart Matching (Kimi API)
    → Анализирует контекст, возвращает теги
    → Кэширует результат на 7 дней
    → Если нет match → Layer 3
    │
    ▼
Layer 3: Related Tags
    → nvda → tech, ai
    → tesla → tech, ai, elon
    → crypto → tech, fed, bank
```

### Поддерживаемые теги (18)
| Тег | Ключевые слова (примеры) |
|-----|------------------------|
| `ai` | ии, нейросет, chatgpt, openai, llm |
| `tesla` | tesla, тесла, musk, маск, elon, cybertruck |
| `nvda` | nvidia, nvda, geforce, rtx, gpu |
| `crypto` | криптовалют, bitcoin, биткоин, блокчейн |
| `fed` | фрс, federal reserve, powell, инфляция |
| `sber` | сбербанк, сбер, sberbank |
| `gazprom` | газпром, gazprom |
| `oil` | нефть, oil, газ, opec |
| `tech` | технолог, tech, айти, startup |
| + 9 других | apple, google, microsoft, meta, bank, gold, space, greentech, realestate |

### Related Tags
```
Пользователь добавляет: nvidia
→ Система предлагает: tech, ai

Пользователь добавляет: crypto
→ Система предлагает: tech, fed, bank
```

### API
| Endpoint | Описание |
|----------|----------|
| `GET /api/user/tags/related?tag=nvidia` | Связанные теги |

---

## Анти-дубликат система

### Механизм
```
1. Нормализация URL
   → Удаление UTM-параметров
   → www. → без www
   → http → https
   
2. Content Hash (MD5)
   → content_hash = MD5(title_ru + summary_ru)
   
3. UNIQUE constraint
   → content_hash UNIQUE в таблице news
   
4. ON CONFLICT DO UPDATE
   → Дубликат обновляет all_sources[]
   → source_count += 1
```

### Структура дубликатов
```sql
-- Одна новость = одна запись
INSERT INTO news (..., content_hash, all_sources, source_count)
VALUES (..., 'abc123', ARRAY['РБК'], 1)
ON CONFLICT (content_hash) DO UPDATE
  SET all_sources = array_append(news.all_sources, EXCLUDED.source),
      source_count = news.source_count + 1;

-- Результат для дубликата:
-- content_hash: 'abc123'
-- all_sources:  ['РБК', 'ТАСС', 'Лента']
-- source_count: 3 (три источника)
```

### Поля для дедупликации
| Поле | Тип | Описание |
|------|-----|----------|
| `url_normalized` | TEXT | Нормализованный URL |
| `content_hash` | TEXT UNIQUE | MD5 хеш контента |
| `all_sources` | TEXT[] | Массив источников |
| `source_count` | INTEGER | Количество источников |

---

## Database Schema

### Основные таблицы

#### `news` — Новости
| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID PK | Уникальный ID |
| `title_original` | TEXT | Оригинальный заголовок |
| `title_ru` | TEXT | Переведённый заголовок |
| `summary_ru` | TEXT | Переведённое summary |
| `source` | VARCHAR | Основной источник |
| `source_id` | VARCHAR | ID источника (rbc, lenta...) |
| `url` | TEXT | Оригинальный URL |
| `url_normalized` | TEXT | Нормализованный URL |
| `content_hash` | TEXT UNIQUE | MD5 для дедупликации |
| `all_sources` | TEXT[] | Все источники (дубликаты) |
| `source_count` | INTEGER | Количество источников |
| `published_at` | TIMESTAMP | Дата публикации |
| `sentiment` | VARCHAR | positive / negative / neutral |
| `matched_tags` | TEXT[] | Теги из smart matching |
| `fetched_at` | TIMESTAMP | Когда собрана |
| `created_at` | TIMESTAMP | Когда создана запись |

#### `users` — Пользователи
| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID PK | Уникальный ID |
| `email` | VARCHAR UNIQUE | Email |
| `password_hash` | VARCHAR | bcrypt хеш |
| `username` | VARCHAR | Имя пользователя |
| `is_verified` | BOOLEAN | Email подтверждён |
| `is_admin` | BOOLEAN | Админ |
| `subscription_active` | BOOLEAN | Premium активен |
| `subscription_expires_at` | TIMESTAMP | Окончание Premium |
| `news_count` | INTEGER | Лимит новостей |
| `created_at` | TIMESTAMP | Дата регистрации |

#### `portfolios` — Теги пользователя
| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID PK | Уникальный ID |
| `user_id` | UUID FK → users | Пользователь |
| `tag_id` | VARCHAR | ID тега (tesla, sber...) |
| `tag_name` | VARCHAR | Имя тега |
| `tag_type` | VARCHAR | company / sector / trend |
| `created_at` | TIMESTAMP | Дата добавления |

#### `user_news_reads` — Прочитанные новости
| Колонка | Тип | Описание |
|---------|-----|----------|
| `user_id` | UUID FK | Пользователь |
| `news_id` | UUID FK | Новость |
| `read_at` | TIMESTAMP | Когда прочитана |

#### `smart_tag_cache` — Кэш LLM
| Колонка | Тип | Описание |
|---------|-----|----------|
| `text_hash` | VARCHAR(64) PK | Хеш текста |
| `tags` | TEXT[] | Результат matching |
| `created_at` | TIMESTAMP | Дата кэширования |

### Индексы
```sql
-- Дедупликация
CREATE UNIQUE INDEX news_content_hash_unique ON news(content_hash);

-- Поиск по тегам
CREATE INDEX news_matched_tags_idx ON news USING GIN(matched_tags);

-- Фильтр по времени
CREATE INDEX news_published_at_idx ON news(published_at DESC);
```

---

## API Endpoints

### Auth
| Method | Endpoint | Описание |
|--------|----------|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| GET | `/api/auth/me` | Профиль |

### News
| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/news` | Непрочитанные по тегам |
| GET | `/api/news?all=true` | Все по тегам |
| GET | `/api/news/global` | Все новости (без фильтра, публичный) |
| GET | `/api/news/:id` | Детали статьи (для NewsDetailModal) |
| GET | `/api/news/:id/tag-enrichments` | Enriched данные по тегам статьи |
| POST | `/api/news/:id/read` | Отметить прочитанной |
| GET | `/api/news/search?q=...&tag=...` | Поиск по новостям |
| GET | `/api/news/tags/:tagId` | Новости по тегу |

### User
| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/user/profile` | Профиль |
| GET | `/api/user/tags` | Мои теги |
| POST | `/api/user/tags` | Добавить тег |
| DELETE | `/api/user/tags/:id` | Удалить тег |
| GET | `/api/user/tags/related?tag=X` | Связанные теги |

### Admin (debug)
| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/debug-db` | Статистика БД |
| GET | `/tag-stats` | Статистика тегов |
| GET | `/backfill-tags` | Перетегировать старые |
| POST | `/trigger-rss` | Запустить RSS сбор |

---

## Git Workflow

### Sandbox (локальная среда)
```
/mnt/agents/projects/
├── backend/     ← git: vladfa2010/pulse (main)
└── frontend/    ← git: vladfa2010/pulse-frontend (main)
```

### Push-доступ
- **Frontend:** `origin → https://TOKEN@github.com/vladfa2010/pulse-frontend.git`
- **Backend:** `origin → https://TOKEN@github.com/vladfa2010/pulse.git`

### Правило синхронного обновления
- Backend и frontend — один проект
- Commit'ы должны идти парами (если изменения касаются обоих)
- Указывать hash обоих commit'ей после push
- ❌ ЗАПРЕЩЕНО push'ить только один репозиторий

### Команды
```bash
# Frontend
cd /mnt/agents/projects/frontend
git add -A
git commit -m "type: description"
git push origin main

# Backend
cd /mnt/agents/projects/backend
git add -A
git commit -m "type: description"
git push origin main
```

---

## ⚠️ Критические проблемы и решения

### Backend на Render подключён к НЕПРАВИЛЬНОМУ репозиторию
**Причина:** pulse-app был подключён к `pulse-frontend` вместо `pulse`
**Симптом:** Backend работает, но данные не сохраняются (нет API routes)
**Решение:** В Render Dashboard → pulse-app → Settings → Git Repository → сменить на `https://github.com/vladfa2010/pulse`

### PostgreSQL: таблицы не создаются
**Причина:** `schema.sql` не копируется в `dist/models/` при сборке
**Симптом:** `relation "users" does not exist`
**Решение:** Dockerfile должен содержать `RUN mkdir -p dist/models && cp src/models/schema.sql dist/models/schema.sql`

### PostgreSQL: login падает с 500
**Причина:** Нет колонки `is_admin` в таблице users
**Симптом:** `Login failed` (HTTP 500)
**Решение:** Миграция при старте: `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`

### Frontend: белая страница
**Причина:** Неправильный `base` в `vite.config.ts`
**Решение:** `base` должен быть `'/'` для Render, `'/pulse-frontend/'` для GitHub Pages

### Backend: 30-sec warmup
**Причина:** Render free plan засыпает после 15 мин бездействия
**Решение:** Первый запрос медленный, последующие — быстрые

### Git push: timeout
**Причина:** GnuTLS error в sandbox
**Решение:** Git config `http.version HTTP/1.1`

---

## Переменные окружения (.env.example)

### Frontend
```env
VITE_API_URL=https://pulse-api-bsov.onrender.com
```

### Backend — Локальная разработка (SQLite)
```env
PORT=3000
USE_SQLITE=true
JWT_SECRET=your-secret-key
YOOKASSA_SHOP_ID=54401
YOOKASSA_SECRET_KEY=test_secret_key
KIMI_API_KEY=your-kimi-api-key
SENDGRID_API_KEY=your-sendgrid-key
TELEGRAM_BOT_TOKEN=your-bot-token
```

---

## Тестовые учетные данные

| Поле | Значение |
|------|----------|
| **Email** | `vladfa@ya.ru` |
| **Пароль** | `!1234567890` |

Используются для входа на production: https://pulse-frontend-jt53.onrender.com
### Backend — Production (Render PostgreSQL)
```env
DATABASE_URL=postgresql://pulse_user:PASSWORD@dpg-xxx/pulse_xxx
JWT_SECRET=your-secret-key
FRONTEND_URL=https://pulse-frontend-jt53.onrender.com
YOOKASSA_SHOP_ID=54401
YOOKASSA_SECRET_KEY=test_secret_key
KIMI_API_KEY=your-kimi-api-key
SENDGRID_API_KEY=your-sendgrid-key
TELEGRAM_BOT_TOKEN=your-bot-token
```
