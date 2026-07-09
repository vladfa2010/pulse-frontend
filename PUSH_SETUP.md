# Push-уведомления в PULSE (Firebase Cloud Messaging)

Push-уведомления реализованы через **Firebase Cloud Messaging** и плагин Capacitor `@capacitor/push-notifications`.

Общая конфигурация Firebase (web + Android + Analytics): [`FIREBASE.md`](./FIREBASE.md).  
Детали по Android-сборке: [`ANDROID.md`](./ANDROID.md).  
Детали backend-части: [`../pulse-backend/PUSH_NOTIFICATIONS.md`](../pulse-backend/PUSH_NOTIFICATIONS.md).

---

## Что уже сделано

- Android-приложение собирается с поддержкой push.
- Frontend запрашивает разрешение, получает FCM-токен и отправляет его на backend.
- Реализована надёжная доставка FCM-токена при **cold start**: `PulseMessagingService` сохраняет токен в `SharedPreferences`, а `TokenFlushPlugin` диспатчит его в JS сразу после инициализации Capacitor bridge.
- При старте приложения создаётся notification channel `pulse_default` (`Новости`) через `NotificationChannelSetupPlugin`, чтобы PULSE был виден в Settings → Notifications на Android 13+ до получения первого push.
- Backend хранит токен в `user_channels` (`channel = 'push'`) и шлёт push при:
  - появлении новой статьи в непрочитанном фиде (`services/newsProcessor.ts` → `sendNewArticlePush`),
  - дайджесте новостей (`services/digest.ts`),
  - еженедельном отчёте (`services/reports.ts`),
  - напоминании проголосовать за **Sentiment Index** (`services/push.ts` → `sendSentimentVotePush`) — push с тремя кнопками: Позитивно / Нейтрально / Негативно.
- В профиле появился раздел **Push-уведомления** с toggle.

---

## Что нужно сделать вам

### 1. Создать Firebase проект

1. Откройте https://console.firebase.google.com/.
2. Создайте проект (можно привязать к существующему GCP-проекту).

### 2. Зарегистрировать Android-приложение

- Package name: `com.pulse.app`
- Скачайте `google-services.json`.
- Положите его в:
  ```
  pulse-frontend/android/app/google-services.json
  ```
- Этот файл **не должен попадать в git** (уже добавлен в `.gitignore`).

### 3. Добавить Web-приложение в Firebase

1. В Firebase Console → Project settings → General → Your apps → Add app → Web.
2. Скопируйте конфиг (`apiKey`, `projectId`, `messagingSenderId`, `appId`, `vapidKey`).
3. Создайте файл `pulse-frontend/.env` из `.env.example` и заполните:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_MEASUREMENT_ID=...
   VITE_FIREBASE_VAPID_KEY=...
   ```
4. Заполните те же значения (без VAPID) в `public/firebase-messaging-sw.js`.

### 4. Настроить backend

1. В Firebase Console → Project settings → Service accounts → Generate new private key.
2. Скачайте JSON-ключ.
3. Закодируйте его в base64:
   ```bash
   base64 -i path/to/service-account.json | pbcopy
   ```
4. Добавьте в переменные окружения backend:
   ```
   FIREBASE_SERVICE_ACCOUNT_BASE64=...
   ```
   (см. `pulse-backend/.env.example`).

### 5. Пересобрать APK

```bash
cd pulse-frontend
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

Готовый APK: `PULSE-debug.apk`.

---

## Как это работает

- При входе в приложение frontend вызывает `initPushNotifications()`.
- Пользователь видит системный диалог «Разрешить уведомления».
- После согласия получается FCM-токен.
- Токен отправляется на `POST /api/user/channels` с `channel: 'push'`.
- Backend использует его для отправки push через `firebase-admin`.
- Если токен протухает (пользователь удалил приложение или отключил push), backend автоматически деактивирует канал.

---

## Push «Sentiment Index» (голосование из шторки)

Отдельный data-only push, который показывает Android-уведомление с тремя action-кнопками. Голос можно отдать, не открывая приложение.

### Поток данных

1. **Backend (cron)** — каждые 5 минут проверяет окно отправки:
   - выходные — skip,
   - чётный день месяца — 10:30 МСК,
   - нечётный день месяца — 15:00 МСК.
2. **Backend** выбирает eligible-пользователей:
   - `push_enabled = TRUE`,
   - есть активный FCM-токен,
   - сегодня ещё не голосовал (`sentiment_votes`),
   - сегодня ещё не получал этот push (`sentiment_vote_push_sent`).
3. **FCM** получает `data`-only сообщение (без `notification`-блока):
   ```json
   {
     "type": "sentiment_vote",
     "title": "Оцените рынок",
     "body": "Ваш голос влияет на индекс сантимента. Как вы оцените рынок?"
   }
   ```
4. **Android** — кастомный `PulseMessagingService` рисует уведомление с тремя кнопками. Нажатие запускает `VoteReceiver`.
5. **VoteReceiver** читает JWT из `CapacitorStorage` (записывается через `src/lib/nativeAuth.ts`) и шлёт `POST /api/sentiment/vote` с `Authorization: Bearer <token>`.
6. **Остальные push** (`new_article`, `digest`, `report`) пересылаются из `PulseMessagingService` в стандартный `PushNotificationsPlugin`, чтобы сохранить прежнее поведение.

### Надёжная доставка FCM-токена при cold start

Проблема: при cold start FCM может сгенерировать новый токен до того, как создан Capacitor bridge. В этот момент `PushNotificationsPlugin.getPushNotificationsInstance()` возвращает `null`, и стандартный `PushNotificationsPlugin.onNewToken(token)` не доставляет токен в JS.

Решение — двухэтапная доставка:

1. `PulseMessagingService.onNewToken(token)` всегда сохраняет токен в `SharedPreferences("CapacitorStorage", "fcm_token")`.
2. Тот же метод вызывает `PushNotificationsPlugin.onNewToken(token)` — быстрый путь при warm start, когда bridge уже жив.
3. `TokenFlushPlugin` (Java, авто-регистрируется в `MainActivity`) при загрузке bridge читает сохранённый токен и вызывает `PushNotificationsPlugin.onNewToken(token)` ещё раз.
4. Внутри `PushNotificationsPlugin` событие `registration` отправляется с `retain = true`, поэтому даже если JS-листенер из `src/lib/push.ts` подпишется позже, токен будет доставлен.

Это гарантирует, что после force stop / долгого простоя / обновления APK актуальный FCM-токен уйдёт на backend через `POST /api/user/channels`.

### Нативные файлы

- `android/app/src/main/java/com/pulse/app/PulseMessagingService.kt` — отрисовка уведомления, маршрутизация и сохранение FCM-токена.
- `android/app/src/main/java/com/pulse/app/VoteReceiver.kt` — обработка нажатий кнопок и вызов API.
- `android/app/src/main/java/com/pulse/app/TokenFlushPlugin.java` — гарантированная доставка отложенного FCM-токена в JS после инициализации bridge.
- `android/app/src/main/java/com/pulse/app/NotificationChannelSetupPlugin.java` — создаёт notification channel `pulse_default` при старте bridge, чтобы приложение появилось в настройках уведомлений Android 13+.
- `android/app/src/main/java/com/pulse/app/MainActivity.java` — регистрирует `TokenFlushPlugin` и `NotificationChannelSetupPlugin`.
- `android/app/src/main/AndroidManifest.xml` — регистрация кастомного сервиса вместо сервиса плагина (`tools:node="remove"`).
- `src/lib/nativeAuth.ts` — синхронизация JWT в `Capacitor Preferences`.
- `src/hooks/useAuth.tsx` — вызывает `saveTokenToNativeStorage()` при login / register / восстановлении сессии и `clearNativeStorage()` при logout.

### Важно

- Data-only push обязателен: если добавить `notification`-блок, Android в background/killed перехватит сообщение сам, и кастомные кнопки не появятся.
- Fallback API URL в `VoteReceiver` — `https://pulse-api-bsov.onrender.com`.
- Kotlin-классы (`PulseMessagingService.kt`, `VoteReceiver.kt`) компилируются благодаря плагину `org.jetbrains.kotlin.android` в `android/app/build.gradle`. Без него они не попадают в APK.

---

## Ограничения

- Одно устройство на пользователя (схема `user_channels` имеет `UNIQUE(user_id, channel)`).
- Для мульти-устройства нужно расширить схему (например, добавить `device_id`).
