# Firebase в PULSE

PULSE использует Firebase для двух задач:

1. **Push-уведомления** — Firebase Cloud Messaging (FCM) для Android и web.
2. **Сбор статистики** — Firebase Analytics (Google Analytics 4) для web-версии.

Подробности по push-уведомлениям: [`PUSH_SETUP.md`](./PUSH_SETUP.md).  
Backend-часть: [`../pulse-backend/PUSH_NOTIFICATIONS.md`](../pulse-backend/PUSH_NOTIFICATIONS.md).

---

## Конфигурация

### 1. Создать Firebase-проект

1. Откройте https://console.firebase.google.com/.
2. Создайте проект (можно привязать к существующему GCP-проекту).
3. Включите **Google Analytics** при создании или позже в настройках проекта.

### 2. Зарегистрировать Web-приложение

1. Firebase Console → Project settings → General → Your apps → **Add app → Web**.
2. Скопируйте конфиг: `apiKey`, `projectId`, `messagingSenderId`, `appId`, `measurementId`.
3. Создайте `pulse-frontend/.env` из `.env.example` и заполните:
   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
   VITE_FIREBASE_VAPID_KEY=...
   ```
4. Для push-уведомлений также заполните `public/firebase-messaging-sw.js` теми же значениями (кроме `VAPID` и `measurementId`).

### 3. Зарегистрировать Android-приложение (для push)

- Package name: `com.pulse.app`
- Скачайте `google-services.json`.
- Положите его в `pulse-frontend/android/app/google-services.json`.
- Этот файл **не должен попадать в git** (уже добавлен в `.gitignore`).

---

## Push-уведомления

Краткий поток:

1. При входе frontend вызывает `initPushNotifications()` (`src/lib/push.ts`).
2. Пользователь видит системный диалог «Разрешить уведомления».
3. После согласия получается FCM-токен.
4. Токен отправляется на `POST /api/user/channels` с `channel: 'push'`.
5. Backend использует его для отправки push через `firebase-admin`.
6. Если токен протухает, backend автоматически деактивирует канал.

Подробнее см. [`PUSH_SETUP.md`](./PUSH_SETUP.md).

---

## Firebase Analytics (Google Analytics 4)

Аналитика работает **только в web-версии** и только если задан `VITE_FIREBASE_MEASUREMENT_ID`.

### Как включается

- Общий Firebase app инициализируется в `src/lib/firebase.ts`.
- Модуль `src/lib/analytics.ts` лениво инициализирует `getAnalytics()` при старте (`src/main.tsx`).
- На нативных платформах (Android/iOS) аналитика не запускается — Firebase JS SDK в WebView работает нестабильно.

### Автоматические события

- `page_view` — при каждом изменении маршрута (`src/hooks/useAnalyticsPageTracking.ts`).
  - Параметры: `page_path`, `page_title`.

### Кастомные события

| Событие | Где логируется | Параметры |
|---|---|---|
| `search` | `Home.tsx` | `search_term` |
| `subscribe_tag` | `Home.tsx`, `PopularTagsSlider.tsx` | `tag_id`, `tag_name`, `tag_type`, `source` |
| `unsubscribe_tag` | `Home.tsx`, `PopularTagsSlider.tsx` | `tag_id`, `tag_name`, `source` |
| `select_content` | `Home.tsx`, `NewsFeed.tsx` | `content_type` (`tag_feed` \| `news`), `item_id`, `title` |
| `open_auth_modal` | `AuthModalContext.tsx` | `mode` (`login` \| `register`) |
| `login` | `AuthModal.tsx` | `method: 'email'` |
| `sign_up` | `AuthModal.tsx` | `method: 'email'` |
| `telegram_connect` | `TelegramConnectBanner.tsx` | `method: 'widget'` |
| `begin_checkout` | `Pricing.tsx` | `currency`, `value`, `subscription` (`monthly` \| `yearly`) |
| `purchase` | `PaymentReturn.tsx` | `currency`, `transaction_id` |
| `sentiment_vote` | `SentimentChartCard.tsx` | `value` (`1` \| `0` \| `-1`) |
| `download_apk` | `DownloadPage.tsx` | `version` |

### Как добавить новое событие

Импортируйте `logAnalyticsEvent` и вызывайте в обработчике:

```ts
import { logAnalyticsEvent } from '@/lib/analytics'

logAnalyticsEvent('my_event', {
  param1: 'value',
  param2: 42,
})
```

Если `analytics` ещё не инициализирован или Measurement ID не задан, вызов безопасно игнорируется.

### Проверка

1. Откройте Firebase Console → Analytics → **DebugView**.
2. Локально запустите `npm run dev` и выполните действие.
3. Событие появится в DebugView в течение минуты.
4. Для проверки на production откройте **Realtime** — данные там появляются с небольшой задержкой.

---

## Android-приложение

- APK собирается с встроенными web-assets, поэтому для попадания аналитики в приложение нужно пересобирать и выпускать новый APK.
- Firebase JS Analytics в Capacitor WebView может отправлять не все события.
- Для полноценной мобильной аналитики рекомендуется в будущем подключить `@capacitor-firebase/analytics`.

---

## Ограничения и примечания

- **Одно устройство на пользователя** для push (`user_channels` имеет `UNIQUE(user_id, channel)`). Для мульти-устройства нужно расширить схему, добавив `device_id`.
- **GDPR / согласие**: если у вас есть пользователи из ЕС/РФ, убедитесь, что сбор аналитики учитывает настройки согласия (consent mode). Для начала достаточно ограничить сбор только продакшен-доменом.
