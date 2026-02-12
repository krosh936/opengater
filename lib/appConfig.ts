export type ApiProfile = 'eutochkin' | 'cdn';

const PROFILE_EUTOCHKIN = {
  name: 'eutochkin' as const,
  upstreams: [
    'https://api.bot.eutochkin.com/api',
    'https://cdn.opngtr.ru/api',
    'https://opngtr.com/api',
  ],
  telegramBot: 'kostik_chukcha_bot',
};

const PROFILE_CDN = {
  name: 'cdn' as const,
  upstreams: [
    'https://cdn.opngtr.ru/api',
    'https://api.bot.eutochkin.com/api',
    'https://opngtr.com/api',
  ],
  telegramBot: 'opengater_vpn_bot',
};

export const ACTIVE_PROFILE = PROFILE_EUTOCHKIN;
// export const ACTIVE_PROFILE = PROFILE_CDN;

export const API_UPSTREAMS = ACTIVE_PROFILE.upstreams;
export const ACTIVE_PROFILE_NAME: ApiProfile = ACTIVE_PROFILE.name;
export const TELEGRAM_BOT_USERNAME = ACTIVE_PROFILE.telegramBot;
export const AUTH_POPUP_ORIGIN = 'https://lka.bot.eutochkin.com';
