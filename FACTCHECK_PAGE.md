# FACTCHECK_PAGE.md — Страница «Фактчекинг» (/factcheck)

Документ описывает фронтенд ad-hoc фактчекинга по TZ_FACTCHECK_PAGE v1.3.
Актуален под v1: **свитчера видимости нет — все проверки частные**.

---

## 1. Состав страницы

Роут: `/factcheck` (ленивый, `App.tsx`). Файл: `src/pages/FactCheckPage.tsx`.

1. **Шапка** — «Фактчекинг» + подзаголовок о сути фичи.
2. **Композер (chat-style)** — `rounded-2xl`, фон `linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))`,
   рамка `rgba(255,255,255,0.1)`:
   - textarea: Enter — отправка, Shift+Enter — перенос; placeholder «Вставьте текст или ссылку на статью…»;
   - авто-распознавание типа ввода: `/^https?:\/\/\S+$/` → `url`, иначе `text`
     (`detectInputType`, `src/lib/factCheckInput.ts`); прикреплённый файл переопределяет ввод;
   - скрепка: картинки JPEG/PNG/WebP/GIF, файлы PDF/DOC/DOCX/TXT/MD, ≤ 8 МБ
     (`MAX_FILE_SIZE_BYTES`, валидация `fileValidationError`);
   - в нижнем баре заметка с иконкой Lock «Все проверки частные»;
   - под композером подсказка: «Результаты видны только вам. Публикация проверок в общую
     ленту появится в следующих версиях.»;
   - кнопка «Проверить»: `rounded-full`, градиент `90deg #00D4FF → #0099CC`, текст `#001018`.
3. **Одна активная проверка** под формой: превью входа (заголовок + извлечённый текст)
   → `ProgressPanel` (4 этапа, SSE) → результат `ResultTabs` (Анализ / Источники / Оценка)
   + вердикт-бейдж (label · score/100 + verdict). Fallback: polling `GET /api/fact-check/:id`
   каждые 2.5 сек.
4. **Карусель «Мои проверки»** — только авторизованным, акцент `#34D399`, замок на всех
   карточках, пульсирующий синий бейдж «Проверяется» у `queued`/`in_progress`
   (refetch каждые 5 сек, пока есть активные).
5. **Карусель «Все проверки»** — всем, включая гостей, акцент `#00D4FF`, подзаголовок
   «Проверенные новости PULSE».
6. **Модалка детали** (`FactCheckDetailModal`) по клику на карточку: полный результат,
   «Проверяемый текст», у своих — заметка с замком «Частная проверка — видна только вам»,
   у новостей — бейдж «Новость PULSE». Свитчера видимости нет.

Deeplink: `/factcheck?r=<id>` открывает проверку в модалке (параметр чистится из URL).

## 2. Компоненты

| Файл | Назначение |
|---|---|
| `src/pages/FactCheckPage.tsx` | страница: композер, активная проверка, карусели, модалки, гейтинг |
| `src/hooks/useFactCheckRequestSSE.ts` | SSE-подписка на стрим проверки (только слушает; POST отдельно) |
| `src/components/factCheck/FactCheckRequestCard.tsx` | карточка карусели: иконка типа, вердикт-бейдж, замок, дата |
| `src/components/factCheck/FactCheckDetailModal.tsx` | детальная модалка полного результата |
| `src/components/factCheck/AiConsentModal.tsx` | диалог согласия на передачу файла оператору ИИ |
| `src/components/FactCheckHomeBlock.tsx` | блок на главной после `GlobalNewsCarousel` |
| `src/pages/account/DataTab.tsx` | вкладка «Ваши данные» в профиле |
| `src/lib/factCheckInput.ts` | чистые хелперы (тип ввода, файлы, даты, цвета вердикта) + тесты |

Переиспользуются без изменений: `ProgressPanel`, `ResultTabs`, `SourceCard`,
`AssessmentPanel` (`src/components/factCheck/`), `NewsCarousel`, `PremiumPromptModal`,
`useAuthModal`, `AuthModal`.

Типы: `src/types/factCheck.ts` — `FactCheckInputType`, `FactCheckRequestStatus`,
`FactCheckRequestItem`, `FactCheckFeedItem`, `FactCheckListItem`;
в `AssessmentV4` добавлено `verifiable?: boolean` (старые результаты без поля → `true`).
`User` в `useAuth.tsx` — поле `ai_file_consent: boolean` (+ `ai_file_consent_at?`).

## 3. Источники данных (API, все через `src/lib/api.ts`)

| Endpoint | Использование |
|---|---|
| `POST /api/fact-check` | запуск проверки `{input_type, text?/url?/file_base64?, file_name?, mime?}` (без `is_public`). 201 queued / 200 reused с `result` / 400 валидация / 403 `upgrade_required`\|`consent_required` / 422 `extraction_failed`\|`not_verifiable` |
| `GET /api/fact-check/feed?limit&offset` | общая лента (публичная; v1 — только проверенные новости PULSE) |
| `GET /api/fact-check/my?limit&offset` | мои проверки (auth): ad-hoc + новости из истории заказов |
| `GET /api/fact-check/:id` | полная запись (owner всё; fallback polling; детали модалки) |
| `GET /api/fact-check/:id/stream?token=` | SSE-прогресс: `{stage,payload,timestamp}`, `complete`, `error` |
| `PUT /api/user/ai-consent {granted}` | выдача/отзыв согласия |
| `GET /auth/me` | флаг `ai_file_consent` |

`PATCH /api/fact-check/:id/visibility` — заглушка 403 в v1, в UI не используется.

## 4. Гейтинг и consent

- Гость: «Проверить» или скрепка → `AuthModal` (login).
- Free: → `PremiumPromptModal` («Фактчекинг — на Premium», CTA `/pricing`).
  Клиентская проверка тарифа — `isPaidFeatureAccessible(user)` (как в новостном
  `FactCheckSection`); сервер дублирует гейт (`403 upgrade_required`).
- Скрепка без согласия (`!user.ai_file_consent`) → `AiConsentModal` (карточка `#111111`,
  рамка `#222`, иконка в круге 64px `rgba(0,212,255,0.1)`, ссылка `/privacy`, чекбокс
  «Согласен на передачу файлов оператору ИИ для извлечения текста. Понимаю риски»;
  кнопка неактивна без чекбокса). После подтверждения: `PUT /api/user/ai-consent`
  → `refreshUser()` → file picker.
- `403 consent_required` от сервера → тот же диалог.
- 422 `not_verifiable` / `extraction_failed` / 400 → дружелюбный тост под формой
  (жёлтый, автоскрытие 8 с) с предложением вставить текст вручную.
- Профиль → «Ваши данные»: переключатель согласия + дата выдачи, отзыв с
  подтверждающим диалогом («новые загрузки файлов станут недоступны»), мгновенный.

## 5. Чего нет в v1 (намеренно)

- Свитчер «Видимо / Частно» и поле `is_public` в запросах — все проверки частные.
- Пользовательские проверки в общей ленте (п.2.4 TZ; лента = только новости PULSE).
- Лимиты на количество проверок, уведомления о результате, модерация.

## 6. Тесты

`src/lib/__tests__/factCheckInput.test.ts` — чистые функции: определение типа ввода
(URL-распознавание), тип прикреплённого файла по расширению/MIME, валидация лимита 8 МБ,
цвета вердикта, форматирование дат. Гейтинг тарифа покрыт существующими тестами
`subscription.test.ts`.
