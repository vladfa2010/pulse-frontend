# Лента новостей (/feed)

> Страница `src/pages/NewsFeed.tsx` — лента всех новостей + поиск по ним.
> Поисковая выдача с ТЗ-213/ТЗ-214/ТЗ-215 (01.11.2026) состоит из четырёх разделов:
> «Прямое сходство» (exact), «По смыслу» (семантика), «Курсы по теме»
> и «Уроки по теме». Бэкенд-контракт — ниже и в `pulse-backend/docs/embeddings.md`.

---

## Доступ и состояния

- Только для авторизованных: гость видит заглушку с кнопкой «Войти».
- Загрузка — единый спиннер (скелетонов нет, решение ТЗ-213).
- Пустые состояния: «Ничего не найдено» (поиск, пусты оба раздела) /
  «Новостей пока нет» (обычная лента без фильтра).
- Локальный стейт (без React Query): `articles`, `semantic`, `searchCourses`,
  `searchTotal`, `filter`, `activeTagId`. Инвалидация ключей страницу не
  обновляет — единственный внешний слушатель: событие `news:deleted`
  (удаление новости админом из NewsDetailModal убирает карточку).

## Поток данных

1. `filter` (строка поиска) пишется в URL (`?q=`) внутри debounce 600 мс,
   `replace` — историю не засоряет. `parseFeedParams`/`buildFeedParams`.
2. Через 600 мс после последнего изменения: пустой `filter` → `loadArticles`
   (`/news?all=true` или `/news/tags/:id`), иначе → `loadArticlesSearch`
   (`/news/search?q=…&limit=50[&tag=…]`).
3. Debounce 600 мс — осознанный: семантика дёргает TEI на каждый запрос
   (ТЗ-213), частоту держим низкой.

## Разделы поисковой выдачи

Все четыре раздела приходят **одним запросом** `GET /api/news/search`:

```json
{
  "articles": [ … ],              // exact, match_type='exact'
  "total": 94, "page": 1, "hasMore": true,
  "semantic": { "articles": [ … ], "total": 39, "hasMore": true } | null,
  "courses":  [ { …CourseCard…, "similarity": 0.70 } ] | null,
  "lessons":  [ { "lesson_id", "title", "course_slug", "course_title",
                  "duration_min", "cover_url", "similarity" } ] | null
}
```

Поля `semantic`, `courses` и `lessons` опциональны и независимы: `null` — раздел
целиком не рендерится (ни заголовка, ни плейсхолдера). Клиентский разбор —
`data.semantic ?? null`, `data.courses?.length ? … : null`,
`data.lessons?.length ? … : null`.

### 1. «Прямое сходство» — exact

- Заголовок раздела (`SearchSectionHeader` в NewsFeed.tsx): серый label,
  pill-счётчик = `total`, градиентная линия, заметка «слова запроса есть в
  тексте · подсвечены» (скрыта ≤640px через `hidden sm:block`).
- Сетка `news-feed-grid` (3 колонки, см. `docs/carousels.md`), карточки
  `NewsCard` с `highlightQuery` — подсветка слов запроса.
- Word-AND точной ветки (ТЗ-163): слова ≥2 символов, каждое в любом из 4
  полей; фолбэк — подстрока целиком.

### 2. «По смыслу» — семантика новостей (ТЗ-213)

- Запускается **всегда** при PG-режиме и `q ≥ 4` символов (гейт «до лимита
  страницы» снят; до ТЗ-213 семантика лишь добивала exact до `limit`).
- Порция — 6 карточек (`SEMANTIC_PAGE_SIZE`), независимая пагинация:
  кнопка «Ещё по смыслу» → повторный запрос с `semantic_offset += 6`
  (остальные параметры те же), возвращённые карточки **дописываются** в
  конец раздела (клиентский дедуп по id поверх серверного дедупа vs exact).
  Точные не перезапрашиваются и не перерисовываются.
- `semantic.total` — честное число кандидатов kNN top-50 **после дедупа**,
  не глобальный COUNT; `hasMore = offset + articles.length < total`.
- Чип на карточке: «по смыслу · N%» (`similarity × 100`, округление).
- TEI недоступен/таймаут (5 с, `SEMANTIC_SEARCH_TIMEOUT_MS`) → `semantic:
  null` молча, точные не страдают. SQLite-режим и `q < 4` → тоже `null`.
- Заголовок раздела — циановый (`SearchSectionHeader cyan`), заметка
  «найдено векторным поиском · слов запроса в тексте может не быть».

### 3. «Курсы по теме» — карусель курсов (ТЗ-214)

- Только при `courses.length > 0`. До 6 курсов, пагинации нет.
- **Один вызов TEI на запрос**: query-вектор общий с семантикой новостей
  (второй `embedBatch` запрещён — векторизация поднята на уровень роута).
- Подбор: косинус `courses.embedding` ↔ query-вектор, фильтры
  `published + deleted_at IS NULL + visibility='public' + embedding IS NOT NULL`,
  топ-50 → порог `similarity >= 0.5` (`COURSE_SEARCH_MIN_SIM`) → топ-6
  **среди прошедших порог** (не топ-6 с отбраковкой).
- Каждый курс: полный набор CourseCard (slug, title, cover_url, type, size,
  price, badges, category, source_title, lessons_count, total_minutes,
  students_count) + `similarity` (в API для калибровки, на карточке не
  показывается). Счётчики — `::int` (паритет типов с витриной).
- Карусель — существующий паттерн `.row-scroll` (слот 280px, нативный
  скролл/свайп, скроллбар скрыт). Карточки — общий `CourseCard`
  (`src/components/CourseCard.tsx`, вынесен из Education.tsx — одна карточка
  на витрине и в поиске, критерий 7 ТЗ-214).
- Клик по карточке → `/education/{slug}`; пилюля категории в поисковом
  контексте ведёт на витрину `/education` (витринного фильтра в ленте нет).
- Фичефлаг бэкенда `SEARCH_COURSES_ENABLED` (env, дефолт true): `false` →
  поля `courses` нет и SQL к courses не выполняется (откат без деплоя).

### 4. «Уроки по теме» — карусель уроков (ТЗ-215)

- Только при `lessons.length > 0`. До 4 уроков, пагинации нет.
- **Тот же query-вектор** — третий потребитель общего `embedBatch`
  (новости → курсы → уроки); второго вызова TEI по-прежнему нет.
- Подбор бэкендом: векторы уроков — `lesson_embeddings.vector` **BYTEA**
  (float32 LE ×1024, пакетный KG-контур), pgvector `<=>` недоступен →
  десериализация через `bufferToVector` и косинус в Node через `cosine`
  (оба экспортированы из `knowledgeGraph.ts`). Полный перебор дёшев
  (уроков десятки). Фильтры: курсы `published + deleted_at IS NULL +
  visibility='public'`; колонки `visibility` у `course_lessons` **нет**
  (схема: `is_free_preview`/`unlock_after_days`) — фильтровать скрытые
  уроки нечем (v1.2).
- Порог `similarity >= 0.6` (`LESSON_SEARCH_MIN_SIM`; история калибровки:
  0.55 → 0.65 → измерение (max релевантных 0.6251) → 0.55 → **0.6** —
  решение владельца, баланс полноты/точности). На большинстве запросов
  раздел пуст (маленький каталог) — штатно; калибровка одной константой.
- Карточка — `src/components/SearchLessonCard.tsx`: обложка курса 40×40
  (нет — градиент-заглушка с инициалом), заголовок 12.5px/600 в 2 строки,
  мета-строка: плашка «Урок» + «из курса «{title}»» + «≈N мин».
- **Клик → `/education/{course_slug}`** (страница курса, НЕ урока) — гейт
  урока `checkLessonAccess` (аноним 401 / не записан 403) не обходится.
- Карусель — `.row-scroll.lessons` (слот 300px; базовый `.row-scroll` —
  280px, модификатор по образцу `.row-scroll.paths`).
- Фичефлаг бэкенда `SEARCH_LESSONS_ENABLED` (env, дефолт true): `false` →
  поля `lessons` нет и SQL к `lesson_embeddings` не выполняется.

## Фильтры по тегам

Пилюли тегов (показываются при наличии тегов): клик → `activeTagId`, поиск
очищается, лента фильтруется `/news/tags/:id`. Кнопка «Все» — сброс.
`TagEnrichment` — карточка обогащения по выбранному тегу.

## Каскады

Разъезд панели под сеткой — `CascadeExpandProvider`/`CascadeExpandContainer`
(ТЗ-101), инварианты и фичефлаг `VITE_CASCADE_EXPAND` — `docs/carousels.md`.
Провайдер стоит на странице; карточки в обёртке `CascadeStackCard`
(`data-newsfeed-card`).

## Связанные файлы

| Файл | Назначение |
|------|-----------|
| `src/pages/NewsFeed.tsx` | Страница: стейт, загрузка, четыре раздела, `SearchSectionHeader`. |
| `src/components/NewsCard.tsx` | Карточка новости; чип «по смыслу · N%» при `match_type='semantic'`. |
| `src/components/CourseCard.tsx` | Общая карточка курса (витрина + поиск), тип `CourseCardData`. |
| `src/components/SearchLessonCard.tsx` | Компактная карточка урока раздела «Уроки по теме» (ТЗ-215). |
| `src/pages/Education.tsx` | Витрина — второй потребитель CourseCard. |
| `src/index.css` | `.news-feed-grid`, `.row-scroll` (+`.lessons` 300px), `.edu-card`. |
| `pulse-backend/src/routes/news.ts` | `/api/news/search`: exact (ТЗ-163), семантика (ТЗ-161/213), курсы (ТЗ-214), уроки (ТЗ-215). |
| `pulse-backend/src/config/courseSearch.ts` | Фичефлаги `SEARCH_COURSES_ENABLED`, `SEARCH_LESSONS_ENABLED`. |
| `pulse-backend/src/services/education/knowledgeGraph.ts` | Хелперы `bufferToVector`/`cosine` (export с ТЗ-215). |
| `pulse-backend/docs/embeddings.md` | Продюсеры/потребители векторов, история порогов таймаута. |
| `docs/carousels.md` | Сетка ленты, обёртки карточек, механика каскадов. |

## История изменений

- **01.11.2026, ТЗ-215:** четвёртый раздел «Уроки по теме» — `SearchLessonCard`
  (до 4, клик → страница курса), общий query-вектор, косинус по BYTEA в
  Node (`bufferToVector`/`cosine` экспортированы из knowledgeGraph.ts),
  порог 0.6 (история калибровки: 0.55 → 0.65 → измерение max
  0.6251 → 0.55 → 0.6, решение владельца), фичефлаг
  `SEARCH_LESSONS_ENABLED`. Hotfix v1.2:
  убран фильтр `cl.visibility` — колонки у `course_lessons` нет, фильтр
  валил каждый запрос (глушился общим catch, внешне незаметно).
- **01.11.2026, ТЗ-214:** третий раздел «Курсы по теме» — карусель CourseCard
  (6 макс), общий query-вектор с семантикой, порог 0.5, фичефлаг
  `SEARCH_COURSES_ENABLED`.
- **01.11.2026, ТЗ-213:** семантика всегда (гейт «до лимита» снят), разделы
  «Прямое сходство»/«По смыслу», независимая пагинация `semantic_offset`
  (квота 6, кнопка «Ещё по смыслу»), поле `semantic` в ответе, таймаут TEI
  возвращён с 15 с на **5 с** (решение владельца 01.11: семантика теперь на
  каждый запрос — ждать дольше нет смысла).
- **27.10.2026:** таймаут поднимался до 15 с (RAYON=1, embed 4–6 с).
- **16.10.2026, ТЗ-161/163:** гибридный поиск — exact word-AND + семантика,
  добивающая страницу до `limit`; `match_type`/`similarity` в ответе.
