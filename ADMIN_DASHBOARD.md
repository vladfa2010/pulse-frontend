# PULSE — Admin Dashboard

> **Версия:** 8.2.0
> **Дата:** 2026-06-02
> **Файлы:** `src/pages/Admin.tsx`, `src/lib/api.ts`, `src/components/SentimentTooltip.tsx`

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

### 2.7 Auto-refresh

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
*Последнее обновление: 2026-06-02 (adminApi fix)*
