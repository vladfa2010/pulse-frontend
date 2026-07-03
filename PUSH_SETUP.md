# Push-уведомления в PULSE (Firebase Cloud Messaging)

Push-уведомления реализованы через **Firebase Cloud Messaging** и плагин Capacitor `@capacitor/push-notifications`.

Общая конфигурация Firebase (web + Android + Analytics): [`FIREBASE.md`](./FIREBASE.md).  
Детали по Android-сборке: [`ANDROID.md`](./ANDROID.md).  
Детали backend-части: [`../pulse-backend/PUSH_NOTIFICATIONS.md`](../pulse-backend/PUSH_NOTIFICATIONS.md).

---

## Что уже сделано

- Android-приложение собирается с поддержкой push.
- Frontend запрашивает разрешение, получает FCM-токен и отправляет его на backend.
- Backend хранит токен в `user_channels` (`channel = 'push'`) и шлёт push при:
  - появлении новой статьи в непрочитанном фиде (`services/newsProcessor.ts` → `sendNewArticlePush`),
  - дайджесте новостей (`services/digest.ts`),
  - еженедельном отчёте (`services/reports.ts`).
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

## Ограничения

- Одно устройство на пользователя (схема `user_channels` имеет `UNIQUE(user_id, channel)`).
- Для мульти-устройства нужно расширить схему (например, добавить `device_id`).
