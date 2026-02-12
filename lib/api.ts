const API_BASE_URL = 'https://api.bot.eutochkin.com/api';


const API_PROXY_BASE_URL = '/api/proxy';
const AUTH_BACKEND_DIRECT_URL = 'https://api.bot.eutochkin.com/api';
const AUTH_BACKEND_ALT_URL = 'https://api.bot.eutochkin.com';
const AUTH_BACKEND_FALLBACK_URL = 'https://auth.bot.eutochkin.com';
const AUTH_BACKEND_PROXY_URL = '/api/auth';
const AUTH_BACKEND_URLS = [
  AUTH_BACKEND_PROXY_URL,
  AUTH_BACKEND_DIRECT_URL,
  AUTH_BACKEND_ALT_URL,
  AUTH_BACKEND_FALLBACK_URL,
];

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

export interface ReferredUser {
  full_name?: string;
  username?: string;
  connected?: boolean;
  amount?: number;
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

const isJwtToken = (token: string): boolean => {
  return token.split('.').length === 3;
};

const buildAuthHeaders = (token?: string | null): HeadersInit => {
  if (!token) return {};
  if (!isJwtToken(token)) return {};
  return { 'Authorization': `Bearer ${token}` };
};


// Функция для получения user_token из localStorage или cookies
export const getUserToken = (): string | null => {
  if (typeof window !== 'undefined') {
    const storedToken = localStorage.getItem('user_token') || localStorage.getItem('auth_token');
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
  }
};

// Основная функция для получения данных пользователя
export const fetchUserInfo = async (): Promise<UserInfo> => {
  const token = getUserToken();
  
  if (!token) {
    throw new Error('Токен пользователя не найден');
  }

  const attempts: Array<{ url: string; headers?: HeadersInit }> = [];
  if (isJwtToken(token)) {
    attempts.push({
      url: `${API_PROXY_BASE_URL}/user/info`,
      headers: buildAuthHeaders(token),
    });
    attempts.push({
      url: `${API_PROXY_BASE_URL}/user/info?token=${encodeURIComponent(token)}`,
      headers: buildAuthHeaders(token),
    });
  }
  attempts.push({
    url: `${API_PROXY_BASE_URL}/user/info/token?token=${encodeURIComponent(token)}`,
  });

  let lastError: Error | null = null;
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
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Неизвестная ошибка при загрузке данных');
    }
  }

  if (lastError) {
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
  const response = await fetch(`${API_PROXY_BASE_URL}/currency/`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Ошибка сервера: ${response.status}`);
  }

  return response.json();
};

export const fetchLanguages = async (): Promise<LanguageOption[]> => {
  const endpoints = [
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
        return data;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Не удалось загрузить список языков');
};

// Функция для получения дней оставшихся
export const calculateDaysRemaining = (expireDate: string): string => {
  const expire = new Date(expireDate);
  const now = new Date();
  const diffTime = expire.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Истекла';
  if (diffDays === 0) return 'Сегодня истекает';
  return `≈ ${diffDays} дней`;
};


export const fetchAvailableLocations = async (userId: number): Promise<LocationItem[]> => {
  const response = await fetch(`${API_PROXY_BASE_URL}/user/locations/available`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: userId }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Ошибка сервера: ${response.status}`);
  }

  return response.json();
};

export const updateLocations = async (userId: number, locations: number[]): Promise<string> => {
  const response = await fetch(`${API_PROXY_BASE_URL}/user/locations/update`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId, locations }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Ошибка сервера: ${response.status}`);
  }

  return response.json();
};

export const setUserCurrency = async (userId: number, currency: string): Promise<string> => {
  const response = await fetch(`${API_PROXY_BASE_URL}/user/currency`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId, currency_code: currency }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Ошибка сервера: ${response.status}`);
  }

  return response.json();
};

export const fetchDeviceButtons = async (userId: number): Promise<DeviceButtonOption[]> => {
  const request = async (body: Record<string, unknown>) => {
    return fetch(`${API_PROXY_BASE_URL}/devices/number/buttons`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });
  };

  let response = await request({ user_id: userId });

  if (response.status === 422) {
    response = await request({ id: userId });
  }

  if (!response.ok) {
    throw new Error(`Ошибка сервера: ${response.status}`);
  }

  return response.json();
};

export const setDeviceNumber = async (userId: number, deviceNumber: number): Promise<number> => {
  const response = await fetch(`${API_PROXY_BASE_URL}/devices/number/set`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId, device_number: deviceNumber }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Ошибка сервера: ${response.status}`);
  }

  return response.json();
};

export const fetchDeviceTariff = async (userId: number, deviceNumber: number): Promise<DeviceTariffResponse> => {
  const response = await fetch(`${API_PROXY_BASE_URL}/devices/number/tariff`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId, device_number: deviceNumber }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Ошибка сервера: ${response.status}`);
  }

  return response.json();
};

export const fetchReferredUsers = async (): Promise<ReferredUser[]> => {
  const token = getUserToken();

  if (!token) {
    throw new Error('Токен пользователя не найден');
  }

  const response = await fetch(`${API_PROXY_BASE_URL}/user/referred?token=${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Ошибка сервера: ${response.status}`);
  }

  return response.json();
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

  const attempts: Array<{ url: string; headers?: HeadersInit }> = [];
  if (isJwtToken(token)) {
    attempts.push({
      url: `${API_PROXY_BASE_URL}/user/info`,
      headers: buildAuthHeaders(token),
    });
    attempts.push({
      url: `${API_PROXY_BASE_URL}/user/info?token=${encodeURIComponent(token)}`,
      headers: buildAuthHeaders(token),
    });
  }
  attempts.push({
    url: `${API_PROXY_BASE_URL}/user/info/token?token=${encodeURIComponent(token)}`,
  });

  let lastError: Error | null = null;
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

    return response.json();
  }

  if (lastError) {
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
  id?: number;
  email?: string;
  username?: string;
  telegram?: string;
  telegramLinked?: boolean;
}

interface AuthMethodEntry {
  auth_type?: string;
  identifier?: string;
  username?: string;
  first_name?: string;
  telegram_username?: string;
  tg_username?: string;
}

const isNumericIdentifier = (value: string): boolean => /^\d+$/.test(value.trim());

const normalizeTelegramValue = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || isNumericIdentifier(trimmed)) return undefined;
  return trimmed.replace(/^@/, '');
};

const parseAuthMethods = (data: unknown): { email?: string; telegram?: string; telegramLinked?: boolean } => {
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

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const method = entry as AuthMethodEntry;
    const type = (method.auth_type || '').toString().toLowerCase();

    if (type === 'email' && method.identifier) {
      email = method.identifier;
    }

    if (type === 'telegram' || type === 'tg') {
      telegramLinked = true;
      if (telegram) continue;
      const username = method.username || method.telegram_username || method.tg_username;
      const normalized = normalizeTelegramValue(
        typeof username === 'string' ? username : typeof method.first_name === 'string' ? method.first_name : undefined
      );
      if (normalized) {
        telegram = normalized;
        continue;
      }
      if (typeof method.identifier === 'string') {
        const fallback = normalizeTelegramValue(method.identifier);
        if (fallback) {
          telegram = fallback;
        }
      }
    }
  }

  return { email, telegram, telegramLinked };
};

export const fetchAuthMethods = async (accessToken: string): Promise<{ email?: string; telegram?: string; telegramLinked?: boolean } | null> => {
  const response = await authFetch(`/users/me/auth-methods`, {
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
  return parseAuthMethods(data);
};

export const fetchAuthProfile = async (accessToken: string): Promise<AuthUserProfile | null> => {
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

  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  const id = extractUserId(data) ?? undefined;

  let email: string | undefined;
  let telegram: string | undefined;
  let telegramLinked = false;

  if (Array.isArray(data.auth_methods)) {
    for (const method of data.auth_methods) {
      if (!method || typeof method !== 'object') continue;
      const record = method as Record<string, unknown>;
      const authType = typeof record.auth_type === 'string' ? record.auth_type.toLowerCase() : '';
      const identifier = typeof record.identifier === 'string' ? record.identifier : undefined;
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
                : typeof record.first_name === 'string'
                  ? record.first_name
                  : identifier
        );
        if (normalized) {
          telegram = normalized;
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
      }
    } catch {
      // Игнорируем ошибки, чтобы не ломать профиль.
    }
  }

  return { id, email, username, telegram, telegramLinked };
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



