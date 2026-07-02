# Автообновление Android-приложения PULSE

Нативное Android-приложение умеет проверять наличие новой версии на GitHub Releases и предлагать пользователю обновиться, не выходя из приложения.

## Общий поток

1. Backend запрашивает последний релиз у GitHub API.
2. Frontend сравнивает установленную версию (`package.json`) с версией из релиза.
3. Если доступна более новая версия — показывается модалка «Доступно обновление» **только на Android**.
4. При нажатии «Обновить» нативный плагин скачивает APK через `DownloadManager` и запускает системный диалог установки.
5. Проверка и модалка не запускаются в web-версии и на iOS.

## Backend

**Endpoint:** `GET /api/app/version`

Возвращает:

```json
{
  "version": "8.0.13",
  "apkUrl": "https://github.com/vladfa2010/pulse-frontend/releases/download/v8.0.13/PULSE-debug.apk",
  "releaseUrl": "https://github.com/vladfa2010/pulse-frontend/releases/tag/v8.0.13"
}
```

Источник: `pulse-backend/src/routes/app.ts`.

Кэшируется в памяти на 30 секунд, чтобы не превышать лимит GitHub API.

## Frontend

### Проверка версии

`src/hooks/useAppUpdate.ts`:

- Через 3 секунды после старта приложения запрашивает `/api/app/version`.
- Сравнивает `package.json.version` с `data.version` семантически.
- Если новая версии больше и пользователь не нажимал «Позже» для неё — показывает модалку.
- Поддерживает прогресс скачивания (`progress`, `updating`).

### Модалка обновления

`src/components/AppUpdateModal.tsx`:

- Показывает версию и кнопки «Позже» / «Обновить».
- Во время скачивания отображает спиннер, прогресс-бар и проценты.

### Нативный Android-плагин

`src/lib/inAppUpdate.ts` — TypeScript-мост к плагину `InAppUpdater`.

## Android

### Регистрация плагина

Плагин явно регистрируется в `MainActivity.java`:

```java
package com.pulse.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.pulse.app.plugins.InAppUpdaterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InAppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

> Без `registerPlugin()` Capacitor не находит реализацию, вызов падает в `catch` и срабатывает fallback в браузер.

### Нативная реализация

`android/app/src/main/java/com/pulse/app/plugins/InAppUpdaterPlugin.java`:

1. Проверяет разрешение `REQUEST_INSTALL_PACKAGES`.
2. Если разрешения нет — открывает настройки приложения и возвращает ошибку `INSTALL_PACKAGES_PERMISSION_DENIED`.
3. Очищает старый `update.apk` во внешнем кэше.
4. Ставит запрос в системный `DownloadManager`.
5. Каждые 500 мс опрашивает прогресс и шлёт событие `downloadProgress` в JS.
6. После завершения загрузки через `FileProvider` получает content URI и запускает `Intent.ACTION_VIEW` с `application/vnd.android.package-archive`.
7. Система показывает диалог установки.

### Необходимые разрешения

В `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
<uses-permission android:name="android.permission.DOWNLOAD_WITHOUT_NOTIFICATION" />
```

### FileProvider

Уже настроен в `AndroidManifest.xml`:

```xml
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
</provider>
```

`android/app/src/main/res/xml/file_paths.xml` должен содержать `external-cache-path` и `cache-path`:

```xml
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <external-path name="external_files" path="." />
    <external-cache-path name="external_cache" path="." />
    <files-path name="files" path="." />
    <cache-path name="cache" path="." />
</paths>
```

## Разделение web и Android

- Номер версии в футере (`src/components/Footer.tsx`) показывается только в нативном приложении (`Capacitor.isNativePlatform()`).
- Логика автообновления запускается только на Android (`Capacitor.getPlatform() === 'android'`).
- В web-версии и на iOS проверка версии не выполняется, модалка не показывается.

## Как тестировать

1. Установите на устройство предыдущую версию (например, `8.0.12`).
2. Внизу экрана увидите `v8.0.12`.
3. Откройте приложение и дождитесь модалки.
4. Для проверки логов запустите:
   ```bash
   adb logcat -c && adb logcat | grep InAppUpdater
   ```
5. Нажмите «Обновить».
6. Ожидаемый результат:
   - В logcat: `InAppUpdater: downloadAndInstall called`.
   - Браузер не открывается.
   - В модалке растёт прогресс-бар 0→100%.
7. После 100% появится системный диалог установки — подтвердите.
8. После установки внизу будет новая версия, например `v8.0.13`.

## Решение проблем

### Открывается браузер вместо нативной загрузки

- Проверьте, что `InAppUpdaterPlugin` зарегистрирован в `MainActivity.java`.
- Посмотрите в `adb logcat` на ошибки `Capacitor` / `Console`.
- Убедитесь, что установлен APK, собранный **после** добавления регистрации.

### После скачивания ничего не происходит

- На Android 14+ `BroadcastReceiver` должен регистрироваться с `RECEIVER_EXPORTED` для системного события `ACTION_DOWNLOAD_COMPLETE`.
- Проверьте, что в `file_paths.xml` есть `external-cache-path`.

### Конфликт подписей при установке

- Все debug-сборки подписываются одним общим `android/app/debug.keystore`.
- Если ранее установлен APK с другой подписью, удалите его перед установкой нового.
