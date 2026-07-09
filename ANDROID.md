# PULSE Android-приложение

Android-приложение PULSE — это Capacitor-обёртка над React-фронтендом. Один кодовый базис работает и в web, и на Android.

**Package name:** `com.pulse.app`

**Production APK:** `pulse-frontend/PULSE-debug.apk`

---

## Технологии

- [Capacitor 8](https://capacitorjs.com/)
- `@capacitor/push-notifications` — push-уведомления через Firebase
- Android SDK 35
- JDK 21

---

## Требования к окружению

Инструменты Android в проекте лежат в `~/.pulse-android-tools/`:

```
~/.pulse-android-tools/
  jdk/Contents/Home/          # JDK 21
  android-sdk/
    cmdline-tools/latest/     # sdkmanager
    platform-tools/           # adb
    build-tools/35.0.0/
    platforms/android-35/
```

При сборке должны быть выставлены:

```bash
export JAVA_HOME="$HOME/.pulse-android-tools/jdk/Contents/Home"
export ANDROID_HOME="$HOME/.pulse-android-tools/android-sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/35.0.0:$PATH"
```

---

## Firebase-конфиг

1. Скачайте `google-services.json` из Firebase Console для package `com.pulse.app`.
2. Положите файл сюда:
   ```
   pulse-frontend/android/app/google-services.json
   ```
3. Файл уже исключён из git (`.gitignore`).

Подробнее про push и Firebase: [`PUSH_SETUP.md`](./PUSH_SETUP.md).

---

## Сборка debug APK

```bash
cd pulse-frontend

# 1. Собрать web-часть
npm run build

# 2. Скопировать web-assets в Android-проект
npx cap sync android

# 3. Собрать APK
cd android
./gradlew clean assembleDebug

# 4. Готовый файл
android/app/build/outputs/apk/debug/app-debug.apk
```

Готовый APK копируется в корень фронтенда:

```bash
cp android/app/build/outputs/apk/debug/app-debug.apk PULSE-debug.apk
```

---

## Установка на устройство

Подключите Android-устройство с включённой отладкой по USB и выполните:

```bash
adb install -r PULSE-debug.apk
```

Или перетащите APK в эмулятор.

---

## Push-уведомления

При первом входе приложение запрашивает разрешение на уведомления.

Что происходит:

1. `initPushNotifications()` из `src/lib/push.ts` запрашивает permission.
2. Capacitor получает FCM-токен на Android.
3. Токен отправляется на backend: `POST /api/user/channels` с `channel: 'push'`.
4. Backend использует токен для отправки push.

Push приходят при:

- новой статье в непрочитанном фиде,
- дайджесте непрочитанных новостей,
- еженедельном отчёте,
- напоминании проголосовать за **Sentiment Index** (с тремя кнопками в шторке).

### Кастомный FCM-сервис для Sentiment Index

Стандартный `FirebaseMessagingService` из `@capacitor/push-notifications` заменён на `PulseMessagingService`:

- `sentiment_vote` — рисуется уведомление с тремя action-кнопками (`Позитивно`, `Нейтрально`, `Негативно`).
- Все остальные push (`new_article`, `digest`, `report`) пересылаются в `PushNotificationsPlugin`, чтобы сохранить стандартное поведение.

Нажатие кнопки отправляет `Broadcast` в `VoteReceiver`, который:

1. Читает JWT из `CapacitorStorage` (`pulse_token`).
2. Шлёт `POST https://pulse-api-bsov.onrender.com/api/sentiment/vote`.
3. Показывает Toast с результатом (201 / 429 / 401 / offline).
4. Скрывает уведомление.

JWT в `CapacitorStorage` синхронизируется из JS при login / register / восстановлении сессии (`src/lib/nativeAuth.ts` + `src/hooks/useAuth.tsx`).

### Надёжная доставка FCM-токена при cold start

При cold start FCM может выдать новый токен до инициализации Capacitor bridge. Чтобы токен не потерялся:

1. `PulseMessagingService.onNewToken(token)` сохраняет токен в `SharedPreferences("CapacitorStorage", "fcm_token")`.
2. Тот же метод вызывает `PushNotificationsPlugin.onNewToken(token)` — fallback для warm start.
3. `TokenFlushPlugin` (Java, зарегистрирован в `MainActivity`) при загрузке bridge забирает сохранённый токен и повторно диспатчит его в `PushNotificationsPlugin`.
4. Событие `registration` в `PushNotificationsPlugin` шлётся с `retain = true`, поэтому JS-листенер в `src/lib/push.ts` получит токен даже при поздней подписке.

### Создание notification channel при старте

На Android 13+ приложение отображается в Settings → Notifications только после создания хотя бы одного notification channel. Чтобы PULSE был виден сразу после первого запуска (до получения push), `NotificationChannelSetupPlugin` создаёт канал `pulse_default` («Новости») в своём `load()`.

### Kotlin-поддержка

`PulseMessagingService.kt` и `VoteReceiver.kt` написаны на Kotlin. Для их компиляции в `android/app/build.gradle` применён плагин `org.jetbrains.kotlin.android`, а в `android/build.gradle` добавлен classpath `org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24`. Без этого Kotlin-файлы игнорируются Gradle и не попадают в APK.

---

## Решение проблем

### `Unable to locate a Java Runtime`

Не выставлен `JAVA_HOME`. Проверьте путь до JDK 21:

```bash
export JAVA_HOME="$HOME/.pulse-android-tools/jdk/Contents/Home"
```

### `SDK location not found`

Не выставлен `ANDROID_HOME`. Проверьте путь до Android SDK:

```bash
export ANDROID_HOME="$HOME/.pulse-android-tools/android-sdk"
```

### `NoSuchFileException: values-large-v4...arsc.flat`

```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### `config 2.xml: ' ' is not a valid file-based resource name character`

Удалите дублирующий файл `config 2.xml` в `android/app/src/main/res/xml/`.

---

## Автообновление

Приложение умеет само скачивать и устанавливать новые APK из GitHub Releases. Подробнее см. [`AUTO_UPDATE.md`](./AUTO_UPDATE.md).

### Важно: синхронизация версий

Автообновление сравнивает установленную версию APK (`versionName` из `android/app/build.gradle`) с версией последнего GitHub Release. Чтобы не было ложного предложения обновиться на ту же версию:

1. Подними версию в `package.json`.
2. Подними `versionName` и `versionCode` в `android/app/build.gradle`.
3. Только потом запускай `npm run build` и `./gradlew assembleDebug`.

Футер приложения показывает версию из `package.json`, поэтому оба источника должны совпадать.

## Отличия Android-версии от web

- Номер версии приложения (`vX.Y.Z`) отображается в футере **только в нативном Android-приложении**. В web-версии футер не содержит версии.
- Разделение реализовано через `Capacitor.isNativePlatform()` в `src/components/Footer.tsx`.

## Ограничения

- Одно устройство на пользователя (`user_channels` имеет `UNIQUE(user_id, channel)`).
- Для мульти-устройства нужно расширить схему, добавив `device_id`.
