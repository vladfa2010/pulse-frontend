# SEO (ТЗ-140)

SEO-контур курсов LMS: build-time пререндер статических HTML для витрины и карточек + клиентская мета через react-helmet-async. Актуально на HEAD после ТЗ-140 (12.10.2026, фронт `683ca7c`, бэкенд-конфиг `eeaaafc`).

## Архитектура

Подход — **build-time пререндер** (выбран в ТЗ-140 вместо серверной инъекции): мета и контент курсов вставляются в статические файлы при сборке фронта. Без правок инфраструктуры, одинаково работает на VPS и Render. Trade-off: мета обновляется только пересборкой (см. «Регламент»).

Поток данных: `vite build` → шелл `dist/index.html` → `scripts/seo-prerender.mts` (tsx) тянет живой API продa → пишет `dist/education/index.html`, `dist/education/<slug>/index.html`, `dist/robots.txt`, `dist/sitemap.xml`. Если API недоступен — warning, только статика, exit 0; флаг `--strict` → exit 1 (для CI/ручной пересборки).

## Файлы

- `scripts/seo-prerender.mts` — генератор. Env: `SEO_BASE_URL` (canonical/og/sitemap, дефолт `https://pulse.inside-trade.ru`), `SEO_API_URL` (дефолт тот же домен; ломается для проверки отказоустойчивости).
- `src/lib/seo.ts` — **единый источник формул** меты для пререндера и helmet: `courseTitle` (правило 50–60: `— курс на PULSE` → `| PULSE` → только название), `metaDescription` (~155 симв., обрезка по слову, 150–160, пусто → null), `canonicalCourse`, `absoluteUrl`, `htmlToPlainText`, `decodeEntities`, `escapeHtml`, константы `BASE`, `VITRINE_TITLE`, `VITRINE_DESCRIPTION`, `OG_DEFAULT_IMAGE`. Без React/Node-импортов.
- `src/pages/Education.tsx`, `CoursePage.tsx`, `LessonPage.tsx`, `Home.tsx` — `<Helmet>` с метой из `seo.ts`. Helmet нужен для SPA-навигации; без JS те же значения отдаёт пререндер.
- `index.html` — статичного canonical больше нет (был врущим «на /» со всех страниц).
- Бэкенд `deploy/Caddyfile` — `try_files {path} {path}/index.html /index.html` в финальном `handle`. Без `{path}/index.html` Caddy сваливает директории пререндера в SPA-fallback и отдаёт шелл (инцидент приёмки ТЗ-140, 12.10.2026).

## Что генерируется

**Карточка курса** (`/education/<slug>`, без слеша и со слешем — оба работают через Caddy):
- `<head>`: title по формуле (без цен/бейджей/версии), meta description (нет описания — тега нет), ровно один canonical, OG в начале head после `<meta charset>` (краулер Meta парсит ~первые 60 КБ): og:title/description/type=website/url/site_name=PULSE/image (абсолютный, fallback `/og-default.png`)/locale=ru_RU/image:alt + twitter:card=summary_large_image. Версию `v8.6.21` из title шелла карточки не несут.
- JSON-LD: `Course` (name, plain-text description, provider=Organization PULSE, `offers` price RUB — price=0 валидно, null → offers опускается, image, `syllabusSections` с названиями уроков) + `BreadcrumbList` (Главная → Образование → курс). **Ничего не выдумываем**: aggregateRating/число учеников не включаем — источника нет.
- Тело `<div id="root">`: статический блок (`<h1>`, 1–3 абзаца plain text, `<h2>Программа курса</h2>` + `<ol>` уроков «N. название (M мин)», автор и цена мелким, ссылка на /education). Только plain text через escapeHtml — HTML-описание как есть не вставляется (XSS). React 18 при старте очищает контейнер — пользователь блок не видит, краулер без JS получает полную страницу. Это graceful degradation, не клоакинг: источник данных один (API).

**Витрина** (`/education`): h1 «Образование», `<ul>` из `<a href="/education/<slug>">` (настоящий краул-граф без JS) + JSON-LD `ItemList` (position 1..n, абсолютные уникальные url, вложенный Course name+provider) — основание карусели Course List.

**robots.txt** — фиксированный: Allow /, Disallow /admin /profile /api/, строка Sitemap.
**sitemap.xml** — статика (`/`, `/education`, `/pricing`, `/instructions`, `/sentiment`, `/download`) + все публичные курсы с `<lastmod>` из `created_at` **витрины** (в детальном ответе курса `created_at` нет — только витрина его отдаёт).

## Критерий включения курса

Эндпоинт витрины сам отдаёт только `status='published' AND deleted_at IS NULL`; на фронте дополнительно отсекаем только `visibility !== 'public'`. Дедуп по slug (полки hot/recommended/fresh + catalog).

## Клиентская мета (helmet)

- `/education` — VITRINE_TITLE + общий description + canonical /education.
- `/education/:slug` — формулы из seo.ts; `visibility === 'hidden'` → `noindex, follow`.
- `/education/lesson/:id` — `noindex, follow` + canonical на карточку курса (slug из payload урока `course_slug`; параметра slug в маршруте нет). Уроки не индексируем — контент дублирует курс.
- `/` — canonical на себя (одна строка в Home.tsx).
- `NewsDetailModal` (новости, вне зоны ТЗ-140): ищет `link[rel="canonical"]`, при отсутствии создаёт, на закрытие удаляет/восстанавливает — адаптация под удалённый статичный canonical из шаблона.

## Регламент

- **Публикация/правка курса → пересборка фронта.** Мета и sitemap обновляются только при сборке. Курсов мало (6 на 12.10.2026) — пересборка руками. Когда станет больно: cron-пересборка по расписанию (ISR-паттерн) или серверная инъекция через backend-эндпоинт + маршрут Caddy `/education/*` (отдельное ТЗ; даст и настоящие 404 вместо soft-404).
- Деплой фронта — стандартный (DEPLOYMENT.md, VPS): сборка `VITE_TOPICS_ENABLED=true npm run build` (пререндер внутри) → tar → scp → распаковка.

## Проверка после деплоя

```bash
# карточка: title/canonical/OG/JSON-LD/h1/уроки без JS
curl -s https://pulse.inside-trade.ru/education/<slug> | grep -o '<title>[^<]*</title>'
curl -s https://pulse.inside-trade.ru/education/<slug> | grep -c 'rel="canonical"'   # ровно 1
# витрина
curl -s https://pulse.inside-trade.ru/education | grep -o '<h1>[^<]*</h1>'
# robots/sitemap
curl -sI https://pulse.inside-trade.ru/sitemap.xml | grep -i content-type   # text/xml
curl -s https://pulse.inside-trade.ru/robots.txt | grep Sitemap
```

Отказоустойчивость сборки: `SEO_API_URL=http://127.0.0.1:9 npm run build` → exit 0 + warning, sitemap без курсов; `--strict` → exit 1. Валидатор разметки — validator.schema.org (Rich Results Test по Course не требуем: Google убрал course-info rich result в июне 2025; BreadcrumbList там проверять можно).

## Риски и открытые вопросы

- **Soft-404 не лечится**: несуществующий slug отдаёт 200 со шеллом. Митигация: sitemap + canonical + мониторинг Search Console → Pages → Soft 404 через 2–4 недели после деплоя.
- **Устаревание пререндера** — см. Регламент.
- **Service worker** — не перехватывает fetch (только push), навигацию не ломает. При появлении fetch-обработчика проверить исключения для `/education`.
- **Cloaking-проверка на приёмке**: статический блок должен дублировать CSR-контент (один источник — API).
- **Search Console (владелец)**: DNS-проверка домена, «Запросить индексирование» для /education и двух карточек, отправить sitemap.xml, мета `google-site-verification` добавляется в index.html без пересборки пререндера (helmet-страница или статический файл).
- Render-зеркало собирается из того же main — пререндер попадает автоматически; canonical/og:url жёстко указывают на pulse.inside-trade.ru (индексируемый канал один, осознанно).
