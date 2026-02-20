import { AUTH_PROFILE_ENABLED } from '@/lib/appConfig';

const API_BASE_URL = 'https://api.bot.eutochkin.com/api';


const API_PROXY_BASE_URL = '/api/proxy';
const AUTH_BACKEND_DIRECT_URL = 'https://reauth.cloud/api';
const AUTH_BACKEND_ALT_URL = 'https://reauth.cloud';
const AUTH_BACKEND_FALLBACK_URL = 'https://cdn.opngtr.ru/api';
const AUTH_BACKEND_NEW_URL = 'https://opngtr.com/api';
const AUTH_BACKEND_NEW_API_URL = 'https://cdn.opngtr.ru';
// const AUTH_BACKEND_DIRECT_URL = 'https://cdn.opngtr.ru/api';
// const AUTH_BACKEND_ALT_URL = 'https://opngtr.com/api';
// const AUTH_BACKEND_FALLBACK_URL = 'https://cdn.opngtr.ru';
// const AUTH_BACKEND_NEW_URL = 'https://opngtr.com';
// const AUTH_BACKEND_NEW_API_URL = 'https://cdn.opngtr.ru/api';
// const AUTH_BACKEND_DIRECT_URL = 'https://api.bot.eutochkin.com/api';
// const AUTH_BACKEND_ALT_URL = 'https://api.bot.eutochkin.com';
// const AUTH_BACKEND_FALLBACK_URL = 'https://auth.bot.eutochkin.com';
// const AUTH_BACKEND_NEW_URL = 'https://auth.bot.lk.eutochkin.com';
// const AUTH_BACKEND_NEW_API_URL = 'https://auth.bot.lk.eutochkin.com/api';
const AUTH_BACKEND_PROXY_URL = '/api/auth';
const AUTH_BACKEND_URLS = [
  AUTH_BACKEND_PROXY_URL,
  AUTH_BACKEND_NEW_URL,
  AUTH_BACKEND_NEW_API_URL,
  AUTH_BACKEND_DIRECT_URL,
  AUTH_BACKEND_ALT_URL,
  AUTH_BACKEND_FALLBACK_URL,
];

const CACHE_PREFIX = 'opengater_cache';
const CACHE_TTL = {
  languages: 12 * 60 * 60 * 1000,
  currencies: 12 * 60 * 60 * 1000,
  user: 5 * 60 * 1000,
  authProfile: 10 * 60 * 1000,
  locations: 60 * 1000,
};

const cacheSet = (key: string, data: unknown, meta?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  try {
    const payload = { ts: Date.now(), data, ...meta };
    localStorage.setItem(`${CACHE_PREFIX}:${key}`, JSON.stringify(payload));
  } catch {
    // Игнорируем ошибки кеша.
  }
};

const cacheGet = <T>(key: string, maxAgeMs?: number): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts?: number; data?: T };
    if (!parsed || typeof parsed !== 'object') return null;
    if (maxAgeMs && parsed.ts && Date.now() - parsed.ts > maxAgeMs) {
      return null;
    }
    return (parsed.data ?? null) as T | null;
  } catch {
    return null;
  }
};

const cacheGetWithMeta = <T>(key: string, maxAgeMs?: number): { data: T | null; meta: Record<string, unknown> } => {
  if (typeof window === 'undefined') return { data: null, meta: {} };
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}:${key}`);
    if (!raw) return { data: null, meta: {} };
    const parsed = JSON.parse(raw) as { ts?: number; data?: T } & Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return { data: null, meta: {} };
    if (maxAgeMs && parsed.ts && Date.now() - parsed.ts > maxAgeMs) {
      return { data: null, meta: {} };
    }
    const { data, ...meta } = parsed;
    return { data: (data ?? null) as T | null, meta };
  } catch {
    return { data: null, meta: {} };
  }
};

const locationsInFlight = new Map<string, Promise<LocationItem[]>>();
const locationsCooldownUntil = new Map<string, number>();
const getLocationsCacheKey = (userId: number, language?: string | null) =>
  `locations:${userId}:${language || 'default'}`;

const authFetch = async (path: string, init: RequestInit): Promise<Response> => {
  let lastError: Error | null = null;
  const isBrowser = typeof window !== 'undefined';
  const baseUrls = isBrowser ? [AUTH_BACKEND_PROXY_URL] : AUTH_BACKEND_URLS;
  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init);
      (response as unknown as { __authBase?: string }).__authBase = baseUrl;
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            const clone = response.clone();
            const data = await clone.json();
            const detail = typeof data?.detail === 'string' ? data.detail.toLowerCase() : '';
            if (detail.includes('invalid') && detail.includes('token')) {
              lastError = new Error(`Auth backend invalid token: ${detail}`);
              continue;
            }
          } catch {
            // Игнорируем ошибки парсинга — возвращаем ответ как есть.
          }
        }
        return response;
      }
      // Если прокси/хост недоступен или токен валиден только на другом хосте — пробуем следующий.
      if ([401, 403, 404, 500, 502, 503, 504].includes(response.status)) {
        lastError = new Error(`Auth backend error: ${response.status}`);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Auth backend request failed');
    }
  }
  throw lastError || new Error('Auth backend request failed');
};

const getAuthBase = (response: Response): string => {
  return response.headers.get('x-auth-upstream') || (response as unknown as { __authBase?: string }).__authBase || 'unknown';
};

const getAuthErrorMessage = (response: Response, data: unknown): string => {
  const base = getAuthBase(response);
  if (typeof data === 'string' && data.trim()) {
    return `${base}: ${data}`;
  }
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const detail =
      (typeof record.detail === 'string' && record.detail) ||
      (typeof record.message === 'string' && record.message) ||
      (typeof record.error === 'string' && record.error);
    if (detail) {
      return `${base}: ${detail}`;
    }
  }
  return `${base}: Ошибка ${response.status}`;
};

export interface Currency {
  code: string;
  symbol: string;
  rate: number;
  rounding_precision: number;
  id: number;
  hidden: boolean;
}

export interface LanguageOption {
  code?: string;
  language?: string;
  name?: string;
  native?: string;
  native_name?: string;
  id?: string | number;
  short?: string;
}

export interface Account {
  uuid: string;
  vless_key: string;
  global_subscription_url: string;
  ru_subscription_url: string;
}

export interface UserInfo {
  id: number;
  full_name: string;
  username: string;
  language: string;
  currency: Currency;
  balance: number;
  tariff: number;
  device_number: number;
  expire: string;
  bot_referral_link: string;
  web_referral_link: string;
  account: Account;
}

export interface ApiError {
  detail: Array<{
    loc: (string | number)[];
    msg: string;
    type: string;
  }>;
}

export interface LocationItem {
  id: number;
  flag?: string;
  name?: string;
  description?: string;
  name_ru?: string;
  name_en?: string;
  name_am?: string;
  description_ru?: string;
  description_en?: string;
  description_am?: string;
  price?: number;
  speed?: number;
  hidden?: boolean;
  selected?: boolean;
}

export interface DeviceButtonOption {
  text: string;
  device_number: number;
  selected: boolean;
}

export interface DeviceTariff {
  device_number: number;
  tariff_per_day: number;
  tariff_per_month: number;
}

export type DeviceTariffResponse = DeviceTariff | number;

export interface PaymentHistoryItem {
  id?: string | number;
  title?: string;
  subtitle?: string;
  amount?: number;
  currency?: string;
  created_at?: string;
  direction?: 'in' | 'out';
  [key: string]: unknown;
}

export interface PaymentTariff {
  name?: string;
  amount: number;
  bonus: number;
}

export interface ReferredUser {
  full_name?: string;
  username?: string;
  connected?: boolean;
  amount?: number;
  [key: string]: unknown;
}

export interface TelegramAuthPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

const buildAuthHeaders = (token?: string | null): HeadersInit => {
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
};

const buildJsonHeaders = (token?: string | null): HeadersInit => ({
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  ...buildAuthHeaders(token),
});

const fetchJsonWithFallbacks = async <T>(attempts: Array<{ url: string; init: RequestInit }>): Promise<T> => {
  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, attempt.init);
      if (!response.ok) {
        lastError = new Error(`Ошибка сервера: ${response.status}`);
        continue;
      }
      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Ошибка сети');
    }
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error('Не удалось получить данные');
};


// Функция для получения user_token из localStorage или cookies
export const getUserToken = (): string | null => {
  if (typeof window !== 'undefined') {
    const storedToken =
      localStorage.getItem('user_token') ||
      localStorage.getItem('auth_token') ||
      localStorage.getItem('auth_access_token') ||
      localStorage.getItem('access_token');
    if (storedToken) {
      return storedToken;
    }
    return null;
  }
  return null;
};

// Функция для сохранения user_token
export const setUserToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user_token', token);
    localStorage.setItem('auth_token', token);
  }
};

// Функция для удаления user_token
export const removeUserToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user_token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
  }
};

// Основная функция для получения данных пользователя
export const fetchUserInfo = async (): Promise<UserInfo> => {
  const token = getUserToken();
  
  if (!token) {
    throw new Error('Токен пользователя не найден');
  }

  const attempts: Array<{ url: string; headers?: HeadersInit }> = [
    {
      url: `${API_PROXY_BASE_URL}/user/info`,
      headers: buildAuthHeaders(token),
    },
    {
      url: `${API_PROXY_BASE_URL}/user/info?token=${encodeURIComponent(token)}`,
      headers: buildAuthHeaders(token),
    },
    {
      url: `${API_PROXY_BASE_URL}/user/info/token?token=${encodeURIComponent(token)}`,
    },
  ];

  let lastError: Error | null = null;
  let lastStatus: number | null = null;
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...attempt.headers,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        lastStatus = response.status;
        if ([401, 403, 404].includes(response.status)) {
          lastError = new Error('Недействительный токен. Пожалуйста, войдите снова');
          continue;
        }

        if (response.status === 422) {
          const error: ApiError = await response.json();
          lastError = new Error(error.detail[0]?.msg || 'Ошибка валидации');
          continue;
        }

        lastError = new Error(`Ошибка сервера: ${response.status}`);
        continue;
      }

      const data = await response.json();
      cacheSet('user', data, { token });
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Неизвестная ошибка при загрузке данных');
    }
  }

  if (lastError) {
    const isAuthError =
      lastError.message.includes('Недействительный токен') ||
      lastError.message.includes('401') ||
      lastError.message.includes('403');
    if (!isAuthError && (lastStatus === null || lastStatus >= 500)) {
      const { data, meta } = cacheGetWithMeta<UserInfo>('user', CACHE_TTL.user);
      if (data && typeof meta.token === 'string' && meta.token === token) {
        return data;
      }
    }
    throw lastError;
  }
  throw new Error('Неизвестная ошибка при загрузке данных');
};

// Функция для получения подписок (пример)
export const fetchSubscriptionLinks = async (): Promise<{
  global: string;
  ru: string;
  vless_key: string;
}> => {
  const userInfo = await fetchUserInfo();
  return {
    global: userInfo.account.global_subscription_url,
    ru: userInfo.account.ru_subscription_url,
    vless_key: userInfo.account.vless_key,
  };
};

// Функция для получения баланса
export const fetchBalance = async (): Promise<{
  balance: number;
  currency: Currency;
  expire: string;
}> => {
  const userInfo = await fetchUserInfo();
  return {
    balance: userInfo.balance,
    currency: userInfo.currency,
    expire: userInfo.expire,
  };
};

export const fetchCurrencies = async (): Promise<Currency[]> => {
  const endpoints = [
    `${API_PROXY_BASE_URL}/public/currencies/`,
    `${API_PROXY_BASE_URL}/currency/`,
    `${API_PROXY_BASE_URL}/currencies/`,
  ];

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        lastError = new Error(`Ошибка сервера: ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        cacheSet('currencies', data);
        return data;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
    }
  }

  if (lastError) {
    const cached = cacheGet<Currency[]>('currencies', CACHE_TTL.currencies);
    if (cached) return cached;
    throw lastError;
  }

  throw new Error('Не удалось загрузить список валют');
};

export const fetchLanguages = async (): Promise<LanguageOption[]> => {
  const endpoints = [
    `${API_PROXY_BASE_URL}/public/languages/`,
    `${API_PROXY_BASE_URL}/language/`,
    `${API_PROXY_BASE_URL}/languages/`,
  ];

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        lastError = new Error(`Ошибка сервера: ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        cacheSet('languages', data);
        return data;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
    }
  }

  if (lastError) {
    const cached = cacheGet<LanguageOption[]>('languages', CACHE_TTL.languages);
    if (cached) return cached;
    throw lastError;
  }

  throw new Error('Не удалось загрузить список языков');
};

export const fetchPaymentBonus = async (
  amount: number,
  currencyCode: string,
  signal?: AbortSignal
): Promise<number> => {
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return 0;
  }
  const code = currencyCode || 'RUB';
  const url = `${API_PROXY_BASE_URL}/public/payments/bonus?amount=${encodeURIComponent(
    normalizedAmount
  )}&currency_code=${encodeURIComponent(code)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Ошибка сервера: ${response.status}`);
  }

  const data = await response.json();
  if (typeof data === 'number' && Number.isFinite(data)) {
    return data;
  }
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const value = record.bonus ?? record.value ?? record.amount ?? record.result;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
};

export const fetchPaymentTariffs = async (): Promise<PaymentTariff[]> => {
  const token = getUserToken();
  const headers = buildJsonHeaders(token);
  const basePath = `${API_PROXY_BASE_URL}/user/payments/tariff`;
  const attempts: Array<{ url: string; init: RequestInit }> = [
    {
      url: basePath,
      init: { method: 'GET', headers, credentials: 'include' },
    },
  ];

  if (token) {
    attempts.push({
      url: `${basePath}?token=${encodeURIComponent(token)}`,
      init: { method: 'GET', headers, credentials: 'include' },
    });
  }

  const data = await fetchJsonWithFallbacks<unknown>(attempts);
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const amount = typeof record.amount === 'number' ? record.amount : Number(record.amount);
      const bonus = typeof record.bonus === 'number' ? record.bonus : Number(record.bonus || 0);
      if (!Number.isFinite(amount)) return null;
      return {
        name: typeof record.name === 'string' ? record.name : undefined,
        amount,
        bonus: Number.isFinite(bonus) ? bonus : 0,
      } satisfies PaymentTariff;
    })
    .filter((item): item is PaymentTariff => !!item);
};

// Функция для получения дней оставшихся
export const calculateDaysRemaining = (expireDate: string): string => {
  const msPerDay = 1000 * 60 * 60 * 24;
  const dateOnlyMatch = expireDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const expireMs = dateOnlyMatch
    ? Date.UTC(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
        20,
        59,
        59,
        999
      )
    : new Date(expireDate).getTime();
  if (!Number.isFinite(expireMs)) return '';

  const diffTime = expireMs - Date.now();
  if (diffTime < 0) return 'Истекла';
  if (diffTime < msPerDay) return 'Сегодня истекает';
  const diffDays = Math.ceil(diffTime / msPerDay);
  return `≈ ${diffDays} дней`;
};


export const fetchAvailableLocations = async (userId: number, language?: string): Promise<LocationItem[]> => {
  const apiLanguage = language === 'am' ? 'hy' : language;
  const cacheKey = getLocationsCacheKey(userId, apiLanguage);
  const cached = cacheGet<LocationItem[]>(cacheKey, CACHE_TTL.locations);
  if (cached) return cached;

  const inFlight = locationsInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const now = Date.now();
  const cooldownUntil = locationsCooldownUntil.get(cacheKey);
  if (cooldownUntil && cooldownUntil > now) {
    const fallback = cacheGet<LocationItem[]>(cacheKey);
    return fallback || [];
  }

  const fetchPromise = (async () => {
    const token = getUserToken();
    const headers = {
      ...buildJsonHeaders(token),
      ...(apiLanguage ? { 'Accept-Language': apiLanguage } : {}),
    };
    const languageQuery = apiLanguage ? `language_code=${encodeURIComponent(apiLanguage)}` : '';
    const url = languageQuery
      ? `${API_PROXY_BASE_URL}/user/locations/available?${languageQuery}`
      : `${API_PROXY_BASE_URL}/user/locations/available`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        let cooldownMs = 5000;
        if (retryAfter) {
          const asSeconds = Number(retryAfter);
          if (Number.isFinite(asSeconds) && asSeconds > 0) {
            cooldownMs = asSeconds * 1000;
          } else {
            const asDate = Date.parse(retryAfter);
            if (!Number.isNaN(asDate)) {
              cooldownMs = Math.max(1000, asDate - Date.now());
            }
          }
        }
        locationsCooldownUntil.set(cacheKey, Date.now() + cooldownMs);
        const fallback = cacheGet<LocationItem[]>(cacheKey);
        if (fallback) return fallback;
        throw new Error('Слишком много запросов. Повторите позже.');
      }

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      const items = Array.isArray(data)
        ? data
        : Array.isArray((data as { locations?: LocationItem[] }).locations)
          ? (data as { locations: LocationItem[] }).locations
          : [];

      cacheSet(cacheKey, items);
      return items;
    } catch (error) {
      const fallback = cacheGet<LocationItem[]>(cacheKey);
      if (fallback) return fallback;
      throw (error instanceof Error ? error : new Error('Не удалось загрузить локации'));
    }
  })();

  locationsInFlight.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    locationsInFlight.delete(cacheKey);
  }
};

export const updateLocations = async (userId: number, locations: number[]): Promise<string> => {
  const token = getUserToken();
  const headers = buildJsonHeaders(token);
  const attempts: Array<{ url: string; init: RequestInit }> = [
    {
      url: `${API_PROXY_BASE_URL}/user/locations/`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ locations }),
        credentials: 'include',
      },
    },
    {
      url: `${API_PROXY_BASE_URL}/user/locations/`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId, locations }),
        credentials: 'include',
      },
    },
    {
      url: `${API_PROXY_BASE_URL}/user/locations/`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: userId, locations }),
        credentials: 'include',
      },
    },
    {
      url: `${API_PROXY_BASE_URL}/user/locations/update`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId, locations }),
        credentials: 'include',
      },
    },
  ];

  if (token) {
    attempts.push({
      url: `${API_PROXY_BASE_URL}/user/locations/?token=${encodeURIComponent(token)}`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ locations }),
        credentials: 'include',
      },
    });
  }

  return fetchJsonWithFallbacks<string>(attempts);
};

export const setUserCurrency = async (
  userId: number,
  currency: string,
  currencyId?: number | null
): Promise<string> => {
  const token = getUserToken();
  const headers = buildJsonHeaders(token);
  const extraToken =
    typeof window !== 'undefined'
      ? localStorage.getItem('auth_access_token') || localStorage.getItem('access_token')
      : null;
  const uniqueTokens = Array.from(new Set([token, extraToken].filter(Boolean))) as string[];
  const resolvedCurrencyId =
    typeof currencyId === 'number' && Number.isFinite(currencyId) ? currencyId : null;
  const candidateTokens = uniqueTokens.length ? uniqueTokens : [null];
  const buildCurrencyAttempts = (headersSet: HeadersInit) => [
    {
      url: `${API_PROXY_BASE_URL}/user/currency`,
      init: {
        method: 'POST',
        headers: headersSet,
        body: JSON.stringify({ currency_code: currency }),
        credentials: 'include',
      },
    },
    {
      url: `${API_PROXY_BASE_URL}/user/currency`,
      init: {
        method: 'POST',
        headers: headersSet,
        body: JSON.stringify({ currency: currency }),
        credentials: 'include',
      },
    },
    ...(resolvedCurrencyId !== null
      ? [
          {
            url: `${API_PROXY_BASE_URL}/user/currency`,
            init: {
              method: 'POST',
              headers: headersSet,
              body: JSON.stringify({ currency_id: resolvedCurrencyId }),
              credentials: 'include',
            },
          },
          {
            url: `${API_PROXY_BASE_URL}/user/currency`,
            init: {
              method: 'POST',
              headers: headersSet,
              body: JSON.stringify({ currency: resolvedCurrencyId }),
              credentials: 'include',
            },
          },
        ]
      : []),
  ];

  const attempts: Array<{ url: string; init: RequestInit }> = [];
  candidateTokens.forEach((candidate) => {
    const headersSet = buildJsonHeaders(candidate);
    attempts.push(...buildCurrencyAttempts(headersSet));
    attempts.push({
      url: `${API_PROXY_BASE_URL}/user/currency`,
      init: {
        method: 'POST',
        headers: headersSet,
        body: JSON.stringify({ user_id: userId, currency_code: currency }),
        credentials: 'include',
      },
    });
    attempts.push({
      url: `${API_PROXY_BASE_URL}/user/currency`,
      init: {
        method: 'POST',
        headers: headersSet,
        body: JSON.stringify({ id: userId, currency_code: currency }),
        credentials: 'include',
      },
    });
    if (resolvedCurrencyId !== null) {
      attempts.push({
        url: `${API_PROXY_BASE_URL}/user/currency`,
        init: {
          method: 'POST',
          headers: headersSet,
          body: JSON.stringify({ user_id: userId, currency_id: resolvedCurrencyId }),
          credentials: 'include',
        },
      });
      attempts.push({
        url: `${API_PROXY_BASE_URL}/user/currency`,
        init: {
          method: 'POST',
          headers: headersSet,
          body: JSON.stringify({ id: userId, currency_id: resolvedCurrencyId }),
          credentials: 'include',
        },
      });
    }
  });

  candidateTokens.forEach((candidate) => {
    if (!candidate) return;
    attempts.push({
      url: `${API_PROXY_BASE_URL}/user/currency?token=${encodeURIComponent(candidate)}`,
      init: {
        method: 'POST',
        headers: buildJsonHeaders(candidate),
        body: JSON.stringify({ currency_code: currency }),
        credentials: 'include',
      },
    });
    if (resolvedCurrencyId !== null) {
      attempts.push({
        url: `${API_PROXY_BASE_URL}/user/currency?token=${encodeURIComponent(candidate)}`,
        init: {
          method: 'POST',
          headers: buildJsonHeaders(candidate),
          body: JSON.stringify({ currency_id: resolvedCurrencyId }),
          credentials: 'include',
        },
      });
    }
  });

  return fetchJsonWithFallbacks<string>(attempts);
};

export const setUserLanguage = async (language: string, userId?: number | null): Promise<string> => {
  const token = getUserToken();
  const headers = buildJsonHeaders(token);
  const apiLanguage = language === 'am' ? 'hy' : language;
  const attempts: Array<{ url: string; init: RequestInit }> = [
    {
      url: `${API_PROXY_BASE_URL}/user/language`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ language_code: apiLanguage }),
        credentials: 'include',
      },
    },
    {
      url: `${API_PROXY_BASE_URL}/user/language`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ language: apiLanguage }),
        credentials: 'include',
      },
    },
  ];

  if (userId) {
    attempts.push(
      {
        url: `${API_PROXY_BASE_URL}/user/language`,
        init: {
          method: 'POST',
          headers,
          body: JSON.stringify({ user_id: userId, language_code: apiLanguage }),
          credentials: 'include',
        },
      },
      {
        url: `${API_PROXY_BASE_URL}/user/language`,
        init: {
          method: 'POST',
          headers,
          body: JSON.stringify({ id: userId, language_code: apiLanguage }),
          credentials: 'include',
        },
      }
    );
  }

  if (token) {
    attempts.push({
      url: `${API_PROXY_BASE_URL}/user/language?token=${encodeURIComponent(token)}`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ language_code: apiLanguage }),
        credentials: 'include',
      },
    });
  }

  return fetchJsonWithFallbacks<string>(attempts);
};

export const fetchDeviceButtons = async (userId: number): Promise<DeviceButtonOption[]> => {
  const token = getUserToken();
  const headers = buildJsonHeaders(token);
  const attempts: Array<{ url: string; init: RequestInit }> = [
    {
      url: `${API_PROXY_BASE_URL}/user/devices/number/buttons`,
      init: { method: 'GET', headers, credentials: 'include' },
    },
    {
      url: `${API_PROXY_BASE_URL}/devices/number/buttons`,
      init: { method: 'GET', headers, credentials: 'include' },
    },
  ];

  if (token) {
    attempts.push({
      url: `${API_PROXY_BASE_URL}/user/devices/number/buttons?token=${encodeURIComponent(token)}`,
      init: { method: 'GET', headers, credentials: 'include' },
    });
  }

  attempts.push(
    {
      url: `${API_PROXY_BASE_URL}/user/devices/number/buttons`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId }),
        credentials: 'include',
      },
    },
    {
      url: `${API_PROXY_BASE_URL}/user/devices/number/buttons`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: userId }),
        credentials: 'include',
      },
    },
    {
      url: `${API_PROXY_BASE_URL}/devices/number/buttons`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId }),
        credentials: 'include',
      },
    }
  );

  return fetchJsonWithFallbacks<DeviceButtonOption[]>(attempts);
};

export const setDeviceNumber = async (userId: number, deviceNumber: number): Promise<number> => {
  const token = getUserToken();
  const headers = buildJsonHeaders(token);
  const attempts: Array<{ url: string; init: RequestInit }> = [
    {
      url: `${API_PROXY_BASE_URL}/user/devices/number/`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ device_number: deviceNumber }),
        credentials: 'include',
      },
    },
    {
      url: `${API_PROXY_BASE_URL}/user/devices/number/`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId, device_number: deviceNumber }),
        credentials: 'include',
      },
    },
    {
      url: `${API_PROXY_BASE_URL}/user/devices/number/`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: userId, device_number: deviceNumber }),
        credentials: 'include',
      },
    },
    {
      url: `${API_PROXY_BASE_URL}/devices/number/set`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId, device_number: deviceNumber }),
        credentials: 'include',
      },
    },
  ];

  if (token) {
    attempts.push({
      url: `${API_PROXY_BASE_URL}/user/devices/number/?token=${encodeURIComponent(token)}`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ device_number: deviceNumber }),
        credentials: 'include',
      },
    });
  }

  return fetchJsonWithFallbacks<number>(attempts);
};

export const fetchDeviceTariff = async (userId: number, deviceNumber: number): Promise<DeviceTariffResponse> => {
  const token = getUserToken();
  const headers = buildJsonHeaders(token);
  const query = `device_number=${encodeURIComponent(deviceNumber)}`;
  const attempts: Array<{ url: string; init: RequestInit }> = [
    {
      url: `${API_PROXY_BASE_URL}/user/devices/number/tariff?${query}`,
      init: { method: 'GET', headers, credentials: 'include' },
    },
  ];

  if (token) {
    attempts.push({
      url: `${API_PROXY_BASE_URL}/user/devices/number/tariff?token=${encodeURIComponent(token)}&${query}`,
      init: { method: 'GET', headers, credentials: 'include' },
    });
  }

  return fetchJsonWithFallbacks<DeviceTariffResponse>(attempts);
};

const parsePaymentNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizePaymentHistory = (data: unknown): PaymentHistoryItem[] => {
  if (!data) return [];
  const extractList = (payload: unknown): unknown[] => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      if (Array.isArray(record.items)) return record.items;
      if (Array.isArray(record.results)) return record.results;
      if (Array.isArray(record.data)) return record.data;
      if (Array.isArray(record.payments)) return record.payments;
      if (Array.isArray(record.history)) return record.history;
      if (Array.isArray(record.transactions)) return record.transactions;
      if (Array.isArray(record.operations)) return record.operations;
    }
    return [];
  };

  const list = extractList(data);
  const payloadCurrency =
    data && typeof data === 'object'
      ? ((data as Record<string, unknown>).currency as Record<string, unknown> | undefined)
      : undefined;
  const payloadCurrencyCode =
    (typeof payloadCurrency?.code === 'string' && payloadCurrency.code) ||
    (typeof payloadCurrency?.currency_code === 'string' && payloadCurrency.currency_code) ||
    (typeof payloadCurrency?.name === 'string' && payloadCurrency.name) ||
    undefined;
  return list.map((entry) => {
    const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const amountRaw =
      record.amount ??
      record.sum ??
      record.value ??
      record.total ??
      record.price ??
      record.amount_total ??
      record.amount_value;
    const amount = parsePaymentNumber(amountRaw) ?? 0;
    const currency =
      (typeof record.currency_code === 'string' && record.currency_code) ||
      (typeof record.currency === 'string' && record.currency) ||
      (typeof record.code === 'string' && record.code) ||
      payloadCurrencyCode ||
      undefined;
    const createdAt =
      (typeof record.created_at === 'string' && record.created_at) ||
      (typeof record.createdAt === 'string' && record.createdAt) ||
      (typeof record.date === 'string' && record.date) ||
      (typeof record.created === 'string' && record.created) ||
      (typeof record.time === 'string' && record.time) ||
      undefined;
    const title =
      (typeof record.title === 'string' && record.title) ||
      (typeof record.operation === 'string' && record.operation) ||
      (typeof record.type === 'string' && record.type) ||
      (typeof record.name === 'string' && record.name) ||
      undefined;
    const subtitle =
      (typeof record.subtitle === 'string' && record.subtitle) ||
      (typeof record.method === 'string' && record.method) ||
      (typeof record.provider === 'string' && record.provider) ||
      (typeof record.payment_system === 'string' && record.payment_system) ||
      (typeof record.description === 'string' && record.description) ||
      undefined;
    const id = record.id ?? record.uid ?? record.uuid ?? record.payment_id ?? undefined;
    const direction = amount < 0 ? 'out' : 'in';
    return {
      id: typeof id === 'string' || typeof id === 'number' ? id : undefined,
      title,
      subtitle,
      amount,
      currency,
      created_at: createdAt,
      direction,
      ...record,
    } as PaymentHistoryItem;
  });
};

export const fetchPaymentsHistory = async (userId?: number): Promise<PaymentHistoryItem[]> => {
  const token =
    getUserToken() ||
    (typeof window !== 'undefined'
      ? (localStorage.getItem('auth_access_token') || localStorage.getItem('access_token'))
      : null);
  const headers = buildJsonHeaders(token);
  const attempts: Array<{ url: string; init: RequestInit }> = [];
  const basePath = `${API_PROXY_BASE_URL}/user/payments`;

  attempts.push({
    url: basePath,
    init: { method: 'GET', headers, credentials: 'include' },
  });

  if (token) {
    attempts.push({
      url: `${basePath}?token=${encodeURIComponent(token)}`,
      init: { method: 'GET', headers, credentials: 'include' },
    });
  } else if (userId) {
    attempts.push({
      url: `${basePath}?user_id=${encodeURIComponent(userId)}`,
      init: { method: 'GET', headers, credentials: 'include' },
    });
  }

  const data = await fetchJsonWithFallbacks<unknown>(attempts);
  return normalizePaymentHistory(data);
};


const normalizeReferredUsers = (data: unknown): ReferredUser[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data as ReferredUser[];
  if (typeof data !== 'object') return [];

  const record = data as Record<string, unknown>;
  const list =
    (Array.isArray(record.items) && record.items) ||
    (Array.isArray(record.results) && record.results) ||
    (Array.isArray(record.data) && record.data) ||
    (Array.isArray(record.referred) && record.referred) ||
    (Array.isArray(record.users) && record.users) ||
    (Array.isArray(record.referrals) && record.referrals) ||
    [];

  if (!Array.isArray(list)) return [];

  return list.map((item) => {
    if (!item || typeof item !== 'object') return {} as ReferredUser;
    const raw = item as Record<string, unknown>;
    const fullName =
      (typeof raw.full_name === 'string' && raw.full_name) ||
      (typeof raw.fullName === 'string' && raw.fullName) ||
      (typeof raw.name === 'string' && raw.name) ||
      (typeof raw.first_name === 'string' || typeof raw.last_name === 'string'
        ? [raw.first_name, raw.last_name].filter(Boolean).join(' ')
        : undefined);
    const username =
      (typeof raw.username === 'string' && raw.username) ||
      (typeof raw.telegram_username === 'string' && raw.telegram_username) ||
      (typeof raw.tg_username === 'string' && raw.tg_username) ||
      (typeof raw.handle === 'string' && raw.handle);
    const connected =
      (typeof raw.connected === 'boolean' && raw.connected) ||
      (typeof raw.is_connected === 'boolean' && raw.is_connected) ||
      (typeof raw.active === 'boolean' && raw.active) ||
      (typeof raw.is_active === 'boolean' && raw.is_active) ||
      (typeof raw.isConnected === 'boolean' && raw.isConnected) ||
      false;
    const amountRaw =
      raw.amount ?? raw.bonus ?? raw.reward ?? raw.sum ?? raw.earned ?? raw.bonus_amount;
    const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw || 0) || undefined;

    return {
      ...raw,
      full_name: fullName || (typeof raw.full_name === 'string' ? raw.full_name : undefined),
      username: username || (typeof raw.username === 'string' ? raw.username : undefined),
      connected,
      amount,
    };
  });
};

export const fetchReferredUsers = async (): Promise<ReferredUser[]> => {
  const token = getUserToken();

  if (!token) {
    throw new Error('User token not found');
  }

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...buildAuthHeaders(token),
  };

  const storedUserId =
    typeof window !== 'undefined' ? localStorage.getItem('user_id') || undefined : undefined;

  const attempts: Array<{ url: string; init: RequestInit }> = [
    {
      url: API_PROXY_BASE_URL + '/user/referred',
      init: { method: 'GET', headers, credentials: 'include' },
    },
    {
      url: API_PROXY_BASE_URL + '/user/referred?token=' + encodeURIComponent(token),
      init: { method: 'GET', headers, credentials: 'include' },
    },
  ];

  if (storedUserId) {
    attempts.push(
      {
        url: API_PROXY_BASE_URL + '/user/referred?user_id=' + encodeURIComponent(storedUserId),
        init: { method: 'GET', headers, credentials: 'include' },
      },
      {
        url: API_PROXY_BASE_URL + '/user/referred?uid=' + encodeURIComponent(storedUserId),
        init: { method: 'GET', headers, credentials: 'include' },
      },
      {
        url: API_PROXY_BASE_URL + '/user/referred',
        init: {
          method: 'POST',
          headers,
          body: JSON.stringify({ user_id: Number(storedUserId) }),
          credentials: 'include',
        },
      }
    );
  }

  const data = await fetchJsonWithFallbacks<unknown>(attempts);
  return normalizeReferredUsers(data);
};


export const authUserById = async (userId: number): Promise<string> => {
  const response = await fetch(
    `${API_PROXY_BASE_URL}/test/auth/auth_user?user_id=${encodeURIComponent(String(userId))}`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    }
  );

  if (!response.ok) {
    throw new Error(`Ошибка сервера: ${response.status}`);
  }

  return response.json();
};

export const extractAuthToken = (data: unknown): string | null => {
  if (typeof data === 'string') {
    return data;
  }
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const token =
      record.access_token ||
      record.token ||
      record.auth_token ||
      record.user_token;
    return typeof token === 'string' && token ? token : null;
  }
  return null;
};

export const sendEmailAuthCode = async (email: string, serviceName: string, language: string): Promise<void> => {
  const response = await authFetch(`/auth/email/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      service_name: serviceName,
      language,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(getAuthErrorMessage(response, data));
  }
};

export const fetchUserInfoByToken = async (token: string): Promise<UserInfo> => {
  if (!token) {
    throw new Error('Токен пользователя не найден');
  }

  const attempts: Array<{ url: string; headers?: HeadersInit }> = [
    {
      url: `${API_PROXY_BASE_URL}/user/info`,
      headers: buildAuthHeaders(token),
    },
    {
      url: `${API_PROXY_BASE_URL}/user/info?token=${encodeURIComponent(token)}`,
      headers: buildAuthHeaders(token),
    },
    {
      url: `${API_PROXY_BASE_URL}/user/info/token?token=${encodeURIComponent(token)}`,
    },
  ];

  let lastError: Error | null = null;
  let lastStatus: number | null = null;
  for (const attempt of attempts) {
    const response = await fetch(attempt.url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...attempt.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      lastStatus = response.status;
      if ([401, 403, 404].includes(response.status)) {
        lastError = new Error('Недействительный токен. Пожалуйста, войдите снова');
        continue;
      }

      if (response.status === 422) {
        const error: ApiError = await response.json();
        lastError = new Error(error.detail[0]?.msg || 'Ошибка валидации');
        continue;
      }

      lastError = new Error(`Ошибка сервера: ${response.status}`);
      continue;
    }

    const data = await response.json();
    cacheSet('user', data, { token });
    return data;
  }

  if (lastError) {
    const isAuthError =
      lastError.message.includes('Недействительный токен') ||
      lastError.message.includes('401') ||
      lastError.message.includes('403');
    if (!isAuthError && (lastStatus === null || lastStatus >= 500)) {
      const { data, meta } = cacheGetWithMeta<UserInfo>('user', CACHE_TTL.user);
      if (data && typeof meta.token === 'string' && meta.token === token) {
        return data;
      }
    }
    throw lastError;
  }
  throw new Error('Неизвестная ошибка при загрузке данных');
};

export const verifyEmailAuthCode = async (email: string, code: string): Promise<AuthTokens & Record<string, unknown>> => {
  const response = await authFetch(`/auth/email/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getAuthErrorMessage(response, data));
  }

  return data as AuthTokens & Record<string, unknown>;
};

export const verifyAuthToken = async (token: string): Promise<Record<string, unknown>> => {
  const response = await authFetch(`/auth/jwt/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getAuthErrorMessage(response, data));
  }

  return data as Record<string, unknown>;
};

const decodeUserIdFromJwt = (token: string): number | null => {
  if (typeof window === 'undefined') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
    const payload = JSON.parse(json) as { user_id?: number | string; sub?: number | string };
    const raw = payload.user_id ?? payload.sub;
    return parseNumericId(raw);
  } catch {
    return null;
  }
};

export const recoverUserTokenFromAuth = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;
  const accessToken =
    localStorage.getItem('auth_access_token') || localStorage.getItem('access_token');
  if (!accessToken) return null;
  let userId = decodeUserIdFromJwt(accessToken);
  if (!userId) {
    userId = await fetchAuthUserId(accessToken);
  }
  if (!userId) return null;
  const token = await authUserById(userId);
  if (typeof token === 'string' && token) {
    setUserToken(token);
    return token;
  }
  return null;
};

const parseNumericId = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const direct = Number(trimmed);
      return Number.isNaN(direct) ? null : direct;
    }
    const match = trimmed.match(/\b(?:user|uid|id)\s*[:=]\s*(\d+)\b/i);
    if (match) {
      const parsed = Number(match[1]);
      return Number.isNaN(parsed) ? null : parsed;
    }
  }
  return null;
};

const extractUserId = (data: unknown): number | null => {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const raw =
    record.user_id ??
    record.id ??
    record.uid ??
    record.sub ??
    (typeof record.user === 'object' && record.user ? (record.user as Record<string, unknown>).id : undefined);
  return parseNumericId(raw);
};

export const fetchAuthUserId = async (accessToken: string): Promise<number | null> => {
  const response = await authFetch(`/users/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  return extractUserId(data);
};

export interface AuthUserProfile {
  id?: number | string;
  email?: string;
  username?: string;
  telegram?: string;
  telegramLinked?: boolean;
  fullName?: string;
  telegramUsername?: string;
}

interface AuthMethodEntry {
  auth_type?: string;
  identifier?: string;
  username?: string;
  first_name?: string;
  telegram_username?: string;
  tg_username?: string;
  extra_data?: Record<string, unknown>;
  extraData?: Record<string, unknown>;
}

const isNumericIdentifier = (value: string): boolean => /^\d+$/.test(value.trim());

const normalizeTelegramValue = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(/^@/, '');
  if (!normalized || isNumericIdentifier(normalized)) return undefined;
  return normalized;
};

const parseAuthMethods = (data: unknown): { email?: string; telegram?: string; telegramLinked?: boolean; telegramUsername?: string; fullName?: string } => {
  if (!data || typeof data !== 'object') return {};
  const record = data as Record<string, unknown>;
  const list =
    (Array.isArray(record.current) && record.current) ||
    (Array.isArray(record.methods) && record.methods) ||
    (Array.isArray(record.items) && record.items) ||
    (Array.isArray(data) ? (data as unknown[]) : []);

  let email: string | undefined;
  let telegram: string | undefined;
  let telegramLinked = false;
  let telegramUsername: string | undefined;
  let fullName: string | undefined;

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const method = entry as AuthMethodEntry;
    const type = (method.auth_type || '').toString().toLowerCase();

    if (type === 'email' && method.identifier) {
      email = method.identifier;
    }

    if (type === 'telegram' || type === 'tg') {
      telegramLinked = true;
      const extra = (method.extra_data || method.extraData) as Record<string, unknown> | undefined;
      const extraUsername =
        (typeof extra?.username === 'string' ? extra.username : undefined) ||
        (typeof extra?.telegram_username === 'string' ? extra.telegram_username : undefined) ||
        (typeof extra?.tg_username === 'string' ? extra.tg_username : undefined);
      const extraFull =
        (typeof extra?.full_name === 'string' ? extra.full_name : undefined) ||
        (typeof extra?.fullName === 'string' ? extra.fullName : undefined);
      const extraFirst =
        (typeof extra?.first_name === 'string' ? extra.first_name : undefined) ||
        (typeof extra?.firstName === 'string' ? extra.firstName : undefined);
      const extraLast =
        (typeof extra?.last_name === 'string' ? extra.last_name : undefined) ||
        (typeof extra?.lastName === 'string' ? extra.lastName : undefined);
      const candidateFullName = (extraFull || [extraFirst, extraLast].filter(Boolean).join(' ')).trim();
      if (!fullName && candidateFullName) {
        fullName = candidateFullName;
      }

      const username = method.username || method.telegram_username || method.tg_username || extraUsername;
      const normalized = normalizeTelegramValue(
        typeof username === 'string' ? username : typeof method.first_name === 'string' ? method.first_name : undefined
      );
      if (!telegramUsername && normalized) {
        telegramUsername = normalized;
      }
      if (!telegram && normalized) {
        telegram = normalized;
      }

      if (!telegram && typeof method.identifier === 'string') {
        const fallback = normalizeTelegramValue(method.identifier);
        if (fallback) {
          telegram = fallback;
          if (!telegramUsername) {
            telegramUsername = fallback;
          }
        }
      }
    }
  }

  return { email, telegram, telegramLinked, telegramUsername, fullName };
};

export const fetchAuthMethods = async (accessToken: string): Promise<{ email?: string; telegram?: string; telegramLinked?: boolean; telegramUsername?: string; fullName?: string } | null> => {
  if (!AUTH_PROFILE_ENABLED) {
    const cached = cacheGetWithMeta<{ email?: string; telegram?: string; telegramLinked?: boolean; telegramUsername?: string; fullName?: string }>('auth_profile', CACHE_TTL.authProfile);
    if (cached.data && cached.meta?.token === accessToken) {
      return cached.data;
    }
    return null;
  }
  let response: Response | null = null;
  try {
    response = await authFetch(`/users/me/auth-methods`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  } catch {
    const cached = cacheGetWithMeta<{ email?: string; telegram?: string; telegramLinked?: boolean; telegramUsername?: string; fullName?: string }>('auth_profile', CACHE_TTL.authProfile);
    if (cached.data && cached.meta?.token === accessToken) {
      return cached.data;
    }
    return null;
  }

  if (!response.ok) {
    const cached = cacheGetWithMeta<{ email?: string; telegram?: string; telegramLinked?: boolean }>('auth_profile', CACHE_TTL.authProfile);
    if (cached.data && cached.meta?.token === accessToken) {
      return cached.data;
    }
    return null;
  }

  const data = await response.json().catch(() => ({}));
  const parsed = parseAuthMethods(data);
  cacheSet('auth_profile', parsed, { token: accessToken });
  return parsed;
};

const storeAuthTokens = (tokens: AuthTokens) => {
  if (typeof window === 'undefined') return;
  if (tokens.access_token) {
    localStorage.setItem('auth_access_token', tokens.access_token);
    localStorage.setItem('access_token', tokens.access_token);
  }
  if (tokens.refresh_token) {
    localStorage.setItem('auth_refresh_token', tokens.refresh_token);
    localStorage.setItem('ga_refresh_token', tokens.refresh_token);
  }
};

export const fetchAuthProfile = async (accessToken: string): Promise<AuthUserProfile | null> => {
  if (!AUTH_PROFILE_ENABLED) {
    const cached = cacheGetWithMeta<AuthUserProfile>('auth_profile', CACHE_TTL.authProfile);
    if (cached.data && cached.meta?.token === accessToken) {
      return cached.data;
    }
    return null;
  }
  let response: Response | null = null;
  try {
    response = await authFetch(`/users/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  } catch {
    const cached = cacheGetWithMeta<AuthUserProfile>('auth_profile', CACHE_TTL.authProfile);
    if (cached.data && cached.meta?.token === accessToken) {
      return cached.data;
    }
    return null;
  }

  if (!response.ok) {
    if ([401, 403].includes(response.status) && typeof window !== 'undefined') {
      const refreshToken =
        localStorage.getItem('auth_refresh_token') || localStorage.getItem('ga_refresh_token');
      if (refreshToken) {
        try {
          const tokens = await refreshAuthToken(refreshToken);
          storeAuthTokens(tokens);
          if (tokens.access_token) {
            return fetchAuthProfile(tokens.access_token);
          }
        } catch {
          // Если refresh не помог — отдаём null, чтобы UI показал логин.
        }
      }
    }
    const cached = cacheGetWithMeta<AuthUserProfile>('auth_profile', CACHE_TTL.authProfile);
    if (cached.data && cached.meta?.token === accessToken) {
      return cached.data;
    }
    return null;
  }

  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  const id = extractUserId(data) ?? (typeof data.id === 'string' ? data.id : undefined);

  let email: string | undefined;
  let telegram: string | undefined;
  let telegramLinked = false;
  let fullName: string | undefined;
  let telegramUsername: string | undefined;

  if (Array.isArray(data.auth_methods)) {
    for (const method of data.auth_methods) {
      if (!method || typeof method !== 'object') continue;
      const record = method as Record<string, unknown>;
      const authType = typeof record.auth_type === 'string' ? record.auth_type.toLowerCase() : '';
      const identifier = typeof record.identifier === 'string' ? record.identifier : undefined;
      const extra = (record.extra_data || record.extraData) as Record<string, unknown> | undefined;
      const extraUsername =
        (typeof extra?.username === 'string' ? extra.username : undefined) ||
        (typeof extra?.telegram_username === 'string' ? extra.telegram_username : undefined) ||
        (typeof extra?.tg_username === 'string' ? extra.tg_username : undefined);
      const extraFull =
        (typeof extra?.full_name === 'string' ? extra.full_name : undefined) ||
        (typeof extra?.fullName === 'string' ? extra.fullName : undefined);
      const extraFirst =
        (typeof extra?.first_name === 'string' ? extra.first_name : undefined) ||
        (typeof extra?.firstName === 'string' ? extra.firstName : undefined);
      const extraLast =
        (typeof extra?.last_name === 'string' ? extra.last_name : undefined) ||
        (typeof extra?.lastName === 'string' ? extra.lastName : undefined);
      const candidateFullName = (extraFull || [extraFirst, extraLast].filter(Boolean).join(' ')).trim();
      if (!fullName && candidateFullName) {
        fullName = candidateFullName;
      }
      if (authType === 'email' && identifier) {
        email = identifier;
      }
      if (authType === 'telegram' || authType === 'tg') {
        telegramLinked = true;
        const normalized = normalizeTelegramValue(
          typeof record.username === 'string'
            ? record.username
            : typeof record.telegram_username === 'string'
              ? record.telegram_username
              : typeof record.tg_username === 'string'
                ? record.tg_username
                : typeof extraUsername === 'string'
                  ? extraUsername
                  : typeof record.first_name === 'string'
                    ? record.first_name
                    : identifier
        );
        if (normalized) {
          telegram = normalized;
          if (!telegramUsername) {
            telegramUsername = normalized;
          }
        }
      }
    }
  }

  if (!email) {
    email =
      (typeof data.email === 'string' ? data.email : undefined) ||
      (typeof data.user === 'object' && data.user && typeof (data.user as Record<string, unknown>).email === 'string'
        ? String((data.user as Record<string, unknown>).email)
        : undefined);
  }

  const username =
    (typeof data.username === 'string' ? data.username : undefined) ||
    (typeof data.user === 'object' && data.user && typeof (data.user as Record<string, unknown>).username === 'string'
      ? String((data.user as Record<string, unknown>).username)
      : undefined);

  if (!telegram) {
    telegram =
      normalizeTelegramValue(typeof data.telegram === 'string' ? data.telegram : undefined) ||
      normalizeTelegramValue(typeof data.telegram_username === 'string' ? data.telegram_username : undefined);
  }

  if (telegram) {
    telegramLinked = true;
  }

  if (!email || !telegram) {
    try {
      const methods = await fetchAuthMethods(accessToken);
      if (methods) {
        email = email || methods.email;
        telegram = telegram || methods.telegram;
        telegramLinked = telegramLinked || !!methods.telegramLinked || !!methods.telegram;
        fullName = fullName || methods.fullName;
        telegramUsername = telegramUsername || methods.telegramUsername;
      }
    } catch {
      // Игнорируем ошибки, чтобы не ломать профиль.
    }
  }

  const profile = { id, email, username, telegram, telegramLinked, fullName, telegramUsername };
  cacheSet('auth_profile', profile, { token: accessToken });
  return profile;
};

export const verifyTelegramAuth = async (
  payload: TelegramAuthPayload
): Promise<AuthTokens | null> => {
  try {
    const response = await authFetch(`/auth/telegram/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return null;
    }
    if (data && typeof data === 'object' && 'access_token' in data) {
      return data as AuthTokens;
    }
    return null;
  } catch {
    return null;
  }
};

export const createAuthUserFromTelegram = async (
  payload: TelegramAuthPayload
): Promise<string> => {
  const requestToken = async (endpoint: string) => {
    const response = await fetch(`${API_PROXY_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (!response.ok) {
      return { ok: false, error: new Error(`Ошибка сервера: ${response.status}`) };
    }

    const data = await response.json();
    const token = extractAuthToken(data);
    if (!token) {
      return { ok: false, error: new Error('Токен не найден в ответе') };
    }
    return { ok: true, token };
  };

  // Сначала основной endpoint, затем тестовый (если в ответе нет токена).
  const primary = await requestToken('/auth/telegram/web');
  if (primary.ok) {
    return primary.token;
  }

  const fallback = await requestToken('/test/auth/create_auth_user');
  if (fallback.ok) {
    return fallback.token;
  }

  throw fallback.error || primary.error || new Error('Не удалось получить токен');
};

export const linkTelegramToAuth = async (
  accessToken: string,
  payload: TelegramAuthPayload
): Promise<Record<string, unknown>> => {
  const response = await authFetch(`/users/me/link/telegram/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(getAuthErrorMessage(response, data));
    (error as { status?: number }).status = response.status;
    throw error;
  }

  return data as Record<string, unknown>;
};

export const refreshAuthToken = async (refreshToken: string): Promise<AuthTokens> => {
  const response = await authFetch(`/auth/jwt/refresh?refresh_token=${encodeURIComponent(refreshToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getAuthErrorMessage(response, data));
  }

  return data as AuthTokens;
};



