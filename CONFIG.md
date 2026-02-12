# Конфигурация проекта

Этот файл описывает, где быстро переключать API и ботов без поиска по коду.

**Где менять:** `lib/appConfig.ts`

**Переключение API**
1. Открой `lib/appConfig.ts`.
2. В блоке `ACTIVE_PROFILE` оставь активной ровно одну строку:
```ts
export const ACTIVE_PROFILE = PROFILE_EUTOCHKIN;
// export const ACTIVE_PROFILE = PROFILE_CDN;
```

**Что меняется при переключении**
- Список апстримов API для прокси `/api/proxy`.
- Telegram-бот для кнопки входа/привязки.

**Что означает каждая настройка**
- `API_UPSTREAMS` — список базовых URL API, куда проксируются запросы.
- `TELEGRAM_BOT_USERNAME` — бот для логина/привязки Telegram.
- `TELEGRAM_OAUTH_URL` — прямая ссылка Telegram OAuth (используется как fallback).
- `AUTH_POPUP_ORIGIN` — домен окна авторизации (popup) для email/telegram.

Если нужно добавить новый профиль — скопируй один из `PROFILE_*` и подставь свои значения.
