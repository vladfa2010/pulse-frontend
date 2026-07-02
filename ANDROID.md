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
./gradlew assembleDebug

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
- еженедельном отчёте.

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

## Отличия Android-версии от web

- Номер версии приложения (`vX.Y.Z`) отображается в футере **только в нативном Android-приложении**. В web-версии футер не содержит версии.
- Разделение реализовано через `Capacitor.isNativePlatform()` в `src/components/Footer.tsx`.

## Ограничения

- Одно устройство на пользователя (`user_channels` имеет `UNIQUE(user_id, channel)`).
- Для мульти-устройства нужно расширить схему, добавив `device_id`.
