# Политика безопасности и работа с секретами PULSE

Этот документ описывает, какие данные считаются секретами, где их хранить и что делать при утечке.

---

## Что считается секретом

Никогда не коммитьте в git и не публикуйте в открытом доступе:

- API-токены и ключи (`Render API token`, `Telegram bot token`, `Resend API key` и т.д.)
- JWT-секреты и пароли от баз данных
- Firebase service account JSON / base64
- `google-services.json` для Android
- Приватные ключи SSH/RSA
- Любые `.env`-файлы

## Где хранить секреты

### Локальная разработка

| Секрет | Файл | Должен быть в `.gitignore` |
|---|---|---|
| Render API token | `pulse kode/.render-token` | ✅ да |
| Firebase web config | `pulse-frontend/.env` | ✅ да |
| `google-services.json` | `pulse-frontend/android/app/google-services.json` | ✅ да |
| Backend env (Telegram, DB, JWT, Firebase service account) | `pulse-backend/.env` | ✅ да |

Храните файлы локально. Не добавляйте их в мессенджеры, облачные заметки и общие диски без шифрования.

### Production / Render

Все секреты передаются через **Environment Variables** в Render Dashboard:

- `pulse-frontend` Static Site: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_MEASUREMENT_ID` и т.д.
- `pulse-backend` Web Service: `TELEGRAM_BOT_TOKEN`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, `JWT_SECRET`, `DB_PASSWORD` и т.д.

### CI/CD / GitHub Actions

Используйте **GitHub Repository Secrets**:

- Settings → Secrets and variables → Actions
- Пример: `secrets.GOOGLE_SERVICES_JSON` для сборки Android APK.

Никогда не пишите секреты напрямую в `.github/workflows/*.yml`.

---

## Что можно оставить публичным

Некоторые клиентские ключи технически видны в браузере, но всё равно нужно ограничивать:

- **Firebase web API key** в `public/firebase-messaging-sw.js` — клиентский ключ.
  - В Google Cloud Console → Credentials настройте ограничение по **HTTP referrers**.
  - Разрешите только `pulse-frontend-jt53.onrender.com/*` и `localhost:*`.

---

## Как добавить новый секрет

1. Создайте/обновите переменную в Render Dashboard (production) или `.env` (локально).
2. Убедитесь, что файл с секретом добавлен в `.gitignore`.
3. Не упоминайте реальное значение в документации, коммит-сообщениях и чатах.

## Что делать при утечке

1. **Немедленно отзовите токен/ключ** в соответствующем сервисе:
   - Render: Dashboard → Account Settings → API Keys → revoke.
   - Telegram: `@BotFather` → `/revoke`.
   - Firebase: Console → Project settings → Service accounts → удалите старый ключ, создайте новый.
   - Google Cloud: Credentials → удалите или ограничьте API key.
2. Создайте новый секрет.
3. Обновите:
   - локальные `.env` / `.render-token`;
   - Environment Variables на Render;
   - GitHub Secrets, если используется.
4. Перезапустите деплой backend/frontend.
5. Проверьте логи на подозрительную активность.

---

## Полезные команды

```bash
# Проверить, не затреканы ли секретные файлы
git ls-files | grep -E '\.env|\.render-token|google-services|adminsdk'

# Если файл случайно попал в индекс, убрать из git (сохранить локально)
git rm --cached path/to/secret-file
```

---

## Контакты

Если обнаружили утечку или не уверены, безопасен ли файл — не коммитьте, спросите у владельца проекта.
