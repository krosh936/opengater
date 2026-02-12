const API_BASE_URL = 'https://cdn.opngtr.ru/api';


const API_PROXY_BASE_URL = '/api/proxy';


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

  try {
    const response = await fetch(`${API_PROXY_BASE_URL}/user/info/token?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Недействительный токен. Пожалуйста, войдите снова');
      }
      
      if (response.status === 422) {
        const error: ApiError = await response.json();
        throw new Error(error.detail[0]?.msg || 'Ошибка валидации');
      }
      
      throw new Error(`Ошибка сервера: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Неизвестная ошибка при загрузке данных');
  }
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

const extractAuthToken = (data: unknown): string | null => {
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
