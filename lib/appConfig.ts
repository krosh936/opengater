// Конфигурация API/ботов для проекта.
export type ApiProfile = 'eutochkin' | 'cdn';

// Профиль для основного API (eutochkin).
const PROFILE_EUTOCHKIN = {
  name: 'eutochkin' as const,
  upstreams: [
    'https://api.bot.eutochkin.com/api',
    'https://cdn.opngtr.ru/api',
    'https://opngtr.com/api',
  ],
  // Telegram-бот для логина/привязки при этом профиле.
  telegramBot: 'kostik_chukcha_bot',
};

// Профиль для CDN API (старый).
const PROFILE_CDN = {
  name: 'cdn' as const,
  upstreams: [
    'https://cdn.opngtr.ru/api',
    'https://api.bot.eutochkin.com/api',
    'https://opngtr.com/api',
  ],
  // Telegram-бот для логина/привязки при этом профиле.
  telegramBot: 'opengater_vpn_bot',
};

// Активный профиль API. Переключайте одну строку.
export const ACTIVE_PROFILE = PROFILE_EUTOCHKIN;
// export const ACTIVE_PROFILE = PROFILE_CDN;

// Список апстримов для прокси API.
export const API_UPSTREAMS = ACTIVE_PROFILE.upstreams;
// Имя активного профиля.
export const ACTIVE_PROFILE_NAME: ApiProfile = ACTIVE_PROFILE.name;
// Telegram-бот для кнопки логина/привязки.
export const TELEGRAM_BOT_USERNAME = ACTIVE_PROFILE.telegramBot;
// Домен окна авторизации (popup) для email/telegram.
export const AUTH_POPUP_ORIGIN = 'https://lka.bot.eutochkin.com';
