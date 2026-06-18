# PULSE — Admin Dashboard

> **Версия:** 8.7.0
> **Дата:** 2026-06-18
> **Файлы:** `src/pages/Admin.tsx`, `src/lib/api.ts`, `src/pages/admin/UsersTab.tsx`, `src/pages/admin/UserDetailModal.tsx`, `src/pages/admin/TagsTab.tsx`, `src/pages/admin/TagDetailModal.tsx`, `src/components/admin/EditableCard.tsx`, `src/components/admin/TagChipsInput.tsx`, `src/components/admin/TagTypeSelect.tsx`

---

## 1. ОБЗОР

Admin Dashboard — встроенная панель мониторинга LLM pipeline. Показывает метрики обработки новостей, ошибки LLM, графики и инструменты для ручного управления.

**Доступ:** только пользователи с `is_admin=true` в JWT токене. Не-админы редиректятся на `/`.

**URL:** `/admin` (HashRouter: `/#/admin`)

---

## 2. ЧТО РЕАЛИЗОВАНО

### 2.1 KPI Карточки (4 шт.)

| Карточка | Данные | Цветовая индикация |
|----------|--------|-------------------|
| **Success Rate** | `batches_success / batches_total` в процентах | Зелёный ≥90%, жёлтый ≥70%, красный <70% |
| **Batches** | `batches_total` | Синий (#60A5FA) |
| **Articles Processed** | `articles_processed` | Зелёный (#34D399) |
| **Queue** | `manual_queue` (статьи >3 попыток) | Красный (#EF4444) если >0 |

Subtitle на каждой карточке: `✓ {success} ~ {partial} ✗ {failed}`

### 2.2 SVG-график Success Rate (12 часов)

- **Тип:** линейный график, 100% SVG (без внешних библиотек)
- **Данные:** `hourly_trend` из `/admin/llm-dashboard`
- **Особенности:**
  - Grid lines (серые, 20% opacity)
  - Area fill под линией (градиент зелёный → прозрачный)
  - Hover tooltip: показывает hour + success/failed/partial
  - Линия зелёная (#34D399), stroke-width: 2

### 2.3 CSS-бары Errors by Type

- Горизонтальные прогресс-бары
- Максимум = max(count) среди всех типов ошибок
- Цвета по типу:
  - `llm-timeout` → #FBBF24 (жёлтый)
  - `llm-rate-limit` → #F59E0B (оранжевый)
  - `llm-parse` → #EF4444 (красный)
  - `llm-empty` → #9CA3AF (серый)
  - остальные → #EF4444 (красный)

### 2.4 Таблица Problem Articles

- **Колонки:** Title | Error | Atm | Last Retry | Tags | Actions
- **Фичи:**
  - Multi-select чекбоксы на каждой строке
  - Bulk Retry / Ignore — для выбранных
  - Raw Preview Modal — кнопка 👁, открывает JSON через Portal
  - CSV Export — скачивание всех failed статей

### 2.5 Raw Preview Modal

- React Portal → `document.body`
- Показывает `llm_raw_preview` (JSON, formatted)
- 80vw × 80vh, backdrop с затемнением
- ESC или кнопка X — закрыть

### 2.6 Backfill UI

- Поле ввода: тег (например, `"apple"`) или список ID через запятую
- Кнопка "Run Backfill"
- Результат: `processed`, `succeeded`, `failed`

### 2.7 Cleanup Failed Articles UI

Кнопка **"Удалить ошибки"** в правом верхнем углу вкладки **LLM Metrics**.

**Flow:**
```
[Кнопка "Удалить ошибки"]
           │
           ▼
[Модалка подтверждения]
"Будут удалены все статьи с LLM-ошибками (N шт.)"
           │
           ▼
[POST /cleanup-failed-articles]
           │
           ▼
[Модалка успеха]
"Ошибки удалены. Удалено N статей."
```

**Поведение:**
- Кнопка видна только на вкладке **LLM Metrics**
- Disabled, если `total_failed === 0`
- Использует admin JWT (не требует `x-trigger-secret`)
- После успеха автоматически обновляет метрики (`loadData`)

**Важно:** удаляются только статьи с `llm_error IS NOT NULL`. Успешно обработанные статьи не трогаются.

### 2.7 Users Tab (3-я вкладка)

**Файлы:** `src/pages/admin/UsersTab.tsx`, `src/pages/admin/UserDetailModal.tsx`

#### UsersTab — таблица всех пользователей

| Колонка | Что показывает |
|---------|---------------|
| **User** | Аватар + username + email |
| **Status** | `admin` (жёлтый) / `blocked` (красный) / `active` (зелёный) |
| **Sub** | Дней до окончания подписки |
| **Tags** | Количество тегов в портфолио |
| **Reads** | Прочитанных статей |
| **Paid** | Количество платежей |
| **Amount** | Общая сумма платежей (RUB) |
| **Actions** | Toggle Admin / Toggle Block |

**Summary row:** {N} users · {N} subscribed · {N} blocked · {total} RUB

#### UserDetailModal — карточка пользователя

Открывается по клику на строку в таблице. React Portal → `document.body`.

| Секция | Данные |
|--------|--------|
| **Header** | Username, email, кнопки Toggle Admin / Toggle Block |
| **Metrics** | Subscription (дней), Total Paid, Tags count, Articles Read |
| **Channels** | Telegram ON/OFF, Email ON/OFF, Last login |
| **Activity Chart** | SVG bar chart — входы за 30 дней (`user_news_reads`) |
| **Tags** | Все теги из `portfolios` |
| **Payments** | Таблица: дата, сумма, статус, метод |
| **Reset Password** | Поле ввода + кнопка "Set Password" (bcrypt hash) |

**Действия админа:**
- **Toggle Admin** — назначить/снять `is_admin` (нельзя для себя)
- **Toggle Block** — заблокировать/разблокировать `is_blocked` (нельзя для себя)
- **Reset Password** — установить новый пароль (min 6 chars, bcrypt)

### 2.8 Tags Tab (4-я вкладка)

**Файлы:** `src/pages/admin/TagsTab.tsx`, `src/pages/admin/TagDetailModal.tsx`, `src/components/admin/EditableCard.tsx`, `src/components/admin/TagChipsInput.tsx`, `src/components/admin/TagTypeSelect.tsx`

#### TagsTab — таблица всех тегов

| Колонка | Что показывает |
|---------|---------------|
| **Tag** | Название тега + ID |
| **Type** | company / sector / country / commodity / index |
| **Articles (30d)** | Количество статей за 30 дней |
| **Subscribers** | Количество подписчиков |
| **Keywords** | Количество ключевых слов |
| **Created** | Дата создания |

**Search:** фильтр по названию тега (client-side).

**Клик на строку** → открывает TagDetailModal.

---

#### TagDetailModal — карточка тега с inline editing

Открывается по клику на строку в таблице. React Portal → `document.body`.

**Все 11 секций карточки:**

| # | Секция | Редактирование | Пустое значение |
|---|--------|---------------|-----------------|
| 1 | **Type** | Dropdown (company/sector/country/commodity/index/**person**) | — |
| 2 | **Ticker** | Text input (auto-uppercase) | "Not set" |
| 3 | **Website** | Text input (auto-add `https://`) | "Not set" |
| 4 | **Description** | Textarea (max 5000 символов) | "Not set" |
| 5 | **Key Products** | Tag chips (+ Enter, − ×, min 0) | "Not set" |
| 6 | **Keywords** | Tag chips (+ Enter, − ×, **min 1**) | — |
| 7 | **Related Tags** | Tag chips (+ Enter, − ×, max 20) | "Not set" |
| 8 | **Synonyms (RU)** | Tag chips (+ Enter, − ×, max 20) | "Not set" |
| 9 | **Synonyms (EN)** | Tag chips (+ Enter, − ×, max 20) | "Not set" |
| 10 | **Activity Chart** | SVG bar chart, 30 дней | "No data" |
| 11 | **Recent Articles** | Список с sentiment score | — |
| 12 | **Subscribers** | Список подписчиков | — |
| — | **Backfill** | Кнопка — пересчёт LLM-анализа | — |

---

#### Inline Editing — как работает

**Принцип:** Каждая секция — `EditableCard`. При наведении появляется карандаш (Pencil). Клик → режим редактирования.

**UI режимов:**
```
[Просмотр]          [Редактирование]         [Сохранение]
┌─────────────┐    ┌─────────────────┐      ┌─────────────┐
│ Ticker   [✎]│    │ Ticker  [✓] [✗]│      │ Ticker ...  │
│ SBER        │    │ ┌─────────────┐ │      │ Saving...   │
└─────────────┘    │ │ SBERA       │ │      └─────────────┘
                   │ └─────────────┘ │
                   └─────────────────┘
```

**Компоненты:**

| Компонент | Файл | Назначение |
|-----------|------|-----------|
| `EditableCard` | `EditableCard.tsx` | Обертка: view ↔ edit, hover pencil, save/cancel, цветные рамки |
| `TagChipsInput` | `TagChipsInput.tsx` | Чипсы: Enter/Comma добавить, × удалить, Backspace удалить последний |
| `TagTypeSelect` | `TagTypeSelect.tsx` | Dropdown: company/sector/country/commodity/index |

**Состояния карточки:**

| Состояние | Визуал | Длительность |
|-----------|--------|-------------|
| Просмотр | Серая рамка (#222) | Постоянно |
| Hover | Карандаш появляется | Пока hover |
| Редактирование | Жёлтая рамка (#FBBF24) | Пока edit |
| Сохранение | "Saving..." текст | ~1-2 сек |
| Успех | Зелёная рамка (#34D399) | 2 сек |
| Ошибка | Красная рамка (#EF4444) + текст | Пока не отменят |

**API:**
```
PUT /admin/tags/:tagId
Body: { field: value }  // partial update — только переданные поля
Response: { success, updated_fields, tag }
```

**Хранение:** Все редактируемые поля (кроме `tag_type` и `keywords`) сохраняются в `enriched_data` JSONB. PUT endpoint использует `jsonb_build_object` + `||` для merge (не перезаписывает другие поля).

**Особенности:**
- **Website:** автодобавление `https://` если нет протокола (`spacex.com` → `https://spacex.com`)
- **Keywords:** защита minItems=1 (нельзя удалить последний keyword)
- **Related Tags:** проверка circular reference (нельзя сослаться на самого себя)
- **Description:** max 5000 символов
- **Tag chips:** автодобавление при потере фокуса (blur) — не нужно жать Enter
- **Person тип:** для людей (Илон Маск, Сергей Греф)

### 2.9 Auto-refresh

Каждые 60 секунд автоматически перезагружает данные:
```typescript
useEffect(() => {
  const interval = setInterval(loadData, 60000)
  return () => clearInterval(interval)
}, [])
```

---

## 3. API ENDPOINTS

### GET /admin/llm-dashboard (admin only)

```json
{
  "today": {
    "batches_total": 215,
    "batches_success": 97,
    "batches_partial": 0,
    "batches_failed": 118,
    "success_rate": 45.1,
    "articles_processed": 2041,
    "articles_failed": 1296,
    "manual_queue": 33
  },
  "errors_by_type": [
    {"sentiment_source": "llm-timeout", "count": "95"}
  ],
  "hourly_trend": [
    {"hour": "2026-06-02T16:00:00.000Z", "success": "6", "failed": "7", "partial": "0"}
  ],
  "per_tag": [
    {"tag": "россия", "articles": "161", "success": "106"}
  ]
}
```

### GET /admin/llm-errors?limit=50&hours=24 (admin only)

```json
{
  "total_failed": 95,
  "by_type": [{"sentiment_source": "llm-timeout", "count": "95"}],
  "manual_queue_count": 33,
  "recent": [
    {
      "id": "...",
      "title_ru": "...",
      "published_at": "2026-06-02T16:19:03.000Z",
      "sentiment_source": "llm-error",
      "llm_error": "timeout of 30000ms exceeded",
      "llm_attempts": 1,
      "llm_raw_preview": null,
      "matched_tags": []
    }
  ]
}
```

### POST /cleanup-failed-articles (admin or trigger secret)

Удаляет все новости с `llm_error IS NOT NULL`.

**Авторизация:**
- `x-trigger-secret: <CRON_SECRET_KEY>` — для cron/manual вызовов
- `Authorization: Bearer <admin JWT>` — для вызова из Admin Dashboard

**Запрос из UI:**
```typescript
await adminApi.post('/cleanup-failed-articles', {})
```

**Ответ:**
```json
{ "deleted": 42, "message": "Removed 42 articles with llm_error. Deferred processor queue cleared." }
```

### POST /admin/backfill (admin only)

Тело запроса:
```json
{"tag": "apple"}
// или
{"newsIds": ["id1", "id2"]}
// или
{"tag": "apple", "since": "24h"}
```

Ответ:
```json
{"processed": 10, "succeeded": 8, "failed": 2}
```

### GET /admin/users (admin only)

Возвращает всех пользователей с агрегатами:
- `total_payments` — количество успешных платежей
- `total_amount` — сумма платежей
- `tag_count` — тегов в портфолио
- `active_channels` — подключенных каналов (TG/email)
- `articles_read` — прочитанных статей
- `last_login_at` — из `user_sessions`

### GET /admin/users/:id (admin only)

Полная карточка пользователя:
- User data (включая `is_blocked`, `subscription_auto_renew`)
- Payments: список + `total_amount`
- Tags: из `portfolios`
- Channels: TG/email статус из `user_channels`
- Login history: 30 дней активности
- Notifications: настройки уведомлений

### POST /admin/users/:id/reset-password (admin only)

```json
{"password": "newpassword123"}  // min 6 chars
```

### POST /admin/users/:id/toggle-admin (admin only)

Нельзя изменить свой собственный статус. Возвращает `{ is_admin: boolean }`.

### POST /admin/users/:id/toggle-block (admin only)

Нельзя заблокировать себя. Создаёт `is_blocked` колонку если не существует. Возвращает `{ is_blocked: boolean }`.

### GET /admin/tags (admin only)

Список всех тегов с агрегатами:
```json
{
  "tags": [
    {
      "tag_id": "сбербанк",
      "tag_name": "Сбербанк",
      "tag_type": "company",
      "keywords": ["сбер", "сбербанк"],
      "article_count": 42,
      "subscriber_count": 15,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### GET /admin/tags/:tagId (admin only)

Полная карточка тега:
```json
{
  "tag": {
    "tag_id": "сбербанк",
    "tag_name": "Сбербанк",
    "tag_type": "company",
    "keywords": ["сбер", "сбербанк"],
    "created_at": "2025-01-15T10:00:00Z",
    "related_tags": ["втб", "т-банк"],
    "ticker": "SBER",
    "website": "https://www.sberbank.ru",
    "description": "Крупнейший банк России...",
    "key_products": ["Кредиты", "Депозиты", "Инвестиции"],
    "synonyms_ru": ["сбер"],
    "synonyms_en": ["sberbank"]
  },
  "daily_stats": [...],
  "recent_articles": [...],
  "subscribers": [...]
}
```

### PUT /admin/tags/:tagId (admin only)

Partial update — только переданные поля:
```json
// Request
{"ticker": "SBER", "website": "https://sberbank.ru"}

// Response
{"success": true, "updated_fields": ["ticker", "website"], "tag": {...}}
```

**Хранение:** `tag_type` и `keywords` — отдельные колонки. Всё остальное — в `enriched_data` JSONB (merge через `jsonb_build_object` + `||`).

### GET /debug-tag/:tagId (admin or secret)

Полные данные тега для отладки (без JWT — через `?secret=pulse-dev-key`):
```
GET /debug-tag/sber?secret=pulse-dev-key
```

Возвращает: `tag_id`, `tag_name`, `tag_type`, `keywords`, `enriched_data` (все поля), `stats` (article counts, subscribers).

---

## 4. ФРОНТЕНД

### 4.1 API Client

**Важно:** Admin endpoints на корневом пути `/admin/*`, а не `/api/admin/*`. Обычный `api` клиент добавляет `/api` prefix — для админки используется отдельный `adminApi`:

```typescript
// src/lib/api.ts

// Обычный клиент — для /api/* endpoints
const API_BASE = 'https://pulse-api-bsov.onrender.com/api'
export const api = { get: (path) => request('GET', path), ... }

// Admin клиент — для /admin/* endpoints (без /api prefix)
const ADMIN_BASE = 'https://pulse-api-bsov.onrender.com'
export const adminApi = { get: (path) => adminRequest('GET', path), ... }
```

**⚠️ Баг история:** Изначально `api.get('/admin/llm-dashboard')` шёл на `/api/admin/llm-dashboard` → 404. Все графики были пусты.

### 4.2 Guard

```typescript
// Редирект не-админов
useEffect(() => {
  if (!isLoading && !user?.isAdmin) navigate('/')
}, [isLoading, user, navigate])
```

### 4.3 Layout

- `max-w-7xl mx-auto`
- `pt-24` (отступ под navbar)
- Grid: 4 колонки KPI, 2 колонки (график + бары), полная ширина таблица
- Фон: `#0A0A0A`
- Карточки: `#111111`, border: `#222222`

---

## 5. БАГИ И ФИКСЫ

| # | Баг | Причина | Фикс |
|---|-----|---------|------|
| 1 | Графики пустые | `api` клиент добавлял `/api` prefix → 404 | `adminApi` клиент с root path |
| 2 | Админка 404 | Render Static Site не знает про SPA routes | `HashRouter` (`/#/admin`) |
| 3 | Пустой tooltip | `overflow-hidden` на карточке обрезал tooltip | React Portal → `document.body` |
| 4 | "Нейтрально +0" на всех карточках | Badge показывался даже для keyword fallback | Badge только при `sentiment_source='llm'` или `'llm-partial'` |
| 5 | JWT 401 на admin endpoints | `JWT_SECRET` mismatch: `'dev-secret'` vs `'your-secret-key'` | Унифицирован `'dev-secret'` |
| 6 | Users таб — данные не загружались | `/admin/users` endpoint не существовал | 5 новых endpoints + `is_blocked` колонка |
| 7 | Cleanup требовал `x-trigger-secret` | Нельзя было вызывать из админки | `/cleanup-failed-articles` теперь принимает admin JWT |

---

## 6. МЕТРИКИ КОНТРОЛЯ

```bash
# Проверить что API работает
curl -H "Authorization: Bearer $TOKEN" \
  https://pulse-api-bsov.onrender.com/admin/llm-dashboard

# Проверить batch size (должен быть 5)
curl "https://pulse-api-bsov.onrender.com/llm-analytics?hours=1"

# Проверить версию фронтенда
curl -s https://pulse-frontend-jt53.onrender.com/ | grep -oP 'v\d+\.\d+'
```

### Нормальные показатели
| Метрика | Хорошо | Плохо |
|---------|--------|-------|
| success_rate | > 95% | < 90% |
| batch_size | 5 | > 5 |
| llm-timeout | 0 | > 0 |
| manual_queue | 0 | > 10 |

---

*Документ создан: 2026-06-02*
*Версия 8.7 — Cleanup Failed Articles UI: кнопка "Удалить ошибки", confirm/success модалки, admin JWT auth для /cleanup-failed-articles*
*Версия 8.6 — TagDetailModal: +Synonyms RU/EN, auto-add chips on blur, person type, PUT endpoint, /debug-tag/:tagId*
*Версия 8.4 — добавлен Tags Tab + TagDetailModal с enriched_data*
*Версия 8.3 — добавлен Users Tab + UserDetailModal*
