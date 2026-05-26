# PULSE — Deployment Guide

> Единый документ по инфраструктуре, деплою и окружению.
> Последнее обновление: 2026-05-26

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
